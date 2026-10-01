import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import {
  CoffeeForm,
  ItemType,
  LotEventType,
  LotQcPhase,
  LotStatus,
  ProcessOperationType,
  ProcessRunStatus,
  PurchaseType,
  StockMovementDirection,
  StockMovementSourceType,
} from '../common/enums';
import {
  applyDateRangeToQb,
  applyIlikeSearch,
  paginatedQueryBuilder,
} from '../common/utils/query.util';
import { Item } from '../database/entities/item.entity';
import { Location } from '../database/entities/location.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { ProcessTemplate } from '../database/entities/process-template.entity';
import { QcResult } from '../database/entities/qc-result.entity';
import { RoastProfile } from '../database/entities/roast-profile.entity';
import { StockMovement } from '../database/entities/stock-movement.entity';
import { StockService } from '../inventory/stock.service';
import { ProcessRunListQueryDto } from './dto/process-run-list-query.dto';
import { EXPORT_MARKET_STAGES } from './export-market.stages';
import { LOCAL_MARKET_STAGES } from './local-market.stages';
import { summarizeProcessRuns } from './process-summary';
import {
  CompleteProcessRunDto,
  CreateProcessRunDto,
  CreateProcessTemplateDto,
  SubmitQcDto,
} from './dto/process-run.dto';

export const LOCAL_MARKET_WORKFLOW_CODE = 'LOCAL-MARKET';
export const EXPORT_WORKFLOW_CODE = 'EXPORT-MARKET';

const OPEN_RUN_STATUSES = [
  ProcessRunStatus.DRAFT,
  ProcessRunStatus.IN_PROGRESS,
  ProcessRunStatus.QC_HOLD,
  ProcessRunStatus.READY,
];

export function workflowTemplateCode(purchaseType: PurchaseType): string {
  return purchaseType === PurchaseType.EXPORT
    ? EXPORT_WORKFLOW_CODE
    : LOCAL_MARKET_WORKFLOW_CODE;
}

const RUN_RELATIONS = {
  template: true,
  inputLot: true,
  outputLot: true,
  location: true,
  createdBy: true,
  roastProfile: true,
  qcResults: { createdBy: true },
} as const;

@Injectable()
export class ProcessRunsService implements OnModuleInit {
  private readonly logger = new Logger(ProcessRunsService.name);

  constructor(
    @InjectRepository(ProcessRun)
    private readonly runRepo: Repository<ProcessRun>,
    @InjectRepository(ProcessTemplate)
    private readonly templateRepo: Repository<ProcessTemplate>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(QcResult)
    private readonly qcRepo: Repository<QcResult>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
  ) {}

  async onModuleInit() {
    try {
      await this.releaseQueuedPurchaseRuns();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Queued purchase runs were not released: ${message}`);
    }
  }

  listTemplates() {
    return this.templateRepo.find({
      where: { isActive: true },
      relations: { inputItem: true, outputItem: true },
      order: { name: 'ASC' },
    });
  }

  async createTemplate(dto: CreateProcessTemplateDto) {
    const existing = await this.templateRepo.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Template code ${dto.code} already exists`);
    }
    return this.templateRepo.save(
      this.templateRepo.create({
        code: dto.code,
        name: dto.name,
        inputForm: dto.inputForm,
        outputForm: dto.outputForm,
        operationType: dto.operationType ?? ProcessOperationType.OTHER,
        packSizeKg:
          dto.packSizeKg !== undefined ? dto.packSizeKg.toFixed(3) : null,
        expectedYieldPercent: dto.expectedYieldPercent.toFixed(2),
        requiresQc: dto.requiresQc ?? true,
        stages: dto.stages ?? [],
        inputItemId: dto.inputItemId ?? null,
        outputItemId: dto.outputItemId ?? null,
        maxMoisturePercent:
          dto.maxMoisturePercent !== undefined
            ? dto.maxMoisturePercent.toFixed(2)
            : null,
        notes: dto.notes ?? null,
        workflow: dto.workflow ?? null,
        isActive: true,
      }),
    );
  }

  findAll(query: ProcessRunListQueryDto) {
    const qb = this.runRepo
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.template', 'template')
      .leftJoinAndSelect('run.inputLot', 'inputLot')
      .leftJoinAndSelect('run.outputLot', 'outputLot')
      .leftJoinAndSelect('run.location', 'location')
      .orderBy('run.created_at', 'DESC');

    if (query.locationId) {
      qb.andWhere('run.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.templateId) {
      qb.andWhere('run.template_id = :templateId', {
        templateId: query.templateId,
      });
    }
    if (query.status) {
      qb.andWhere('run.status = :status', { status: query.status });
    }
    if (query.workflow) {
      qb.andWhere('run.workflow = :workflow', { workflow: query.workflow });
    }
    if (query.stage) {
      qb.andWhere('run.status IN (:...openStatuses)', {
        openStatuses: OPEN_RUN_STATUSES,
      });
      qb.andWhere('run.stages ->> run.current_stage_index = :stage', {
        stage: query.stage,
      });
    }
    applyDateRangeToQb(qb, 'run.created_at', query.from, query.to);
    applyIlikeSearch(qb, query.search, [
      'run.run_number',
      'template.name',
      'template.code',
      'inputLot.code',
      'outputLot.code',
    ]);
    return paginatedQueryBuilder(qb, query.page, query.limit);
  }

  async summary(query: ProcessRunListQueryDto) {
    const qb = this.runRepo
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.inputLot', 'inputLot')
      .leftJoinAndSelect('run.location', 'location')
      .orderBy('run.created_at', 'DESC');
    if (query.locationId) {
      qb.andWhere('run.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.workflow) {
      qb.andWhere('run.workflow = :workflow', { workflow: query.workflow });
    }
    const runs = await qb.getMany();
    return summarizeProcessRuns(runs, { from: query.from, to: query.to });
  }

  async findOne(id: string) {
    const run = await this.runRepo.findOne({
      where: { id },
      relations: RUN_RELATIONS,
    });
    if (!run) throw new NotFoundException('Process run not found');
    return run;
  }

  async create(dto: CreateProcessRunDto, userId?: string) {
    const template = await this.templateRepo.findOne({
      where: { id: dto.templateId, isActive: true },
    });
    if (!template) throw new BadRequestException('Process template not found');

    if (dto.inputs?.length) {
      return this.createWithInputs(dto, template, userId);
    }
    if (!dto.inputLotId || dto.quantityInput == null) {
      throw new BadRequestException('Select at least one stock lot and quantity');
    }

    const inputLot = await this.lotRepo.findOne({
      where: { id: dto.inputLotId },
    });
    if (!inputLot) throw new BadRequestException('Input lot not found');
    if (inputLot.status !== LotStatus.ACTIVE) {
      throw new BadRequestException('Input lot must be ACTIVE');
    }
    if (!template.workflow && inputLot.form !== template.inputForm) {
      throw new BadRequestException(
        `Lot form is ${inputLot.form}; template expects ${template.inputForm}`,
      );
    }
    const available = parseFloat(inputLot.quantity);
    if (dto.quantityInput > available + 1e-9) {
      throw new BadRequestException(
        `Insufficient lot quantity. Available: ${available}`,
      );
    }

    const location = await this.locationRepo.findOne({
      where: { id: dto.locationId },
    });
    if (!location) throw new BadRequestException('Location not found');

    const count = await this.runRepo.count();
    const runNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const run = await this.runRepo.save(
      this.runRepo.create({
        runNumber,
        templateId: template.id,
        inputLotId: inputLot.id,
        locationId: dto.locationId,
        quantityInput: dto.quantityInput.toFixed(3),
        quantityReject: '0.000',
        expectedYieldPercent: template.expectedYieldPercent,
        status: ProcessRunStatus.DRAFT,
        currentStageIndex: 0,
        stages: Array.isArray(template.stages) ? template.stages : [],
        stagesCompleted: [],
        stageResults: [],
        inputLines: [],
        processCost: (dto.processCost ?? 0).toFixed(2),
        notes: dto.notes ?? null,
        roastProfileId: dto.roastProfileId ?? null,
        workflow: template.workflow ?? null,
        createdById: userId ?? null,
      }),
    );

    return this.findOne(run.id);
  }

  private async createWithInputs(
    dto: CreateProcessRunDto,
    template: ProcessTemplate,
    userId?: string,
  ) {
    const location = await this.locationRepo.findOne({
      where: { id: dto.locationId },
    });
    if (!location) throw new BadRequestException('Location not found');

    const seen = new Set<string>();
    const picked: Array<{
      lot: Lot;
      quantity: number;
      description: string;
    }> = [];
    for (const input of dto.inputs ?? []) {
      if (seen.has(input.lotId)) {
        throw new BadRequestException('Each lot can only be selected once');
      }
      seen.add(input.lotId);
      const lot = await this.lotRepo.findOne({
        where: { id: input.lotId },
        relations: { item: true },
      });
      if (!lot) throw new BadRequestException('Stock lot not found');
      if (lot.status !== LotStatus.ACTIVE) {
        throw new BadRequestException(`Lot ${lot.code} must be active`);
      }
      if (lot.locationId !== dto.locationId) {
        throw new BadRequestException(
          `Lot ${lot.code} is not in the selected warehouse`,
        );
      }
      if (!template.workflow && lot.form !== template.inputForm) {
        throw new BadRequestException(
          `Lot ${lot.code} is ${lot.form}; template expects ${template.inputForm}`,
        );
      }
      if (
        (template.workflow === PurchaseType.LOCAL ||
          template.workflow === PurchaseType.EXPORT) &&
        this.isProcessedCoffee(lot)
      ) {
        throw new BadRequestException(
          `Lot ${lot.code} is roast & ground or other finished coffee. Choose a warehouse lot.`,
        );
      }
      const available = await this.availableLotKg(lot, dto.locationId);
      if (input.quantity > available + 1e-6) {
        throw new BadRequestException(
          `Lot ${lot.code} has ${available.toFixed(3)} kg available`,
        );
      }
      picked.push({
        lot,
        quantity: input.quantity,
        description: lot.item?.description ?? lot.code,
      });
    }

    const total = picked.reduce((sum, line) => sum + line.quantity, 0);
    const commitStock =
      template.workflow === PurchaseType.LOCAL ||
      template.workflow === PurchaseType.EXPORT;
    const count = await this.runRepo.count();
    const runNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const first = picked[0].lot;

    const runId = await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProcessRun);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      const run = await runRepo.save(
        runRepo.create({
          runNumber,
          templateId: template.id,
          inputLotId: first.id,
          locationId: dto.locationId,
          quantityInput: total.toFixed(3),
          quantityReject: '0.000',
          expectedYieldPercent:
            template.workflow === PurchaseType.LOCAL
              ? '80.00'
              : template.workflow === PurchaseType.EXPORT
                ? '87.00'
                : template.expectedYieldPercent,
          status: commitStock
            ? ProcessRunStatus.IN_PROGRESS
            : ProcessRunStatus.DRAFT,
          startedAt: commitStock ? new Date() : null,
          currentStageIndex: 0,
          stages:
            template.workflow === PurchaseType.LOCAL
              ? [...LOCAL_MARKET_STAGES]
              : template.workflow === PurchaseType.EXPORT
                ? [...EXPORT_MARKET_STAGES]
                : Array.isArray(template.stages)
                  ? template.stages
                  : [],
          stagesCompleted: [],
          stageResults: [],
          inputLines: picked.map((line) => ({
            lotId: line.lot.id,
            itemId: line.lot.itemId ?? '',
            lotCode: line.lot.code,
            itemDescription: line.description,
            quantity: line.quantity.toFixed(3),
          })),
          processCost: (dto.processCost ?? 0).toFixed(2),
          notes: dto.notes ?? null,
          roastProfileId: dto.roastProfileId ?? null,
          workflow: template.workflow ?? null,
          createdById: userId ?? null,
        }),
      );

      if (commitStock) {
        for (const line of picked) {
          if (!line.lot.itemId) {
            throw new BadRequestException(
              `Lot ${line.lot.code} has no catalog item`,
            );
          }
          await this.stockService.adjust(
            {
              locationId: dto.locationId,
              itemId: line.lot.itemId,
              quantityDelta: -line.quantity,
              lotId: line.lot.id,
              meta: {
                sourceType: StockMovementSourceType.PRODUCTION_CONSUMPTION,
                referenceType: 'process_run',
                referenceId: run.id,
                reference: run.runNumber,
                batchCode: line.lot.code,
                grade: line.lot.grade,
                createdById: userId ?? null,
                notes: `Sent ${line.quantity.toFixed(3)} kg from ${line.lot.code} into ${run.runNumber}`,
              },
            },
            manager,
          );
          const lot = await lotRepo.findOne({ where: { id: line.lot.id } });
          if (!lot) throw new NotFoundException('Stock lot not found');
          const left = parseFloat(lot.quantity) - line.quantity;
          if (left < -1e-6) {
            throw new BadRequestException(
              `Lot ${lot.code} no longer has enough kg`,
            );
          }
          lot.quantity = Math.max(0, left).toFixed(3);
          await lotRepo.save(lot);
          await eventRepo.save(
            eventRepo.create({
              lotId: lot.id,
              eventType: LotEventType.PROCESS_STARTED,
              quantity: line.quantity.toFixed(3),
              fromLocationId: dto.locationId,
              notes: `${run.runNumber} took ${line.quantity.toFixed(3)} kg from ${lot.code}`,
              createdById: userId ?? null,
              metadata: {
                processRunId: run.id,
                stage: 'Processing Started',
              },
            }),
          );
        }
      }

      return run.id;
    });

    return this.findOne(runId);
  }

  private isProcessedCoffee(lot: Lot) {
    if (
      lot.form === CoffeeForm.ROASTED ||
      lot.form === CoffeeForm.FLOUR ||
      lot.form === CoffeeForm.PACKAGED
    ) {
      return true;
    }
    if (
      lot.processMethod === 'Roast & Ground' ||
      lot.processMethod === 'Roast coffee' ||
      lot.processMethod === 'Ground coffee' ||
      lot.processMethod === 'Packaging'
    ) {
      return true;
    }
    const sku = lot.item?.sku?.trim().toUpperCase() ?? '';
    if (
      sku.startsWith('COF-ROAST') ||
      sku.startsWith('COF-GROUND') ||
      sku === 'COF-REJECT'
    ) {
      return true;
    }
    return lot.item?.itemType === ItemType.FINISHED;
  }

  private async availableLotKg(lot: Lot, locationId: string) {
    if (!lot.itemId) return 0;
    const stock = await this.stockService.getStock(
      locationId,
      lot.itemId,
      undefined,
      lot.id,
    );
    if (!stock) return 0;
    const reserved = parseFloat(stock.reservedQuantity ?? '0');
    const onHand = parseFloat(stock.quantity) - reserved;
    const held = await this.openReservedKg(this.dataSource.manager, lot.id);
    return Math.max(0, Math.min(parseFloat(lot.quantity), onHand) - held);
  }

  async start(id: string, userId?: string) {
    const run = await this.findOne(id);
    if (run.status !== ProcessRunStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT runs can be started');
    }

    await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProcessRun);
      const eventRepo = manager.getRepository(LotEvent);

      run.status = ProcessRunStatus.IN_PROGRESS;
      run.startedAt = new Date();

      const stages = run.stages ?? [];
      if (stages.length === 0 && !run.workflow) {
        run.status = run.template.requiresQc
          ? ProcessRunStatus.QC_HOLD
          : ProcessRunStatus.READY;
      }
      await runRepo.save(run);

      await eventRepo.save(
        eventRepo.create({
          lotId: run.inputLotId,
          eventType: LotEventType.PROCESS_STARTED,
          quantity: run.quantityInput,
          toLocationId: run.locationId,
          notes: `Process ${run.runNumber} started (${run.template.name})`,
          createdById: userId ?? null,
          metadata: { processRunId: run.id, templateCode: run.template.code },
        }),
      );

      if (stages.length === 0 && run.template.requiresQc && !run.workflow) {
        const lotRepo = manager.getRepository(Lot);
        const lot = await lotRepo.findOne({ where: { id: run.inputLotId } });
        if (lot) {
          lot.status = LotStatus.HOLD;
          await lotRepo.save(lot);
          await eventRepo.save(
            eventRepo.create({
              lotId: lot.id,
              eventType: LotEventType.QC_HELD,
              quantity: run.quantityInput,
              notes: `Awaiting QC for ${run.runNumber}`,
              createdById: userId ?? null,
              metadata: { processRunId: run.id },
            }),
          );
        }
      }
    });

    return this.findOne(id);
  }

  async completeStage(id: string, userId?: string) {
    const run = await this.findOne(id);
    this.assertMillStage(run);
    if (
      run.status !== ProcessRunStatus.IN_PROGRESS &&
      run.status !== ProcessRunStatus.READY
    ) {
      throw new BadRequestException(
        'Stages can only advance while IN_PROGRESS or READY',
      );
    }

    const stages = run.stages ?? [];
    if (stages.length === 0) {
      throw new BadRequestException('Template has no stages');
    }
    if (run.currentStageIndex >= stages.length) {
      throw new BadRequestException('All stages already completed');
    }

    const stageName = stages[run.currentStageIndex];
    const completed = [...(run.stagesCompleted ?? []), stageName];
    run.stagesCompleted = completed;
    run.currentStageIndex += 1;

    const allDone = run.currentStageIndex >= stages.length;
    if (allDone) {
      run.status = run.template.requiresQc
        ? ProcessRunStatus.QC_HOLD
        : ProcessRunStatus.READY;
    }

    await this.runRepo.save(run);

    if (allDone && run.template.requiresQc) {
      await this.dataSource.transaction(async (manager) => {
        const lotRepo = manager.getRepository(Lot);
        const eventRepo = manager.getRepository(LotEvent);
        const lot = await lotRepo.findOne({ where: { id: run.inputLotId } });
        if (lot) {
          lot.status = LotStatus.HOLD;
          await lotRepo.save(lot);
          await eventRepo.save(
            eventRepo.create({
              lotId: lot.id,
              eventType: LotEventType.QC_HELD,
              quantity: run.quantityInput,
              notes: `Awaiting QC after stages for ${run.runNumber}`,
              createdById: userId ?? null,
              metadata: { processRunId: run.id },
            }),
          );
        }
      });
    }

    return this.findOne(id);
  }

  async submitQc(id: string, dto: SubmitQcDto, userId?: string) {
    const run = await this.findOne(id);
    this.assertMillStage(run);
    if (
      run.status !== ProcessRunStatus.QC_HOLD &&
      run.status !== ProcessRunStatus.IN_PROGRESS &&
      run.status !== ProcessRunStatus.READY
    ) {
      throw new BadRequestException('QC cannot be recorded in this status');
    }

    const maxMoisture = run.template.maxMoisturePercent
      ? parseFloat(run.template.maxMoisturePercent)
      : null;
    let passed = dto.passed;
    if (
      maxMoisture !== null &&
      dto.moisturePercent !== undefined &&
      dto.moisturePercent > maxMoisture
    ) {
      passed = false;
    }

    await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProcessRun);
      const qcRepo = manager.getRepository(QcResult);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      await qcRepo.save(
        qcRepo.create({
          processRunId: run.id,
          lotId: run.inputLotId,
          moisturePercent:
            dto.moisturePercent !== undefined
              ? dto.moisturePercent.toFixed(2)
              : null,
          defectCount: dto.defectCount ?? null,
          cuppingScore:
            dto.cuppingScore !== undefined
              ? dto.cuppingScore.toFixed(2)
              : null,
          passed,
          notes: dto.notes ?? null,
          createdById: userId ?? null,
        }),
      );

      const lot = await lotRepo.findOne({ where: { id: run.inputLotId } });
      if (!lot) throw new NotFoundException('Input lot not found');

      if (passed) {
        lot.status = LotStatus.ACTIVE;
        if (dto.moisturePercent !== undefined) {
          lot.moisturePercent = dto.moisturePercent.toFixed(2);
        }
        await lotRepo.save(lot);
        await eventRepo.save(
          eventRepo.create({
            lotId: lot.id,
            eventType: LotEventType.QC_RELEASED,
            quantity: run.quantityInput,
            notes: dto.notes ?? `QC passed for ${run.runNumber}`,
            createdById: userId ?? null,
            metadata: {
              processRunId: run.id,
              moisturePercent: dto.moisturePercent,
              cuppingScore: dto.cuppingScore,
            },
          }),
        );
        run.status = ProcessRunStatus.READY;
      } else {
        lot.status = LotStatus.HOLD;
        await lotRepo.save(lot);
        await eventRepo.save(
          eventRepo.create({
            lotId: lot.id,
            eventType: LotEventType.QC_HELD,
            quantity: run.quantityInput,
            notes: dto.notes ?? `QC failed for ${run.runNumber}`,
            createdById: userId ?? null,
            metadata: {
              processRunId: run.id,
              moisturePercent: dto.moisturePercent,
              defectCount: dto.defectCount,
            },
          }),
        );
        run.status = ProcessRunStatus.QC_HOLD;
      }
      await runRepo.save(run);
    });

    return this.findOne(id);
  }

  async complete(id: string, dto: CompleteProcessRunDto, userId?: string) {
    const run = await this.findOne(id);
    this.assertMillStage(run);
    if (run.status === ProcessRunStatus.COMPLETED) {
      throw new BadRequestException('Process run already completed');
    }
    if (run.status === ProcessRunStatus.CANCELLED) {
      throw new BadRequestException('Process run is cancelled');
    }
    if (run.status === ProcessRunStatus.DRAFT) {
      throw new BadRequestException('Start the process run first');
    }
    if (run.workflow && (run.stages ?? []).length === 0) {
      throw new BadRequestException(
        'Define the processing steps for this workflow before completing the run',
      );
    }
    if (run.status === ProcessRunStatus.QC_HOLD) {
      throw new BadRequestException('Cannot complete while on QC hold');
    }
    if (run.template.requiresQc && run.status !== ProcessRunStatus.READY) {
      const passed = (run.qcResults ?? []).some((q) => q.passed);
      if (!passed) {
        throw new BadRequestException(
          'QC must pass before completing this process',
        );
      }
    }

    const rejectQty = dto.quantityReject ?? 0;
    const inputQty = parseFloat(run.quantityInput);
    const packSize = run.template.packSizeKg
      ? parseFloat(run.template.packSizeKg)
      : 0;
    const isPackOp = packSize > 0;
    // Pack ops: quantityOutput = pack count; weight out = packs × packSizeKg
    const outputStockQty = dto.quantityOutput;
    const outputWeightKg = isPackOp
      ? dto.quantityOutput * packSize
      : dto.quantityOutput;
    if (outputWeightKg + rejectQty > inputQty + 1e-6) {
      throw new BadRequestException(
        isPackOp
          ? `Pack weight (${outputWeightKg.toFixed(3)} kg) + reject cannot exceed input ${inputQty} kg`
          : 'Output + reject cannot exceed input quantity',
      );
    }

    const lossQty = Math.max(0, inputQty - outputWeightKg - rejectQty);
    const actualYield =
      inputQty > 0 ? (outputWeightKg / inputQty) * 100 : 0;

    await this.dataSource.transaction(async (manager) => {
      const runRepo = manager.getRepository(ProcessRun);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);
      const itemRepo = manager.getRepository(Item);

      const inputLot = await lotRepo.findOne({
        where: { id: run.inputLotId },
      });
      if (!inputLot) throw new NotFoundException('Input lot not found');
      if (inputLot.status === LotStatus.HOLD) {
        throw new BadRequestException('Input lot is on HOLD');
      }

      const remaining = parseFloat(inputLot.quantity) - inputQty;
      if (remaining < -1e-9) {
        throw new BadRequestException('Input lot quantity changed');
      }

      const preserveIdentity =
        Boolean(run.workflow) && !run.template.outputItemId;
      const outputItem = preserveIdentity
        ? await this.resolveWorkflowOutputItem(inputLot, itemRepo)
        : await this.resolveOutputItem(run.template, inputLot, itemRepo);
      const inputItemId = run.template.inputItemId ?? inputLot.itemId;
      if (!inputItemId) {
        throw new BadRequestException(
          'Input catalog item required for stock movement',
        );
      }

      // Stock: consume input lot, receive output lot (create output first for lot_id)
      const inputStock = await this.stockService.getStock(
        run.locationId,
        inputItemId,
        manager,
        inputLot.id,
      );
      const inputUnitCost = inputStock
        ? parseFloat(inputStock.purchasePrice)
        : 0;
      const inputCost = inputUnitCost * inputQty;
      const processCost = parseFloat(run.processCost) || 0;
      const outputUnitCost =
        outputStockQty > 0
          ? (inputCost + processCost) / outputStockQty
          : 0;

      const outputCode =
        dto.outputLotCode?.trim() ||
        `OUT-${new Date().getFullYear()}-${String((await lotRepo.count()) + 1).padStart(4, '0')}`;
      const codeTaken = await lotRepo.findOne({ where: { code: outputCode } });
      if (codeTaken) {
        throw new BadRequestException(`Lot code ${outputCode} already exists`);
      }

      const roastProfileId =
        dto.roastProfileId ?? run.roastProfileId ?? null;

      const outputLot = await lotRepo.save(
        lotRepo.create({
          code: outputCode,
          itemId: outputItem.id,
          locationId: run.locationId,
          form: preserveIdentity ? inputLot.form : run.template.outputForm,
          grade: dto.outputGrade ?? inputLot.grade,
          cropYear: inputLot.cropYear,
          variety: inputLot.variety,
          processMethod: inputLot.processMethod ?? run.template.name,
          region: inputLot.region,
          zone: inputLot.zone,
          woreda: inputLot.woreda,
          kebele: inputLot.kebele,
          moisturePercent:
            dto.moisturePercent !== undefined
              ? dto.moisturePercent.toFixed(2)
              : inputLot.moisturePercent,
          quantity: outputStockQty.toFixed(3),
          status: LotStatus.ACTIVE,
          qcPhase: LotQcPhase.PROCESSED,
          parentLotId: inputLot.id,
          roastProfileId,
          roastDate: dto.roastDate ?? null,
          bestBefore: dto.bestBefore ?? null,
          notes: `Output of ${run.runNumber} from ${inputLot.code}`,
          createdById: userId ?? null,
        }),
      );

      await this.stockService.adjust(
        {
          locationId: run.locationId,
          itemId: inputItemId,
          quantityDelta: -inputQty,
          lotId: inputLot.id,
          meta: {
            sourceType: StockMovementSourceType.PRODUCTION_CONSUMPTION,
            referenceType: 'process_run',
            referenceId: run.id,
            reference: run.runNumber,
            batchCode: inputLot.code,
            grade: inputLot.grade,
            createdById: userId ?? null,
            notes: `Consumed in ${run.runNumber}`,
          },
        },
        manager,
      );
      await this.stockService.adjust(
        {
          locationId: run.locationId,
          itemId: outputItem.id,
          quantityDelta: outputStockQty,
          purchasePrice: outputUnitCost,
          lotId: outputLot.id,
          meta: {
            sourceType: StockMovementSourceType.PRODUCTION_OUTPUT,
            referenceType: 'process_run',
            referenceId: run.id,
            reference: run.runNumber,
            batchCode: outputLot.code,
            grade: outputLot.grade,
            createdById: userId ?? null,
            notes: isPackOp
              ? `Packaged ${outputStockQty} × ${packSize} kg`
              : `Produced ${outputStockQty} kg`,
          },
        },
        manager,
      );

      inputLot.quantity = Math.max(0, remaining).toFixed(3);
      if (parseFloat(inputLot.quantity) <= 1e-9) {
        inputLot.quantity = '0.000';
      }
      await lotRepo.save(inputLot);

      await eventRepo.save(
        eventRepo.create({
          lotId: inputLot.id,
          eventType: LotEventType.PROCESS_COMPLETED,
          quantity: inputQty.toFixed(3),
          fromLocationId: run.locationId,
          notes:
            dto.notes ??
            `Processed in ${run.runNumber} → ${run.template.outputForm}`,
          createdById: userId ?? null,
          metadata: {
            processRunId: run.id,
            quantityOutput: outputStockQty,
            quantityReject: rejectQty,
            quantityLoss: lossQty,
            packCount: isPackOp ? outputStockQty : null,
            packSizeKg: isPackOp ? packSize : null,
            actualYieldPercent: actualYield,
          },
        }),
      );

      if (lossQty > 1e-6) {
        await eventRepo.save(
          eventRepo.create({
            lotId: inputLot.id,
            eventType: LotEventType.PRODUCTION_LOSS,
            quantity: lossQty.toFixed(3),
            fromLocationId: run.locationId,
            notes: `Production loss ${lossQty.toFixed(3)} kg on ${run.runNumber}`,
            createdById: userId ?? null,
            metadata: { processRunId: run.id },
          }),
        );
        // Ledger-only: loss qty already included in production consumption OUT
        await manager.getRepository(StockMovement).save(
          manager.getRepository(StockMovement).create({
            movedAt: new Date(),
            direction: StockMovementDirection.OUT,
            sourceType: StockMovementSourceType.PRODUCTION_LOSS,
            itemId: inputItemId,
            lotId: inputLot.id,
            locationId: run.locationId,
            quantity: lossQty.toFixed(3),
            grade: inputLot.grade,
            batchCode: inputLot.code,
            referenceType: 'process_run',
            referenceId: run.id,
            reference: run.runNumber,
            notes: `Production loss ${lossQty.toFixed(3)} kg of ${inputQty} kg input`,
            createdById: userId ?? null,
          }),
        );
      }

      await eventRepo.save([
        eventRepo.create({
          lotId: outputLot.id,
          eventType: LotEventType.CREATED,
          quantity: outputLot.quantity,
          toLocationId: run.locationId,
          relatedLotId: inputLot.id,
          notes: `Created from process ${run.runNumber}`,
          createdById: userId ?? null,
          metadata: { processRunId: run.id, parentCode: inputLot.code },
        }),
        eventRepo.create({
          lotId: outputLot.id,
          eventType: LotEventType.PROCESS_COMPLETED,
          quantity: outputLot.quantity,
          toLocationId: run.locationId,
          relatedLotId: inputLot.id,
          notes: `Yield ${actualYield.toFixed(1)}% (expected ${run.expectedYieldPercent}%) · loss ${lossQty.toFixed(3)} kg`,
          createdById: userId ?? null,
          metadata: {
            processRunId: run.id,
            expectedYieldPercent: run.expectedYieldPercent,
            actualYieldPercent: actualYield,
            quantityLoss: lossQty,
            unitCost: outputUnitCost,
          },
        }),
      ]);

      // Rejected kg stays in inventory as REJECT lot (not written off)
      if (rejectQty > 0) {
        let rejectItem = await itemRepo.findOne({
          where: { sku: 'COF-REJECT' },
        });
        if (!rejectItem) {
          rejectItem = await itemRepo.save(
            itemRepo.create({
              sku: 'COF-REJECT',
              description: 'Rejected coffee (held in inventory)',
              unit: 'kg',
              itemType: ItemType.OTHER,
            }),
          );
        }
        const rejectCode = `${outputCode}-RJ`;
        const rejectPct = (rejectQty / inputQty) * 100;
        const rejectLot = await lotRepo.save(
          lotRepo.create({
            code: rejectCode,
            itemId: rejectItem.id,
            locationId: run.locationId,
            form: CoffeeForm.REJECT,
            grade: 'REJECT',
            cropYear: inputLot.cropYear,
            variety: inputLot.variety,
            processMethod: inputLot.processMethod ?? run.template.name,
            region: inputLot.region,
            zone: inputLot.zone,
            woreda: inputLot.woreda,
            kebele: inputLot.kebele,
            moisturePercent: inputLot.moisturePercent,
            quantity: rejectQty.toFixed(3),
            status: LotStatus.HOLD,
            qcPhase: LotQcPhase.REJECTED,
            inspectorId: userId ?? null,
            inspectedAt: new Date(),
            rejectReason: dto.notes ?? `Process reject from ${run.runNumber}`,
            rejectPercent: rejectPct.toFixed(2),
            rejectAction: 'Hold for reprocess / local market / disposal review',
            parentLotId: inputLot.id,
            notes: `Process reject ${rejectQty} kg (${rejectPct.toFixed(1)}%) — remains in inventory`,
            createdById: userId ?? null,
          }),
        );
        await this.stockService.adjust(
          {
            locationId: run.locationId,
            itemId: rejectItem.id,
            quantityDelta: rejectQty,
            purchasePrice: inputUnitCost,
            lotId: rejectLot.id,
            meta: {
              sourceType: StockMovementSourceType.REJECTION,
              referenceType: 'process_run',
              referenceId: run.id,
              reference: run.runNumber,
              batchCode: rejectCode,
              grade: 'REJECT',
              createdById: userId ?? null,
              notes: 'Process reject retained in inventory',
            },
          },
          manager,
        );
        await eventRepo.save([
          eventRepo.create({
            lotId: rejectLot.id,
            eventType: LotEventType.CREATED,
            quantity: rejectLot.quantity,
            toLocationId: run.locationId,
            relatedLotId: inputLot.id,
            notes: 'Reject lot from process — stock retained',
            createdById: userId ?? null,
            metadata: { processRunId: run.id },
          }),
          eventRepo.create({
            lotId: rejectLot.id,
            eventType: LotEventType.RECEIVING_REJECTED,
            quantity: rejectLot.quantity,
            toLocationId: run.locationId,
            relatedLotId: inputLot.id,
            notes: rejectLot.rejectReason,
            createdById: userId ?? null,
            metadata: {
              processRunId: run.id,
              rejectPercent: rejectPct,
            },
          }),
        ]);
      }

      const profileIdForShelf =
        dto.roastProfileId ?? run.roastProfileId ?? inputLot.roastProfileId;
      let shelfLifeDays = 90;
      if (profileIdForShelf) {
        const profile = await manager
          .getRepository(RoastProfile)
          .findOne({ where: { id: profileIdForShelf } });
        if (profile) shelfLifeDays = profile.shelfLifeDays ?? 90;
      }

      const today = new Date();
      const roastDate =
        dto.roastDate ??
        (run.template.outputForm === CoffeeForm.ROASTED ||
        run.template.outputForm === CoffeeForm.PACKAGED ||
        run.template.outputForm === CoffeeForm.FLOUR
          ? today.toISOString().slice(0, 10)
          : null);
      let bestBefore = dto.bestBefore ?? null;
      if (!bestBefore && roastDate) {
        const bb = new Date(roastDate);
        bb.setDate(bb.getDate() + shelfLifeDays);
        bestBefore = bb.toISOString().slice(0, 10);
      }

      if (
        run.template.outputForm === CoffeeForm.ROASTED ||
        run.template.outputForm === CoffeeForm.PACKAGED ||
        run.template.outputForm === CoffeeForm.FLOUR
      ) {
        outputLot.roastDate = roastDate;
        outputLot.bestBefore = bestBefore;
        outputLot.roastProfileId = roastProfileId ?? profileIdForShelf;
        await lotRepo.save(outputLot);

        const marketEvent =
          run.template.outputForm === CoffeeForm.PACKAGED
            ? LotEventType.PACKAGED
            : run.template.outputForm === CoffeeForm.FLOUR
              ? LotEventType.PROCESS_COMPLETED
              : LotEventType.ROASTED;
        if (marketEvent !== LotEventType.PROCESS_COMPLETED) {
          await eventRepo.save(
            eventRepo.create({
              lotId: outputLot.id,
              eventType: marketEvent,
              quantity: outputLot.quantity,
              toLocationId: run.locationId,
              relatedLotId: inputLot.id,
              notes:
                marketEvent === LotEventType.PACKAGED
                  ? isPackOp
                    ? `Packaged ${outputStockQty} × ${packSize} kg from ${inputLot.code}`
                    : `Packaged from ${inputLot.code}`
                  : `Roasted from ${inputLot.code}`,
              createdById: userId ?? null,
              metadata: {
                processRunId: run.id,
                roastProfileId: outputLot.roastProfileId,
                roastDate,
                bestBefore,
                packCount: isPackOp ? outputStockQty : null,
                quantityLoss: lossQty,
              },
            }),
          );
        }
      }

      run.outputLotId = outputLot.id;
      run.quantityOutput = outputStockQty.toFixed(3);
      run.quantityReject = rejectQty.toFixed(3);
      run.quantityLoss = lossQty.toFixed(3);
      run.packCount = isPackOp ? outputStockQty.toFixed(3) : null;
      run.actualYieldPercent = actualYield.toFixed(2);
      run.status = ProcessRunStatus.COMPLETED;
      run.completedAt = new Date();
      if (dto.notes) run.notes = dto.notes;
      if (roastProfileId) run.roastProfileId = roastProfileId;
      await runRepo.save(run);
    });

    return this.findOne(id);
  }

  async cancel(id: string, userId?: string) {
    const run = await this.findOne(id);
    if (
      run.status === ProcessRunStatus.COMPLETED ||
      run.status === ProcessRunStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot cancel this run');
    }
    run.status = ProcessRunStatus.CANCELLED;
    await this.runRepo.save(run);

    if (run.startedAt) {
      await this.dataSource.getRepository(LotEvent).save(
        this.dataSource.getRepository(LotEvent).create({
          lotId: run.inputLotId,
          eventType: LotEventType.ADJUSTED,
          quantity: run.quantityInput,
          notes: `Process ${run.runNumber} cancelled`,
          createdById: userId ?? null,
          metadata: { processRunId: run.id },
        }),
      );
    }

    return this.findOne(id);
  }

  /**
   * Undo a run that is still at Processing Started. Kilograms taken from
   * the warehouse go back onto the same lots, the consumption movements
   * are removed, and the run itself is deleted.
   */
  async rollback(id: string) {
    const run = await this.findOne(id);
    if (
      run.status === ProcessRunStatus.COMPLETED ||
      run.status === ProcessRunStatus.CANCELLED
    ) {
      throw new BadRequestException('This process run cannot be rolled back');
    }
    if (
      run.outputLotId ||
      (run.stageResults?.length ?? 0) > 0 ||
      (run.stagesCompleted?.length ?? 0) > 0
    ) {
      throw new BadRequestException(
        'Roll back is only available before the coffee leaves Processing Started',
      );
    }
    await this.eraseRun(run);
    return { rolledBack: true, id };
  }

  /** Delete a run and reverse the stock it moved, including later stages. */
  async remove(id: string) {
    const run = await this.findOne(id);
    await this.eraseRun(run);
    return { deleted: true, id };
  }

  private async eraseRun(run: ProcessRun) {
    const createdLotIds = this.createdLotIds(run);
    await this.dataSource.transaction(async (manager) => {
      const movementRepo = manager.getRepository(StockMovement);
      const movements = await movementRepo.find({
        where: { referenceType: 'process_run', referenceId: run.id },
      });
      const restored = new Map<string, number>();
      const ordered = [...movements].sort((a, b) => {
        if (a.direction === b.direction) return 0;
        return a.direction === StockMovementDirection.OUT ? -1 : 1;
      });

      for (const movement of ordered) {
        const qty = parseFloat(movement.quantity);
        if (!(qty > 0) || !movement.itemId || !movement.locationId) continue;
        const delta =
          movement.direction === StockMovementDirection.OUT ? qty : -qty;
        await this.restoreLotKg(
          manager,
          movement.locationId,
          movement.itemId,
          movement.lotId,
          delta,
        );
        if (movement.lotId && delta > 0) {
          restored.set(
            movement.lotId,
            (restored.get(movement.lotId) ?? 0) + delta,
          );
        }
      }

      const hadConsumption = movements.some(
        (movement) => movement.direction === StockMovementDirection.OUT,
      );
      if (
        (run.workflow === PurchaseType.LOCAL ||
          run.workflow === PurchaseType.EXPORT) &&
        hadConsumption
      ) {
        for (const line of run.inputLines ?? []) {
          const expected = parseFloat(line.quantity);
          const already = restored.get(line.lotId) ?? 0;
          const gap = expected - already;
          if (gap > 0.0005 && line.itemId) {
            await this.restoreLotKg(
              manager,
              run.locationId,
              line.itemId,
              line.lotId,
              gap,
            );
          }
        }
      }

      if (movements.length > 0) await movementRepo.remove(movements);
      await manager
        .getRepository(LotEvent)
        .createQueryBuilder()
        .delete()
        .from(LotEvent)
        .where(`metadata->>'processRunId' = :id`, { id: run.id })
        .execute();
      await manager.getRepository(QcResult).delete({ processRunId: run.id });
      await manager.getRepository(ProcessRun).delete({ id: run.id });
      await this.deleteCreatedLots(manager, createdLotIds);
    });
  }

  private createdLotIds(run: ProcessRun): string[] {
    const ids = new Set<string>();
    if (run.outputLotId) ids.add(run.outputLotId);
    for (const result of run.stageResults ?? []) {
      for (const lotId of [
        result.outputLotId,
        result.rejectLotId,
        result.remainderLotId,
        result.roastLotId,
        result.groundLotId,
      ]) {
        if (lotId) ids.add(lotId);
      }
      for (const pack of result.packs ?? []) {
        if (pack.lotId) ids.add(pack.lotId);
      }
    }
    ids.delete(run.inputLotId);
    for (const line of run.inputLines ?? []) ids.delete(line.lotId);
    return [...ids];
  }

  /** Drop output lots this run created once they are empty and unused. */
  private async deleteCreatedLots(manager: EntityManager, lotIds: string[]) {
    if (lotIds.length === 0) return;
    const lotRepo = manager.getRepository(Lot);
    const lots = await lotRepo.find({ where: lotIds.map((id) => ({ id })) });
    const idSet = new Set(lotIds);
    lots.sort((a, b) => {
      const aChild = a.parentLotId && idSet.has(a.parentLotId) ? 0 : 1;
      const bChild = b.parentLotId && idSet.has(b.parentLotId) ? 0 : 1;
      return aChild - bChild;
    });
    for (const lot of lots) {
      if (parseFloat(lot.quantity) > 0.0005) continue;
      const blocked = await manager.query(
        `SELECT 1 FROM (
           SELECT lot_id FROM sale_lines WHERE lot_id = $1
           UNION ALL SELECT lot_id FROM sale_return_lines WHERE lot_id = $1
           UNION ALL SELECT lot_id FROM purchase_lines WHERE lot_id = $1
           UNION ALL SELECT lot_id FROM export_allocations WHERE lot_id = $1
           UNION ALL SELECT lot_id FROM stock_movements WHERE lot_id = $1
           UNION ALL SELECT lot_id FROM stock_transfer_lines WHERE lot_id = $1
           UNION ALL SELECT lot_id FROM stock_adjustments WHERE lot_id = $1
           UNION ALL SELECT input_lot_id FROM process_runs WHERE input_lot_id = $1
           UNION ALL SELECT output_lot_id FROM process_runs WHERE output_lot_id = $1
           UNION ALL SELECT id FROM lots WHERE parent_lot_id = $1
         ) refs LIMIT 1`,
        [lot.id],
      );
      if (blocked.length > 0) continue;
      await manager.query(`DELETE FROM stock_levels WHERE lot_id = $1`, [lot.id]);
      await manager.query(
        `DELETE FROM lot_events WHERE lot_id = $1 OR related_lot_id = $1`,
        [lot.id],
      );
      await manager.query(`DELETE FROM qc_results WHERE lot_id = $1`, [lot.id]);
      await lotRepo.delete({ id: lot.id });
    }
  }

  private async restoreLotKg(
    manager: EntityManager,
    locationId: string,
    itemId: string,
    lotId: string | null,
    delta: number,
  ) {
    if (Math.abs(delta) < 1e-9) return;
    await this.stockService.adjust(
      {
        locationId,
        itemId,
        lotId,
        quantityDelta: delta,
        meta: { skipLedger: true },
      },
      manager,
    );
    if (!lotId) return;
    const lot = await manager.getRepository(Lot).findOne({
      where: { id: lotId },
    });
    if (!lot) throw new NotFoundException('Stock lot not found');
    const next = parseFloat(lot.quantity) + delta;
    if (next < -1e-6) {
      throw new BadRequestException(
        `Lot ${lot.code} cannot give back ${Math.abs(delta).toFixed(3)} kg`,
      );
    }
    lot.quantity = Math.max(0, next).toFixed(3);
    await manager.getRepository(Lot).save(lot);
  }

  /**
   * Purchases stay in warehouse stock. Runs opened automatically from a
   * purchase, before any stage was recorded, are cancelled so that coffee
   * can be selected when a process run is created.
   */
  private async releaseQueuedPurchaseRuns() {
    const runs = await this.runRepo
      .createQueryBuilder('run')
      .where('run.purchase_id IS NOT NULL')
      .andWhere('run.status IN (:...open)', {
        open: [ProcessRunStatus.DRAFT, ProcessRunStatus.IN_PROGRESS],
      })
      .andWhere('run.output_lot_id IS NULL')
      .andWhere(`COALESCE(jsonb_array_length(run.stage_results), 0) = 0`)
      .andWhere(`COALESCE(jsonb_array_length(run.input_lines), 0) = 0`)
      .andWhere(`COALESCE(jsonb_array_length(run.stages_completed), 0) = 0`)
      .getMany();
    if (runs.length === 0) return;

    const eventRepo = this.dataSource.getRepository(LotEvent);
    for (const run of runs) {
      run.status = ProcessRunStatus.CANCELLED;
      run.notes = run.notes
        ? `${run.notes} Returned to warehouse stock.`
        : 'Returned to warehouse stock. A purchase does not open a process run.';
      await this.runRepo.save(run);
      await eventRepo.save(
        eventRepo.create({
          lotId: run.inputLotId,
          eventType: LotEventType.ADJUSTED,
          quantity: run.quantityInput,
          notes: `${run.runNumber} closed. ${run.quantityInput} kg stays available at the warehouse.`,
          metadata: { processRunId: run.id, purchaseId: run.purchaseId },
        }),
      );
    }
    this.logger.log(
      `Returned ${runs.length} purchase-queued process run(s) to warehouse stock`,
    );
  }

  listForPurchase(purchaseId: string) {
    return this.runRepo.find({
      where: {
        purchaseId,
        status: Not(ProcessRunStatus.CANCELLED),
      },
      relations: { template: true, inputLot: true },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Kept for a manual queue. Purchase create and update do not call this:
   * purchased coffee stays in warehouse inventory until a process run is created.
   */
  async enqueuePurchasedLots(
    manager: EntityManager,
    args: {
      purchaseId: string;
      purchaseType: PurchaseType;
      locationId: string;
      userId?: string;
      lines: Array<{
        id?: string;
        lotId?: string | null;
        quantity: string;
      }>;
    },
  ) {
    const lotLines = args.lines.filter((line) => line.lotId);
    if (lotLines.length === 0) return;

    const templateRepo = manager.getRepository(ProcessTemplate);
    const runRepo = manager.getRepository(ProcessRun);
    const lotRepo = manager.getRepository(Lot);
    const eventRepo = manager.getRepository(LotEvent);
    const code = workflowTemplateCode(args.purchaseType);
    const template = await templateRepo.findOne({
      where: { code, isActive: true },
    });
    if (!template) {
      throw new BadRequestException(
        `Processing workflow ${code} is not set up`,
      );
    }

    const marketLabel =
      args.purchaseType === PurchaseType.EXPORT
        ? 'Export processing'
        : 'Local market processing';

    for (const line of lotLines) {
      const lot = await lotRepo.findOne({ where: { id: line.lotId! } });
      if (!lot) {
        throw new BadRequestException('Purchased lot was not found');
      }
      if (lot.status !== LotStatus.ACTIVE) {
        throw new BadRequestException(
          `Lot ${lot.code} must be active before it can enter processing`,
        );
      }
      const qty = parseFloat(line.quantity);
      if (!(qty > 0)) continue;

      const reserved = await this.openReservedKg(manager, lot.id);
      const available = parseFloat(lot.quantity) - reserved;
      if (qty > available + 1e-6) {
        throw new BadRequestException(
          `Lot ${lot.code} does not have enough free kg to enter processing`,
        );
      }

      const count = await runRepo.count();
      const runNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
      const run = await runRepo.save(
        runRepo.create({
          runNumber,
          templateId: template.id,
          inputLotId: lot.id,
          locationId: args.locationId,
          quantityInput: qty.toFixed(3),
          quantityReject: '0.000',
          expectedYieldPercent: template.expectedYieldPercent,
          status: ProcessRunStatus.IN_PROGRESS,
          currentStageIndex: 0,
          stages: Array.isArray(template.stages) ? [...template.stages] : [],
          stagesCompleted: [],
          stageResults: [],
          inputLines: [],
          processCost: '0.00',
          workflow: args.purchaseType,
          purchaseId: args.purchaseId,
          purchaseLineId: line.id ?? null,
          startedAt: new Date(),
          notes: `Sent from purchase to ${marketLabel}. Quantity stays on the warehouse lot until this workflow is completed.`,
          createdById: args.userId ?? null,
        }),
      );

      await eventRepo.save(
        eventRepo.create({
          lotId: lot.id,
          eventType: LotEventType.PROCESS_STARTED,
          quantity: qty.toFixed(3),
          toLocationId: args.locationId,
          notes: `Purchase sent ${lot.code} to ${marketLabel}`,
          createdById: args.userId ?? null,
          metadata: {
            processRunId: run.id,
            purchaseId: args.purchaseId,
            purchaseLineId: line.id ?? null,
            workflow: args.purchaseType,
            templateCode: template.code,
          },
        }),
      );
    }
  }

  /**
   * Drop queued purchase runs so a void or edit can reverse warehouse stock.
   * Refuses when a run has already moved through steps or been completed.
   */
  async releasePurchaseWorkflow(
    manager: EntityManager,
    purchaseId: string,
    userId?: string,
  ) {
    const runRepo = manager.getRepository(ProcessRun);
    const eventRepo = manager.getRepository(LotEvent);
    const runs = await runRepo.find({ where: { purchaseId } });
    for (const run of runs) {
      if (
        run.status === ProcessRunStatus.CANCELLED ||
        run.status === ProcessRunStatus.COMPLETED
      ) {
        if (run.status === ProcessRunStatus.COMPLETED) {
          throw new BadRequestException(
            'This purchase already finished processing and cannot be changed',
          );
        }
        continue;
      }
      const progressed =
        (run.stagesCompleted?.length ?? 0) > 0 ||
        run.status === ProcessRunStatus.QC_HOLD ||
        run.status === ProcessRunStatus.READY ||
        run.outputLotId != null;
      if (progressed) {
        throw new BadRequestException(
          'This purchase is already in processing and cannot be changed',
        );
      }
      run.status = ProcessRunStatus.CANCELLED;
      await runRepo.save(run);
      await eventRepo.save(
        eventRepo.create({
          lotId: run.inputLotId,
          eventType: LotEventType.ADJUSTED,
          quantity: run.quantityInput,
          notes: `Process ${run.runNumber} cancelled with the purchase`,
          createdById: userId ?? null,
          metadata: { processRunId: run.id, purchaseId },
        }),
      );
    }
  }

  private assertMillStage(run: { workflow?: PurchaseType | null }) {
    if (run.workflow === PurchaseType.LOCAL) {
      throw new BadRequestException(
        'Local market runs move through Cleaning, Roast & Ground, and Sales Store',
      );
    }
    if (run.workflow === PurchaseType.EXPORT) {
      throw new BadRequestException(
        'Export runs move through Processing Started, Cleaning, Packaging, and Export Store',
      );
    }
  }

  private async openReservedKg(manager: EntityManager, lotId: string) {
    const header = await manager
      .getRepository(ProcessRun)
      .createQueryBuilder('run')
      .select('COALESCE(SUM(run.quantity_input::numeric), 0)', 'reserved')
      .where('run.input_lot_id = :lotId', { lotId })
      .andWhere('run.status IN (:...open)', { open: OPEN_RUN_STATUSES })
      .andWhere(`COALESCE(jsonb_array_length(run.input_lines), 0) = 0`)
      .andWhere(
        `(run.workflow IS DISTINCT FROM 'LOCAL' AND run.workflow IS DISTINCT FROM 'EXPORT' OR COALESCE(jsonb_array_length(run.stage_results), 0) = 0)`,
      )
      .getRawOne<{ reserved: string }>();

    const lined = await manager.query<{ reserved: string }[]>(
      `
      SELECT COALESCE(SUM((line->>'quantity')::numeric), 0) AS reserved
      FROM process_runs run
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(run.input_lines, '[]'::jsonb)) AS line
      WHERE line->>'lotId' = $1
        AND run.status::text = ANY($2::text[])
        AND run.workflow IS DISTINCT FROM 'LOCAL'
        AND run.workflow IS DISTINCT FROM 'EXPORT'
      `,
      [lotId, OPEN_RUN_STATUSES],
    );

    const fromHeader = parseFloat(header?.reserved ?? '0') || 0;
    const fromLines = parseFloat(lined[0]?.reserved ?? '0') || 0;
    return fromHeader + fromLines;
  }

  private async resolveWorkflowOutputItem(
    inputLot: Lot,
    itemRepo: Repository<Item>,
  ): Promise<Item> {
    if (inputLot.itemId) {
      const item = await itemRepo.findOne({ where: { id: inputLot.itemId } });
      if (item) return item;
    }
    throw new BadRequestException(
      'The lot needs a catalog item before this workflow can be completed',
    );
  }

  private async resolveOutputItem(
    template: ProcessTemplate,
    inputLot: Lot,
    itemRepo: Repository<Item>,
  ): Promise<Item> {
    if (template.outputItemId) {
      const item = await itemRepo.findOne({
        where: { id: template.outputItemId },
      });
      if (item) return item;
    }

    const skuByForm: Partial<Record<CoffeeForm, string>> = {
      [CoffeeForm.PARCHMENT]: 'COF-PARCHMENT',
      [CoffeeForm.GREEN]: 'COF-GREEN-G1',
      [CoffeeForm.ROASTED]: 'COF-ROASTED',
      [CoffeeForm.FLOUR]: 'COF-FLOUR',
      [CoffeeForm.PACKAGED]: 'COF-ROAST-1KG',
      [CoffeeForm.CHERRY]: 'COF-CHERRY',
    };
    const sku = skuByForm[template.outputForm] ?? `COF-${template.outputForm}`;
    let item = await itemRepo.findOne({ where: { sku } });
    if (!item) {
      const unit =
        template.outputForm === CoffeeForm.PACKAGED && template.packSizeKg
          ? 'pcs'
          : 'kg';
      item = await itemRepo.save(
        itemRepo.create({
          sku,
          description: `Coffee ${template.outputForm.toLowerCase()}`,
          unit,
          itemType:
            template.outputForm === CoffeeForm.ROASTED ||
            template.outputForm === CoffeeForm.PACKAGED ||
            template.outputForm === CoffeeForm.FLOUR
              ? ItemType.FINISHED
              : ItemType.RAW,
        }),
      );
    }
    return item;
  }
}
