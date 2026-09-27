import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  CoffeeForm,
  DocumentStatus,
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
import { SaleLine } from '../database/entities/sale-line.entity';
import { User } from '../database/entities/user.entity';
import { StockService } from '../inventory/stock.service';
import { SubmitLocalStageDto } from './dto/local-stage.dto';
import {
  LOCAL_MARKET_STAGES,
  LocalMarketStage,
  LocalStagePack,
  LocalStageResult,
  cleaningWarnings,
  lossPercent,
} from './local-market.stages';

const OPEN_STATUSES = [
  ProcessRunStatus.DRAFT,
  ProcessRunStatus.IN_PROGRESS,
  ProcessRunStatus.QC_HOLD,
  ProcessRunStatus.READY,
];

@Injectable()
export class LocalMarketWorkflowService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
  ) {}

  async submit(id: string, dto: SubmitLocalStageDto, userId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProcessRun);
      const run = await runRepo.findOne({
        where: { id },
        relations: { inputLot: true },
      });
      if (!run) throw new NotFoundException('Process run not found');
      if (run.workflow !== PurchaseType.LOCAL) {
        throw new BadRequestException(
          'This stage flow is only for local market processing',
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
      const stage = stages[run.currentStageIndex];
      if (!stage) {
        throw new BadRequestException('Local market processing is already finished');
      }

      const user = userId
        ? await manager.getRepository(User).findOne({ where: { id: userId } })
        : null;
      const actor = user?.fullName ?? null;

      const result =
        stage === 'Processing Started'
          ? await this.recordProcessingStarted(manager, run, dto, userId, actor)
          : stage === 'Cleaning'
            ? await this.recordCleaning(manager, run, dto, userId, actor)
            : stage === 'Roast & Ground'
              ? await this.recordRoast(manager, run, dto, userId, actor)
              : stage === 'Sales Store'
                ? await this.recordSalesStore(manager, run, dto, userId, actor)
                : null;
      if (!result) {
        throw new BadRequestException(`Stage ${stage} is not part of this run`);
      }

      const results = [...(run.stageResults ?? []), result];
      run.stageResults = results;
      run.stages = stages;
      run.stagesCompleted = [...(run.stagesCompleted ?? []), stage];
      run.currentStageIndex += 1;
      const removedTotal = results.reduce(
        (sum, row) => sum + parseFloat(row.removedQty || '0'),
        0,
      );
      run.quantityReject = removedTotal.toFixed(3);

      if (run.currentStageIndex >= stages.length) {
        run.status = ProcessRunStatus.COMPLETED;
        run.completedAt = new Date();
        run.quantityOutput = result.outputQty;
        run.outputLotId = result.outputLotId;
        const input = parseFloat(results[0]?.inputQty ?? '0');
        const packed = parseFloat(result.outputQty || '0');
        run.actualYieldPercent =
          input > 0 ? ((packed / input) * 100).toFixed(2) : null;
      }
      if (dto.notes) run.notes = dto.notes;
      await runRepo.save(run);
    });
  }

  async view(run: ProcessRun) {
    const results = run.stageResults ?? [];
    const stages = this.stagesFor(run);
    const stage = stages[run.currentStageIndex] ?? null;
    let availableInputKg = '0.000';
    if (stage === 'Cleaning') {
      if ((run.inputLines ?? []).length > 0) {
        availableInputKg = run.quantityInput;
      } else if (run.inputLotId) {
        const lot = await this.dataSource
          .getRepository(Lot)
          .findOne({ where: { id: run.inputLotId } });
        if (lot) {
          availableInputKg = (
            await this.maxTake(this.dataSource.manager, lot, run.id)
          ).toFixed(3);
        }
      }
    }
    const cleaning = results.find((row) => row.stage === 'Cleaning');
    const roast = results.find((row) => row.stage === 'Roast & Ground');
    const sales = results.find((row) => row.stage === 'Sales Store');
    const split =
      roast?.roastQty != null || roast?.groundQty != null;
    return {
      stages,
      nextStage: stage,
      availableInputKg,
      cleaningOutputKg: cleaning?.outputQty ?? null,
      roastOutputKg: roast?.outputQty ?? null,
      roastPackKg: split ? (roast?.roastQty ?? '0.000') : null,
      groundPackKg: split ? (roast?.groundQty ?? '0.000') : null,
      salesStore: sales ? await this.salesStoreSummary(sales) : null,
    };
  }

  private stagesFor(run: ProcessRun): string[] {
    const stored = Array.isArray(run.stages)
      ? run.stages.filter((stage) => stage.trim().length > 0)
      : [];
    if (stored.length > 0) return stored;
    return [...LOCAL_MARKET_STAGES];
  }

  private async recordProcessingStarted(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitLocalStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<LocalStageResult> {
    const input = parseFloat(run.quantityInput);
    if (!(input > 0)) {
      throw new BadRequestException('This run has no input quantity');
    }
    if (Math.abs(dto.inputQty - input) > 0.001) {
      throw new BadRequestException(
        `Processing started with the ${input.toFixed(3)} kg taken from the warehouse`,
      );
    }
    if ((dto.removedQty ?? 0) > 0.001) {
      throw new BadRequestException(
        'Processing Started does not remove quantity',
      );
    }
    const lot = await manager
      .getRepository(Lot)
      .findOne({ where: { id: run.inputLotId } });
    return this.result(
      'Processing Started',
      input,
      0,
      input,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: lot?.id ?? run.inputLotId,
        outputLotCode: lot?.code ?? null,
        warnings: [],
      },
    );
  }

  private async recordCleaning(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitLocalStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<LocalStageResult> {
    const lotRepo = manager.getRepository(Lot);
    const source = await lotRepo.findOne({ where: { id: run.inputLotId } });
    if (!source) throw new NotFoundException('Purchase lot not found');
    if (!source.itemId) {
      throw new BadRequestException('The purchase lot has no catalog item');
    }
    const input = dto.inputQty;
    const removed = dto.removedQty ?? 0;
    if (removed - input > 1e-9) {
      throw new BadRequestException('Removed quantity cannot exceed the input');
    }
    const output = round3(input - removed);
    if (output <= 0) {
      throw new BadRequestException(
        'Final quantity after cleaning must be greater than 0',
      );
    }
    const alreadyTaken = (run.inputLines ?? []).length > 0;
    if (alreadyTaken) {
      const committed = parseFloat(run.quantityInput);
      if (Math.abs(input - committed) > 0.001) {
        throw new BadRequestException(
          `Cleaning must use the ${committed.toFixed(3)} kg already taken from the warehouse`,
        );
      }
    } else {
      const max = await this.maxTake(manager, source, run.id);
      if (input - max > 1e-6) {
        throw new BadRequestException(
          `Only ${max.toFixed(3)} kg is available on ${source.code}`,
        );
      }
    }

    const unitCost = await this.unitCost(
      manager,
      run.locationId,
      source.itemId,
      source.id,
    );
    if (!alreadyTaken) {
      await this.consumeLot(manager, source, input, run, userId, 'Cleaning input');
    }
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
      code: await this.uniqueCode(manager, `${source.code}-CLN`),
      itemId: source.itemId,
      locationId: run.locationId,
      form: CoffeeForm.GREEN,
      quantity: output,
      parent: source,
      grade: source.grade,
      processMethod: 'Cleaning',
      unitCost,
      run,
      userId,
      notes: `Cleaned output of ${run.runNumber}`,
    });

    return this.result('Cleaning', input, removed, output, userId, actor, dto.notes, {
      outputLotId: cleaned.id,
      outputLotCode: cleaned.code,
      rejectLotId: reject?.id ?? null,
      rejectLotCode: reject?.code ?? null,
      warnings: cleaningWarnings(input, output),
    });
  }

  private async recordRoast(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitLocalStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<LocalStageResult> {
    const cleaning = this.previous(run, 'Cleaning');
    const lotRepo = manager.getRepository(Lot);
    const cleaned = await lotRepo.findOne({
      where: { id: cleaning.outputLotId! },
    });
    if (!cleaned) throw new NotFoundException('Cleaned lot not found');
    const input = dto.inputQty;
    const available = parseFloat(cleaned.quantity);
    if (input - available > 1e-6) {
      throw new BadRequestException(
        `Roast input cannot exceed the ${available.toFixed(3)} kg from cleaning`,
      );
    }
    const split = dto.roastQty != null || dto.groundQty != null;
    if (split) {
      return this.recordRoastSplit(
        manager,
        run,
        cleaned,
        input,
        dto,
        userId,
        actor,
      );
    }
    const removed = dto.removedQty ?? 0;
    if (removed - input > 1e-9) {
      throw new BadRequestException('Removed quantity cannot exceed the input');
    }
    const output = round3(input - removed);
    if (output <= 0) {
      throw new BadRequestException(
        'Final roast & ground quantity must be greater than 0',
      );
    }

    const item = await this.ensureItem(manager, {
      sku: 'COF-ROAST-GROUND',
      description: 'Roast & ground coffee (bulk)',
      unit: 'kg',
      itemType: ItemType.FINISHED,
    });
    const unitCost = cleaned.itemId
      ? await this.unitCost(manager, run.locationId, cleaned.itemId, cleaned.id)
      : 0;
    await this.consumeLot(manager, cleaned, input, run, userId, 'Roast & ground input');
    const reject = await this.bookReject(
      manager,
      cleaned,
      removed,
      run,
      `${run.runNumber}-RG-RJ`,
      run.locationId,
      userId,
      'Roast & ground loss moved to the reject store',
    );
    const roasted = await this.receiveLot(manager, {
      code: await this.uniqueCode(manager, `${run.runNumber}-RG`),
      itemId: item.id,
      locationId: run.locationId,
      form: CoffeeForm.ROASTED,
      quantity: output,
      parent: cleaned,
      grade: cleaned.grade,
      processMethod: 'Roast & Ground',
      unitCost,
      run,
      userId,
      notes: `Roast & ground output of ${run.runNumber}`,
    });

    return this.result('Roast & Ground', input, removed, output, userId, actor, dto.notes, {
      outputLotId: roasted.id,
      outputLotCode: roasted.code,
      rejectLotId: reject?.id ?? null,
      rejectLotCode: reject?.code ?? null,
      warnings: [],
    });
  }

  private async recordRoastSplit(
    manager: EntityManager,
    run: ProcessRun,
    cleaned: Lot,
    input: number,
    dto: SubmitLocalStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<LocalStageResult> {
    const roastQty = round3(dto.roastQty ?? 0);
    const groundQty = round3(dto.groundQty ?? 0);
    const allocated = round3(roastQty + groundQty);
    if (allocated <= 0) {
      throw new BadRequestException(
        'Enter kilograms for roast coffee packaging, ground coffee packaging, or both',
      );
    }
    if (allocated - input > 1e-6) {
      throw new BadRequestException(
        `Roast and ground packaging total ${allocated.toFixed(3)} kg, which is more than the ${input.toFixed(3)} kg from cleaning`,
      );
    }
    const unallocated = round3(input - allocated);
    const unitCost = cleaned.itemId
      ? await this.unitCost(manager, run.locationId, cleaned.itemId, cleaned.id)
      : 0;
    await this.consumeLot(
      manager,
      cleaned,
      allocated,
      run,
      userId,
      'Allocated to roast and ground packaging',
    );

    let roasted: Lot | null = null;
    if (roastQty > 0) {
      const item = await this.ensureItem(manager, {
        sku: 'COF-ROAST',
        description: 'Roast coffee (bulk)',
        unit: 'kg',
        itemType: ItemType.FINISHED,
      });
      roasted = await this.receiveLot(manager, {
        code: await this.uniqueCode(manager, `${run.runNumber}-ROAST`),
        itemId: item.id,
        locationId: run.locationId,
        form: CoffeeForm.ROASTED,
        quantity: roastQty,
        parent: cleaned,
        grade: cleaned.grade,
        processMethod: 'Roast coffee',
        unitCost,
        run,
        userId,
        notes: `Roast coffee packaging allocation of ${run.runNumber}`,
      });
    }

    let ground: Lot | null = null;
    if (groundQty > 0) {
      const item = await this.ensureItem(manager, {
        sku: 'COF-GROUND',
        description: 'Ground coffee (bulk)',
        unit: 'kg',
        itemType: ItemType.FINISHED,
      });
      ground = await this.receiveLot(manager, {
        code: await this.uniqueCode(manager, `${run.runNumber}-GROUND`),
        itemId: item.id,
        locationId: run.locationId,
        form: CoffeeForm.FLOUR,
        quantity: groundQty,
        parent: cleaned,
        grade: cleaned.grade,
        processMethod: 'Ground coffee',
        unitCost,
        run,
        userId,
        notes: `Ground coffee packaging allocation of ${run.runNumber}`,
      });
    }

    const primary = roasted ?? ground;
    return this.result(
      'Roast & Ground',
      input,
      0,
      allocated,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: primary?.id ?? null,
        outputLotCode: primary?.code ?? null,
        rejectLotId: null,
        rejectLotCode: null,
        warnings: [],
        roastQty: roastQty.toFixed(3),
        groundQty: groundQty.toFixed(3),
        roastLotId: roasted?.id ?? null,
        roastLotCode: roasted?.code ?? null,
        groundLotId: ground?.id ?? null,
        groundLotCode: ground?.code ?? null,
        unallocatedKg: unallocated.toFixed(3),
      },
    );
  }

  private async recordSalesStore(
    manager: EntityManager,
    run: ProcessRun,
    dto: SubmitLocalStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<LocalStageResult> {
    const roast = this.previous(run, 'Roast & Ground');
    if (roast.roastLotId || roast.groundLotId) {
      return this.recordSplitSalesStore(manager, run, roast, dto, userId, actor);
    }
    const lotRepo = manager.getRepository(Lot);
    const bulk = await lotRepo.findOne({ where: { id: roast.outputLotId! } });
    if (!bulk) throw new NotFoundException('Roast & ground lot not found');
    const available = parseFloat(bulk.quantity);
    const packs = dto.packs ?? [];
    const countOf = (size: number) =>
      packs.find((pack) => pack.sizeKg === size)?.count ?? 0;
    const count1 = countOf(1);
    const countHalf = countOf(0.5);
    const packagedKg = round3(count1 * 1 + countHalf * 0.5);
    if (packagedKg <= 0) {
      throw new BadRequestException('Enter at least one 1 kg or 0.5 kg package');
    }
    if (packagedKg - available > 1e-6) {
      throw new BadRequestException(
        `Packages need ${packagedKg.toFixed(3)} kg but only ${available.toFixed(3)} kg is ready`,
      );
    }
    const remainder = round3(available - packagedKg);
    const showroom = await manager.getRepository(Location).findOne({
      where: { type: LocationType.SHOWROOM, isActive: true },
      order: { name: 'ASC' },
    });
    const storeId = showroom?.id ?? run.locationId;
    const unitCost = bulk.itemId
      ? await this.unitCost(manager, bulk.locationId ?? run.locationId, bulk.itemId, bulk.id)
      : 0;

    await this.consumeLot(
      manager,
      bulk,
      packagedKg,
      run,
      userId,
      'Packaged into the sales store',
    );

    const savedPacks: LocalStagePack[] = [];
    if (count1 > 0) {
      const item = await this.ensureItem(manager, {
        sku: 'COF-ROAST-1KG',
        description: 'Roast & ground 1 kg',
        unit: 'pcs',
        itemType: ItemType.FINISHED,
      });
      const lot = await this.receiveLot(manager, {
        code: await this.uniqueCode(manager, `${run.runNumber}-1KG`),
        itemId: item.id,
        locationId: storeId,
        form: CoffeeForm.PACKAGED,
        quantity: count1,
        parent: bulk,
        grade: bulk.grade,
        processMethod: '1 kg',
        unitCost,
        run,
        userId,
        notes: `${count1} × 1 kg in the sales store`,
      });
      savedPacks.push({
        sizeKg: 1,
        count: count1,
        lotId: lot.id,
        lotCode: lot.code,
        sku: item.sku ?? 'COF-ROAST-1KG',
      });
    }
    if (countHalf > 0) {
      const item = await this.ensureItem(manager, {
        sku: 'COF-ROAST-500',
        description: 'Roast & ground 0.5 kg',
        unit: 'pcs',
        itemType: ItemType.FINISHED,
      });
      const lot = await this.receiveLot(manager, {
        code: await this.uniqueCode(manager, `${run.runNumber}-500`),
        itemId: item.id,
        locationId: storeId,
        form: CoffeeForm.PACKAGED,
        quantity: countHalf,
        parent: bulk,
        grade: bulk.grade,
        processMethod: '0.5 kg',
        unitCost: unitCost / 2,
        run,
        userId,
        notes: `${countHalf} × 0.5 kg in the sales store`,
      });
      savedPacks.push({
        sizeKg: 0.5,
        count: countHalf,
        lotId: lot.id,
        lotCode: lot.code,
        sku: item.sku ?? 'COF-ROAST-500',
      });
    }

    const primary = savedPacks[0];
    return this.result(
      'Sales Store',
      available,
      0,
      packagedKg,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: primary?.lotId ?? null,
        outputLotCode: primary?.lotCode ?? null,
        rejectLotId: null,
        rejectLotCode: null,
        warnings: [],
        packs: savedPacks,
        remainderKg: remainder.toFixed(3),
      },
    );
  }

  private async recordSplitSalesStore(
    manager: EntityManager,
    run: ProcessRun,
    roast: LocalStageResult,
    dto: SubmitLocalStageDto,
    userId: string | undefined,
    actor: string | null,
  ): Promise<LocalStageResult> {
    const streams: Array<{
      kind: 'ROAST' | 'GROUND';
      lotId: string;
      label: string;
    }> = [];
    if (roast.roastLotId) {
      streams.push({
        kind: 'ROAST',
        lotId: roast.roastLotId,
        label: 'Roast coffee',
      });
    }
    if (roast.groundLotId) {
      streams.push({
        kind: 'GROUND',
        lotId: roast.groundLotId,
        label: 'Ground coffee',
      });
    }
    const packs = dto.packs ?? [];
    const showroom = await manager.getRepository(Location).findOne({
      where: { type: LocationType.SHOWROOM, isActive: true },
      order: { name: 'ASC' },
    });
    const storeId = showroom?.id ?? run.locationId;
    const lotRepo = manager.getRepository(Lot);
    const savedPacks: LocalStagePack[] = [];
    let packagedTotal = 0;
    let inputTotal = 0;
    let roastRemainder = 0;
    let groundRemainder = 0;

    for (const stream of streams) {
      const bulk = await lotRepo.findOne({ where: { id: stream.lotId } });
      if (!bulk) {
        throw new NotFoundException(`${stream.label} lot not found`);
      }
      const available = parseFloat(bulk.quantity);
      inputTotal = round3(inputTotal + available);
      const countOf = (size: number) =>
        packs
          .filter((pack) => pack.kind === stream.kind && pack.sizeKg === size)
          .reduce((sum, pack) => sum + pack.count, 0);
      const count1 = countOf(1);
      const countHalf = countOf(0.5);
      const packagedKg = round3(count1 + countHalf * 0.5);
      if (packagedKg - available > 1e-6) {
        throw new BadRequestException(
          `${stream.label} packages need ${packagedKg.toFixed(3)} kg but only ${available.toFixed(3)} kg was allocated`,
        );
      }
      const remainder = round3(available - packagedKg);
      if (stream.kind === 'ROAST') roastRemainder = remainder;
      else groundRemainder = remainder;
      if (packagedKg <= 0) continue;

      const unitCost = bulk.itemId
        ? await this.unitCost(
            manager,
            bulk.locationId ?? run.locationId,
            bulk.itemId,
            bulk.id,
          )
        : 0;
      await this.consumeLot(
        manager,
        bulk,
        packagedKg,
        run,
        userId,
        `${stream.label} packaged into the sales store`,
      );
      const specs = [
        count1 > 0
          ? {
              count: count1,
              sizeKg: 1 as const,
              sku: stream.kind === 'ROAST' ? 'COF-ROAST-1KG' : 'COF-GROUND-1KG',
              description:
                stream.kind === 'ROAST'
                  ? 'Roast coffee 1 kg'
                  : 'Ground coffee 1 kg',
              code:
                stream.kind === 'ROAST'
                  ? `${run.runNumber}-ROAST-1KG`
                  : `${run.runNumber}-GROUND-1KG`,
              unitCost,
            }
          : null,
        countHalf > 0
          ? {
              count: countHalf,
              sizeKg: 0.5 as const,
              sku:
                stream.kind === 'ROAST' ? 'COF-ROAST-500' : 'COF-GROUND-500',
              description:
                stream.kind === 'ROAST'
                  ? 'Roast coffee 0.5 kg'
                  : 'Ground coffee 0.5 kg',
              code:
                stream.kind === 'ROAST'
                  ? `${run.runNumber}-ROAST-500`
                  : `${run.runNumber}-GROUND-500`,
              unitCost: unitCost / 2,
            }
          : null,
      ];
      for (const spec of specs) {
        if (!spec) continue;
        const item = await this.ensureItem(manager, {
          sku: spec.sku,
          description: spec.description,
          unit: 'pcs',
          itemType: ItemType.FINISHED,
        });
        const lot = await this.receiveLot(manager, {
          code: await this.uniqueCode(manager, spec.code),
          itemId: item.id,
          locationId: storeId,
          form: CoffeeForm.PACKAGED,
          quantity: spec.count,
          parent: bulk,
          grade: bulk.grade,
          processMethod: `${spec.sizeKg} kg`,
          unitCost: spec.unitCost,
          run,
          userId,
          notes: `${spec.count} × ${spec.sizeKg} kg ${stream.label.toLowerCase()} in the sales store`,
        });
        savedPacks.push({
          sizeKg: spec.sizeKg,
          count: spec.count,
          lotId: lot.id,
          lotCode: lot.code,
          sku: item.sku ?? spec.sku,
          kind: stream.kind,
        });
      }
      packagedTotal = round3(packagedTotal + packagedKg);
    }

    if (packagedTotal <= 0) {
      throw new BadRequestException('Enter at least one 1 kg or 0.5 kg package');
    }
    const primary = savedPacks[0];
    return this.result(
      'Sales Store',
      inputTotal,
      0,
      packagedTotal,
      userId,
      actor,
      dto.notes,
      {
        outputLotId: primary?.lotId ?? null,
        outputLotCode: primary?.lotCode ?? null,
        rejectLotId: null,
        rejectLotCode: null,
        warnings: [],
        packs: savedPacks,
        remainderKg: round3(roastRemainder + groundRemainder).toFixed(3),
        roastRemainderKg: roastRemainder.toFixed(3),
        groundRemainderKg: groundRemainder.toFixed(3),
      },
    );
  }

  private async salesStoreSummary(stage: LocalStageResult) {
    const packs: Array<{
      sizeKg: number;
      produced: number;
      onHand: number;
      sold: number;
      lotId: string;
      lotCode: string;
      sku: string;
      kind: 'ROAST' | 'GROUND' | null;
      locationName: string | null;
    }> = [];
    for (const pack of stage.packs ?? []) {
      const lot = await this.dataSource
        .getRepository(Lot)
        .findOne({ where: { id: pack.lotId }, relations: { location: true } });
      const soldRow = await this.dataSource
        .getRepository(SaleLine)
        .createQueryBuilder('line')
        .innerJoin('line.sale', 'sale')
        .select('COALESCE(SUM(line.quantity::numeric), 0)', 'sold')
        .where('line.lot_id = :lotId', { lotId: pack.lotId })
        .andWhere('sale.status <> :voided', { voided: DocumentStatus.VOIDED })
        .getRawOne<{ sold: string }>();
      packs.push({
        sizeKg: pack.sizeKg,
        produced: pack.count,
        onHand: lot ? parseFloat(lot.quantity) : 0,
        sold: parseFloat(soldRow?.sold ?? '0') || 0,
        lotId: pack.lotId,
        lotCode: pack.lotCode,
        sku: pack.sku,
        kind: pack.kind ?? null,
        locationName: lot?.location?.name ?? null,
      });
    }
    return {
      packs,
      remainderKg: stage.remainderKg ?? '0.000',
      roastRemainderKg: stage.roastRemainderKg ?? null,
      groundRemainderKg: stage.groundRemainderKg ?? null,
    };
  }

  private previous(run: ProcessRun, stage: LocalMarketStage): LocalStageResult {
    const found = (run.stageResults ?? []).find((row) => row.stage === stage);
    if (!found?.outputLotId) {
      throw new BadRequestException(`Finish ${stage} before this step`);
    }
    return found;
  }

  private result(
    stage: LocalMarketStage,
    input: number,
    removed: number,
    output: number,
    userId: string | undefined,
    actor: string | null,
    notes: string | undefined,
    extra: Partial<LocalStageResult>,
  ): LocalStageResult {
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
      packs: extra.packs,
      remainderKg: extra.remainderKg,
      roastQty: extra.roastQty,
      groundQty: extra.groundQty,
      roastLotId: extra.roastLotId ?? null,
      roastLotCode: extra.roastLotCode ?? null,
      groundLotId: extra.groundLotId ?? null,
      groundLotCode: extra.groundLotCode ?? null,
      unallocatedKg: extra.unallocatedKg,
      roastRemainderKg: extra.roastRemainderKg,
      groundRemainderKg: extra.groundRemainderKg,
    };
  }

  private async maxTake(manager: EntityManager, lot: Lot, excludeRunId: string) {
    const reserved = await this.reservedExcept(manager, lot.id, excludeRunId);
    return Math.max(0, parseFloat(lot.quantity) - reserved);
  }

  private async reservedExcept(
    manager: EntityManager,
    lotId: string,
    excludeRunId: string,
  ) {
    const row = await manager
      .getRepository(ProcessRun)
      .createQueryBuilder('run')
      .select('COALESCE(SUM(run.quantity_input::numeric), 0)', 'reserved')
      .where('run.input_lot_id = :lotId', { lotId })
      .andWhere('run.id <> :excludeRunId', { excludeRunId })
      .andWhere('run.status IN (:...open)', { open: OPEN_STATUSES })
      .andWhere(
        `(run.workflow IS DISTINCT FROM 'LOCAL' OR COALESCE(jsonb_array_length(run.stage_results), 0) = 0)`,
      )
      .getRawOne<{ reserved: string }>();
    return parseFloat(row?.reserved ?? '0') || 0;
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
    if (!lot.itemId) {
      throw new BadRequestException('Lot has no catalog item');
    }
    const locationId = lot.locationId ?? run.locationId;
    const left = parseFloat(lot.quantity) - qty;
    if (left < -1e-6) {
      throw new BadRequestException(`Lot ${lot.code} does not have ${qty.toFixed(3)} kg`);
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
