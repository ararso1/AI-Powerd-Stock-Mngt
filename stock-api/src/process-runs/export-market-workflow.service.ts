import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  CoffeeForm,
  ItemType,
  LocationType,
  LotEventType,
  LotQcPhase,
  LotStatus,
  ProcessRunStatus,
  PurchaseType,
  StockMovementSourceType,
} from '../common/enums';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { User } from '../database/entities/user.entity';
import { StockService } from '../inventory/stock.service';
import {
  SubmitExportStageDto,
  UpdateExportDocumentsDto,
} from './dto/export-stage.dto';
import {
  EXPORT_MARKET_STAGES,
  ExportMarketStage,
  ExportPostEcta,
  ExportStageResult,
  exportLossWarnings,
  lossPercent,
} from './export-market.stages';

@Injectable()
export class ExportMarketWorkflowService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
  ) {}

  async submit(id: string, dto: SubmitExportStageDto, userId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProcessRun);
      const run = await runRepo.findOne({ where: { id } });
      if (!run) throw new NotFoundException('Process run not found');
      if (run.workflow !== PurchaseType.EXPORT) {
        throw new BadRequestException(
          'This stage flow is only for export processing',
        );
      }
      if (
        run.status !== ProcessRunStatus.IN_PROGRESS &&
        run.status !== ProcessRunStatus.DRAFT
      ) {
        throw new BadRequestException('This run is not open for processing');
      }
      if (run.status === ProcessRunStatus.DRAFT) {
        run.status = ProcessRunStatus.IN_PROGRESS;
        run.startedAt = run.startedAt ?? new Date();
      }

      const stages = this.stagesFor(run);
      const stage = stages[run.currentStageIndex] as ExportMarketStage | undefined;
      if (!stage) {
        throw new BadRequestException('Export processing is already finished');
      }

      const user = userId
        ? await manager.getRepository(User).findOne({ where: { id: userId } })
        : null;
      const actor = user?.fullName ?? null;
      const results = [...((run.stageResults ?? []) as ExportStageResult[])];
      const completed = [...(run.stagesCompleted ?? [])];
      let result: ExportStageResult;
      if (stage === 'Packaging') {
        const packaging = await this.recordPackaging(
          manager,
          run,
          dto,
          userId,
          actor,
        );
        results.push(packaging);
        completed.push('Packaging');
        run.stageResults = results as unknown as ProcessRun['stageResults'];
        result = await this.recordExportStore(
          manager,
          run,
          {
            ...dto,
            inputQty: parseFloat(packaging.packagedKg ?? packaging.outputQty),
          },
          userId,
          actor,
        );
        results.push(result);
        completed.push('Export Store');
        run.currentStageIndex += 2;
      } else {
        result =
          stage === 'Processing Started'
            ? await this.recordProcessingStarted(manager, run, dto, userId, actor)
            : stage === 'Cleaning'
              ? await this.recordCleaning(manager, run, dto, userId, actor)
              : await this.recordExportStore(manager, run, dto, userId, actor);
        results.push(result);
        completed.push(stage);
        run.currentStageIndex += 1;
      }
      run.stageResults = results as unknown as ProcessRun['stageResults'];
      run.stages = stages;
      run.stagesCompleted = completed;
      const removedTotal = results.reduce(
        (sum, row) => sum + parseFloat(row.removedQty || '0'),
        0,
      );
      run.quantityReject = removedTotal.toFixed(3);

      if (run.currentStageIndex >= stages.length) {
        run.status = ProcessRunStatus.COMPLETED;
        run.completedAt = new Date();
        run.quantityOutput = result.packagedKg ?? result.outputQty;
        run.outputLotId = result.outputLotId;
        const input = parseFloat(results[0]?.inputQty ?? '0');
        const packed = parseFloat(result.packagedKg ?? result.outputQty ?? '0');
        run.actualYieldPercent =
          input > 0 ? ((packed / input) * 100).toFixed(2) : null;
      }
      if (dto.notes) run.notes = dto.notes;
      await runRepo.save(run);
    });
  }

  async updateDocuments(id: string, dto: UpdateExportDocumentsDto) {
    const run = await this.dataSource.getRepository(ProcessRun).findOne({
      where: { id },
    });
    if (!run) throw new NotFoundException('Process run not found');
    if (run.workflow !== PurchaseType.EXPORT) {
      throw new BadRequestException('Documents belong to an export process run');
    }
    const results = [...((run.stageResults ?? []) as ExportStageResult[])];
    const index = results.findIndex(
      (row) =>
        row.stage === 'Export Store' ||
        String(row.stage) === 'Packaging & Export Store',
    );
    if (index < 0) {
      throw new BadRequestException(
        'Packaging must be recorded before export documents can be saved',
      );
    }
    const current = results[index];
    results[index] = {
      ...current,
      postEcta: dto.postEcta
        ? (this.filledEcta(dto.postEcta) ?? current.postEcta)
        : current.postEcta,
      documents: dto.documents
        ? dto.documents.map((doc) => ({
            key: doc.key,
            label: doc.label,
            reference: doc.reference?.trim() || null,
            notes: doc.notes?.trim() || null,
          }))
        : current.documents,
    };
    if (dto.postEcta && current.outputLotId && results[index].postEcta) {
      await this.writePostEcta(
        this.dataSource.manager,
        current.outputLotId,
        results[index].postEcta!,
      );
    }
    run.stageResults = results as unknown as ProcessRun['stageResults'];
    await this.dataSource.getRepository(ProcessRun).save(run);
  }

  async view(run: ProcessRun) {
    const stages = this.stagesFor(run);
    const next = stages[run.currentStageIndex] ?? null;
    const results = (run.stageResults ?? []) as ExportStageResult[];
    const started = results.find((row) => row.stage === 'Processing Started');
    const cleaning = results.find((row) => row.stage === 'Cleaning');
    const packaging = results.find(
      (row) =>
        row.stage === 'Packaging' ||
        String(row.stage) === 'Packaging & Export Store',
    );
    const lotIds = [
      ...(run.inputLines ?? []).map((line) => line.lotId),
      run.inputLotId,
    ].filter((id, index, all) => id && all.indexOf(id) === index);
    const sources =
      lotIds.length === 0
        ? []
        : await this.dataSource.getRepository(Lot).find({
            where: { id: In(lotIds) },
          });
    let availableInputKg = run.quantityInput;
    if (next === 'Cleaning' && started) availableInputKg = started.outputQty;
    if (next === 'Packaging' && cleaning) {
      availableInputKg = cleaning.outputQty;
    }
    if (next === 'Export Store' && packaging) {
      availableInputKg = packaging.packagedKg ?? packaging.outputQty;
    }
    return {
      stages,
      nextStage: next,
      availableInputKg,
      maxLossPercent: 13,
      sourceLots: sources.map((lot) => ({
        id: lot.id,
        code: lot.code,
        grade: lot.grade,
        form: lot.form,
        quantity: lot.quantity,
        ectaGrade: lot.ectaGrade,
        ectaCertificateNumber: lot.ectaCertificateNumber,
        ectaMoisturePercent: lot.ectaMoisturePercent,
        ectaCuppingScore: lot.ectaCuppingScore,
        ectaTestedAt: lot.ectaTestedAt,
        ectaNotes: lot.ectaNotes,
      })),
    };
  }

  private stagesFor(run: ProcessRun): string[] {
    const stored = Array.isArray(run.stages)
      ? run.stages.filter((stage) => stage.trim().length > 0)
      : [];
    const base = stored.length > 0 ? stored : [...EXPORT_MARKET_STAGES];
    const alreadyCombined = ((run.stageResults ?? []) as ExportStageResult[]).some(
      (row) => String(row.stage) === 'Packaging & Export Store',
    );
    if (alreadyCombined) return base;
    return base.flatMap((stage) =>
      stage === 'Packaging & Export Store' ? ['Packaging', 'Export Store'] : [stage],
    );
  }

  private async recordProcessingStarted(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitExportStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<ExportStageResult> {
    const committed = parseFloat(run.quantityInput);
    if (!(committed > 0)) {
      throw new BadRequestException('This run has no input quantity');
    }
    if (Math.abs(dto.inputQty - committed) > 0.001) {
      throw new BadRequestException(
        `Processing started with the ${committed.toFixed(3)} kg taken from the warehouse`,
      );
    }
    const grade = dto.expectedGrade?.trim();
    if (!grade) {
      throw new BadRequestException(
        'Enter the expected output grade after reject is removed',
      );
    }
    const source = await manager
      .getRepository(Lot)
      .findOne({ where: { id: run.inputLotId } });
    if (!source?.itemId) {
      throw new BadRequestException('The source lot has no catalog item');
    }
    const removed = this.resolveRemoved(committed, dto);
    const output = round3(committed - removed);
    if (output <= 0) {
      throw new BadRequestException('Usable output must be greater than 0');
    }
    const reject = await this.bookReject(
      manager,
      source,
      removed,
      run,
      `${source.code}-EXP-RJ`,
      run.locationId,
      userId,
      'Processing start loss moved to the reject store',
    );
    const unitCost = await this.unitCost(
      manager,
      run.locationId,
      source.itemId,
      source.id,
    );
    const processed = await this.receiveLot(manager, {
      code: await this.uniqueCode(manager, `${run.runNumber}-EXP`),
      itemId: source.itemId,
      locationId: run.locationId,
      form: CoffeeForm.GREEN,
      quantity: output,
      parent: source,
      grade,
      processMethod: 'Export processing',
      unitCost,
      run,
      userId,
      notes: `Export processing output of ${run.runNumber}`,
    });
    return this.result(
      'Processing Started',
      committed,
      removed,
      output,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: processed.id,
        outputLotCode: processed.code,
        rejectLotId: reject?.id ?? null,
        rejectLotCode: reject?.code ?? null,
        expectedGrade: grade,
        warnings: exportLossWarnings(committed, removed),
      },
    );
  }

  private async recordCleaning(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitExportStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<ExportStageResult> {
    const started = this.previous(run, 'Processing Started');
    const source = await manager
      .getRepository(Lot)
      .findOne({ where: { id: started.outputLotId! } });
    if (!source?.itemId) throw new NotFoundException('Processed lot not found');
    const available = parseFloat(source.quantity);
    if (Math.abs(dto.inputQty - available) > 0.001) {
      throw new BadRequestException(
        `Cleaning must use the ${available.toFixed(3)} kg from processing`,
      );
    }
    if (dto.removedQty == null && dto.lossPercent == null) {
      throw new BadRequestException('Enter the cleaning loss in kg or percent');
    }
    const removed = this.resolveRemoved(available, dto);
    const output = round3(available - removed);
    if (output <= 0) {
      throw new BadRequestException('Usable coffee after cleaning must be greater than 0');
    }
    const unitCost = await this.unitCost(
      manager,
      run.locationId,
      source.itemId,
      source.id,
    );
    await this.consumeLot(
      manager,
      source,
      available,
      run,
      userId,
      'Cleaning input',
    );
    const reject = await this.bookReject(
      manager,
      source,
      removed,
      run,
      `${source.code}-CLN-RJ`,
      run.locationId,
      userId,
      'Cleaning loss moved to the reject store',
    );
    const cleaned = await this.receiveLot(manager, {
      code: await this.uniqueCode(manager, `${run.runNumber}-CLN`),
      itemId: source.itemId,
      locationId: run.locationId,
      form: CoffeeForm.GREEN,
      quantity: output,
      parent: source,
      grade: started.expectedGrade ?? source.grade,
      processMethod: 'Cleaning',
      unitCost,
      run,
      userId,
      notes: `Cleaned export output of ${run.runNumber}`,
    });
    return this.result('Cleaning', available, removed, output, userId, actor, dto.notes, {
      outputLotId: cleaned.id,
      outputLotCode: cleaned.code,
      rejectLotId: reject?.id ?? null,
      rejectLotCode: reject?.code ?? null,
      expectedGrade: started.expectedGrade ?? null,
      warnings: exportLossWarnings(available, removed),
    });
  }

  private async recordPackaging(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitExportStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<ExportStageResult> {
    const cleaning = this.previous(run, 'Cleaning');
    const source = await manager
      .getRepository(Lot)
      .findOne({ where: { id: cleaning.outputLotId! } });
    if (!source?.itemId) throw new NotFoundException('Cleaned lot not found');
    const available = parseFloat(source.quantity);
    if (Math.abs(dto.inputQty - available) > 0.001) {
      throw new BadRequestException(
        `Packaging must use the ${available.toFixed(3)} kg from cleaning`,
      );
    }
    if (!(dto.kgPerDoniya && dto.kgPerDoniya > 0)) {
      throw new BadRequestException('Enter kilograms per Doniya');
    }
    const split = doniyaSplit(available, dto.kgPerDoniya);
    if (split.full < 1) {
      throw new BadRequestException(
        'Kilograms per Doniya is higher than the coffee ready for packaging',
      );
    }
    const unitCost = await this.unitCost(
      manager,
      source.locationId ?? run.locationId,
      source.itemId,
      source.id,
    );
    await this.consumeLot(manager, source, available, run, userId, 'Packaging input');
    const packedLot = await this.receiveLot(manager, {
      code: await this.uniqueCode(manager, `${run.runNumber}-PKG`),
      itemId: source.itemId,
      locationId: run.locationId,
      form: CoffeeForm.GREEN,
      quantity: split.packagedKg,
      parent: source,
      grade: cleaning.expectedGrade ?? source.grade,
      processMethod: 'Packaging',
      unitCost,
      run,
      userId,
      notes: `Packaged ${split.full} Doniya for ${run.runNumber}`,
    });
    let remainderLot: Lot | null = null;
    if (split.remainderKg > 0.0005) {
      remainderLot = await this.receiveLot(manager, {
        code: await this.uniqueCode(manager, `${run.runNumber}-REM`),
        itemId: source.itemId,
        locationId: run.locationId,
        form: CoffeeForm.GREEN,
        quantity: split.remainderKg,
        parent: source,
        grade: cleaning.expectedGrade ?? source.grade,
        processMethod: 'Export remainder',
        unitCost,
        run,
        userId,
        notes: `Unpackaged remainder of ${run.runNumber}`,
      });
    }
    return this.result(
      'Packaging',
      available,
      0,
      split.packagedKg,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: packedLot.id,
        outputLotCode: packedLot.code,
        warnings: [],
        expectedGrade: cleaning.expectedGrade ?? null,
        kgPerDoniya: dto.kgPerDoniya.toFixed(3),
        doniyaCount: split.full,
        packagedKg: split.packagedKg.toFixed(3),
        remainderKg: split.remainderKg.toFixed(3),
        remainderLotId: remainderLot?.id ?? null,
        remainderLotCode: remainderLot?.code ?? null,
      },
    );
  }

  private async recordExportStore(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitExportStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<ExportStageResult> {
    const packaging = this.previous(run, 'Packaging');
    const source = await manager
      .getRepository(Lot)
      .findOne({ where: { id: packaging.outputLotId! } });
    if (!source?.itemId) throw new NotFoundException('Packaged lot not found');
    const available = parseFloat(source.quantity);
    if (Math.abs(dto.inputQty - available) > 0.001) {
      throw new BadRequestException(
        `Export store must receive the ${available.toFixed(3)} kg from packaging`,
      );
    }
    const store = await manager.getRepository(Location).findOne({
      where: { type: LocationType.EXPORT_STAGING, isActive: true },
      order: { name: 'ASC' },
    });
    const storeLocationId = store?.id ?? run.locationId;
    const unitCost = await this.unitCost(
      manager,
      source.locationId ?? run.locationId,
      source.itemId,
      source.id,
    );
    await this.consumeLot(
      manager,
      source,
      available,
      run,
      userId,
      'Moved from packaging to the export store',
    );
    const item = await this.ensureItem(manager, {
      sku: 'COF-EXPORT',
      description: 'Export packaged coffee',
      unit: 'kg',
      itemType: ItemType.FINISHED,
    });
    const stored = await this.receiveLot(manager, {
      code: await this.uniqueCode(manager, `${run.runNumber}-EXPST`),
      itemId: item.id,
      locationId: storeLocationId,
      form: CoffeeForm.PACKAGED,
      quantity: available,
      parent: source,
      grade: packaging.expectedGrade ?? source.grade,
      processMethod: 'Export store',
      unitCost,
      run,
      userId,
      notes: `Export store of ${run.runNumber}`,
    });
    return this.result(
      'Export Store',
      available,
      0,
      available,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: stored.id,
        outputLotCode: stored.code,
        warnings: [],
        expectedGrade: packaging.expectedGrade ?? null,
        kgPerDoniya: packaging.kgPerDoniya ?? null,
        doniyaCount: packaging.doniyaCount ?? null,
        packagedKg: available.toFixed(3),
        remainderKg: packaging.remainderKg ?? '0.000',
        exportStoreLocationId: storeLocationId,
        exportStoreLocationName: store?.name ?? null,
      },
    );
  }

  private resolveRemoved(input: number, dto: SubmitExportStageDto) {
    const fromPercent =
      dto.lossPercent != null ? round3((input * dto.lossPercent) / 100) : null;
    if (
      dto.removedQty != null &&
      fromPercent != null &&
      Math.abs(dto.removedQty - fromPercent) > 0.05
    ) {
      throw new BadRequestException('Loss kilograms and loss percent do not match');
    }
    const removed = dto.removedQty ?? fromPercent ?? 0;
    if (removed - input > 1e-9) {
      throw new BadRequestException('Removed quantity cannot exceed the input');
    }
    return round3(removed);
  }

  private previous(run: ProcessRun, stage: ExportMarketStage): ExportStageResult {
    const found = ((run.stageResults ?? []) as ExportStageResult[]).find(
      (row) => row.stage === stage,
    );
    if (!found?.outputLotId) {
      throw new BadRequestException(`${stage} has no output lot`);
    }
    return found;
  }

  private result(
    stage: ExportMarketStage,
    input: number,
    removed: number,
    output: number,
    userId: string | undefined,
    actor: string | null,
    notes: string | undefined,
    extra: Partial<ExportStageResult>,
  ): ExportStageResult {
    return {
      stage,
      inputQty: input.toFixed(3),
      removedQty: removed.toFixed(3),
      outputQty: output.toFixed(3),
      lossPercent: lossPercent(input, removed).toFixed(2),
      warnings: extra.warnings ?? [],
      completedAt: new Date().toISOString(),
      completedById: userId ?? null,
      completedByName: actor,
      outputLotId: extra.outputLotId ?? null,
      outputLotCode: extra.outputLotCode ?? null,
      rejectLotId: extra.rejectLotId ?? null,
      rejectLotCode: extra.rejectLotCode ?? null,
      notes: notes?.trim() || null,
      ...extra,
    };
  }

  private filledEcta(
    dto: SubmitExportStageDto['postEcta'] | UpdateExportDocumentsDto['postEcta'],
  ): ExportPostEcta | null {
    if (!dto) return null;
    const record = this.ectaRecord(dto);
    const filled = Object.values(record).some((value) => value != null && value !== '');
    return filled ? record : null;
  }

  private ectaRecord(dto: NonNullable<SubmitExportStageDto['postEcta']>): ExportPostEcta {
    return {
      grade: dto.grade?.trim() || null,
      certificateNumber: dto.certificateNumber?.trim() || null,
      moisturePercent:
        dto.moisturePercent != null ? dto.moisturePercent.toFixed(2) : null,
      cuppingScore: dto.cuppingScore != null ? dto.cuppingScore.toFixed(2) : null,
      testedAt: dto.testedAt?.trim() || null,
      notes: dto.notes?.trim() || null,
    };
  }

  private async writePostEcta(
    manager: EntityManager,
    lotId: string,
    ecta: ExportPostEcta,
  ) {
    await manager.getRepository(Lot).update(lotId, {
      ectaGrade: ecta.grade ?? null,
      ectaCertificateNumber: ecta.certificateNumber ?? null,
      ectaMoisturePercent: ecta.moisturePercent ?? null,
      ectaCuppingScore: ecta.cuppingScore ?? null,
      ectaTestedAt: ecta.testedAt ?? null,
      ectaNotes: ecta.notes ?? null,
    });
  }

  private async unitCost(
    manager: EntityManager,
    locationId: string,
    itemId: string,
    lotId: string,
  ) {
    const stock = await this.stockService.getStock(
      locationId,
      itemId,
      manager,
      lotId,
    );
    return stock ? parseFloat(stock.purchasePrice) : 0;
  }

  private async consumeLot(
    manager: EntityManager,
    lot: Lot,
    qty: number,
    run: ProcessRun,
    userId: string | undefined,
    notes: string,
  ) {
    if (!lot.itemId) throw new BadRequestException('Lot has no catalog item');
    const locationId = lot.locationId ?? run.locationId;
    const left = parseFloat(lot.quantity) - qty;
    if (left < -1e-6) {
      throw new BadRequestException(
        `Lot ${lot.code} does not have ${qty.toFixed(3)} kg`,
      );
    }
    await this.stockService.adjust(
      {
        locationId,
        itemId: lot.itemId,
        quantityDelta: -qty,
        lotId: lot.id,
        meta: {
          sourceType: StockMovementSourceType.PRODUCTION_CONSUMPTION,
          referenceType: 'process_run',
          referenceId: run.id,
          reference: run.runNumber,
          batchCode: lot.code,
          grade: lot.grade,
          createdById: userId ?? null,
          notes,
        },
      },
      manager,
    );
    lot.quantity = Math.max(0, left).toFixed(3);
    await manager.getRepository(Lot).save(lot);
    await manager.getRepository(LotEvent).save(
      manager.getRepository(LotEvent).create({
        lotId: lot.id,
        eventType: LotEventType.PROCESS_COMPLETED,
        quantity: qty.toFixed(3),
        fromLocationId: locationId,
        notes: `${run.runNumber}: ${notes}`,
        createdById: userId ?? null,
        metadata: { processRunId: run.id },
      }),
    );
  }

  private async bookReject(
    manager: EntityManager,
    parent: Lot,
    qty: number,
    run: ProcessRun,
    code: string,
    locationId: string,
    userId: string | undefined,
    notes: string,
  ) {
    if (qty <= 1e-9) return null;
    const item = await this.ensureItem(manager, {
      sku: 'COF-REJECT',
      description: 'Rejected coffee (reject store)',
      unit: 'kg',
      itemType: ItemType.RAW,
    });
    return this.receiveLot(manager, {
      code: await this.uniqueCode(manager, code),
      itemId: item.id,
      locationId,
      form: CoffeeForm.REJECT,
      quantity: qty,
      parent,
      grade: 'REJECT',
      processMethod: 'Reject',
      unitCost: 0,
      run,
      userId,
      notes,
      qcPhase: LotQcPhase.REJECTED,
      status: LotStatus.HOLD,
    });
  }

  private async receiveLot(
    manager: EntityManager,
    args: {
      code: string;
      itemId: string;
      locationId: string;
      form: CoffeeForm;
      quantity: number;
      parent: Lot;
      grade?: string | null;
      processMethod: string;
      unitCost: number;
      run: ProcessRun;
      userId?: string;
      notes: string;
      qcPhase?: LotQcPhase;
      status?: LotStatus;
    },
  ) {
    const lotRepo = manager.getRepository(Lot);
    const lot = await lotRepo.save(
      lotRepo.create({
        code: args.code,
        itemId: args.itemId,
        locationId: args.locationId,
        form: args.form,
        grade: args.grade ?? args.parent.grade,
        cropYear: args.parent.cropYear,
        variety: args.parent.variety,
        processMethod: args.processMethod,
        region: args.parent.region,
        zone: args.parent.zone,
        woreda: args.parent.woreda,
        kebele: args.parent.kebele,
        moisturePercent: args.parent.moisturePercent,
        ectaCertificateNumber: args.parent.ectaCertificateNumber,
        ectaTestedAt: args.parent.ectaTestedAt,
        ectaGrade: args.parent.ectaGrade,
        ectaMoisturePercent: args.parent.ectaMoisturePercent,
        ectaCuppingScore: args.parent.ectaCuppingScore,
        ectaNotes: args.parent.ectaNotes,
        quantity: args.quantity.toFixed(3),
        status: args.status ?? LotStatus.ACTIVE,
        qcPhase: args.qcPhase ?? LotQcPhase.PROCESSED,
        parentLotId: args.parent.id,
        notes: args.notes,
        createdById: args.userId ?? null,
      }),
    );
    await this.stockService.adjust(
      {
        locationId: args.locationId,
        itemId: args.itemId,
        quantityDelta: args.quantity,
        purchasePrice: args.unitCost,
        lotId: lot.id,
        meta: {
          sourceType:
            args.form === CoffeeForm.REJECT
              ? StockMovementSourceType.REJECTION
              : StockMovementSourceType.PRODUCTION_OUTPUT,
          referenceType: 'process_run',
          referenceId: args.run.id,
          reference: args.run.runNumber,
          batchCode: lot.code,
          grade: lot.grade,
          createdById: args.userId ?? null,
          notes: args.notes,
        },
      },
      manager,
    );
    await manager.getRepository(LotEvent).save(
      manager.getRepository(LotEvent).create({
        lotId: lot.id,
        eventType:
          args.form === CoffeeForm.REJECT
            ? LotEventType.RECEIVING_REJECTED
            : LotEventType.CREATED,
        quantity: lot.quantity,
        toLocationId: args.locationId,
        relatedLotId: args.parent.id,
        notes: args.notes,
        createdById: args.userId ?? null,
        metadata: { processRunId: args.run.id, parentCode: args.parent.code },
      }),
    );
    return lot;
  }

  private async ensureItem(
    manager: EntityManager,
    spec: {
      sku: string;
      description: string;
      unit: string;
      itemType: ItemType;
    },
  ) {
    const repo = manager.getRepository(Item);
    const existing = await repo.findOne({ where: { sku: spec.sku } });
    if (existing) return existing;
    return repo.save(repo.create(spec));
  }

  private async uniqueCode(manager: EntityManager, base: string) {
    const repo = manager.getRepository(Lot);
    let code = base.slice(0, 40);
    let n = 2;
    while (await repo.findOne({ where: { code } })) {
      const suffix = `-${n}`;
      code = `${base.slice(0, 40 - suffix.length)}${suffix}`;
      n += 1;
    }
    return code;
  }
}

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function doniyaSplit(availableKg: number, kgPerDoniya: number) {
  const full = Math.floor((availableKg + 1e-9) / kgPerDoniya);
  const packagedKg = round3(full * kgPerDoniya);
  const remainderKg = round3(Math.max(0, availableKg - packagedKg));
  return { full, packagedKg, remainderKg };
}
