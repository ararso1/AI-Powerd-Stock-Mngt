import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CoffeeForm,
  ItemType,
  LotEventType,
  LotStatus,
  ProcessRunStatus,
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
import { StockService } from '../inventory/stock.service';
import { ProcessRunListQueryDto } from './dto/process-run-list-query.dto';
import {
  CompleteProcessRunDto,
  CreateProcessRunDto,
  CreateProcessTemplateDto,
  SubmitQcDto,
} from './dto/process-run.dto';

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
export class ProcessRunsService {
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

    const inputLot = await this.lotRepo.findOne({
      where: { id: dto.inputLotId },
    });
    if (!inputLot) throw new BadRequestException('Input lot not found');
    if (inputLot.status !== LotStatus.ACTIVE) {
      throw new BadRequestException('Input lot must be ACTIVE');
    }
    if (inputLot.form !== template.inputForm) {
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
        processCost: (dto.processCost ?? 0).toFixed(2),
        notes: dto.notes ?? null,
        roastProfileId: dto.roastProfileId ?? null,
        createdById: userId ?? null,
      }),
    );

    return this.findOne(run.id);
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
      if (stages.length === 0) {
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

      if (stages.length === 0 && run.template.requiresQc) {
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
    if (run.status === ProcessRunStatus.COMPLETED) {
      throw new BadRequestException('Process run already completed');
    }
    if (run.status === ProcessRunStatus.CANCELLED) {
      throw new BadRequestException('Process run is cancelled');
    }
    if (run.status === ProcessRunStatus.DRAFT) {
      throw new BadRequestException('Start the process run first');
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
    if (dto.quantityOutput + rejectQty > parseFloat(run.quantityInput) + 1e-6) {
      throw new BadRequestException(
        'Output + reject cannot exceed input quantity',
      );
    }

    const actualYield =
      (dto.quantityOutput / parseFloat(run.quantityInput)) * 100;

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

      const inputQty = parseFloat(run.quantityInput);
      const remaining = parseFloat(inputLot.quantity) - inputQty;
      if (remaining < -1e-9) {
        throw new BadRequestException('Input lot quantity changed');
      }

      const outputItem = await this.resolveOutputItem(
        run.template,
        inputLot,
        itemRepo,
      );
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
        dto.quantityOutput > 0
          ? (inputCost + processCost) / dto.quantityOutput
          : 0;

      const outputCode =
        dto.outputLotCode?.trim() ||
        `OUT-${new Date().getFullYear()}-${String((await lotRepo.count()) + 1).padStart(4, '0')}`;
      const codeTaken = await lotRepo.findOne({ where: { code: outputCode } });
      if (codeTaken) {
        throw new BadRequestException(`Lot code ${outputCode} already exists`);
      }

      const outputLot = await lotRepo.save(
        lotRepo.create({
          code: outputCode,
          itemId: outputItem.id,
          locationId: run.locationId,
          form: run.template.outputForm,
          grade: dto.outputGrade ?? inputLot.grade,
          cropYear: inputLot.cropYear,
          variety: inputLot.variety,
          processMethod: inputLot.processMethod ?? run.template.name,
          region: inputLot.region,
          woreda: inputLot.woreda,
          kebele: inputLot.kebele,
          moisturePercent:
            dto.moisturePercent !== undefined
              ? dto.moisturePercent.toFixed(2)
              : inputLot.moisturePercent,
          quantity: dto.quantityOutput.toFixed(3),
          status: LotStatus.ACTIVE,
          parentLotId: inputLot.id,
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
        },
        manager,
      );
      await this.stockService.adjust(
        {
          locationId: run.locationId,
          itemId: outputItem.id,
          quantityDelta: dto.quantityOutput,
          purchasePrice: outputUnitCost,
          lotId: outputLot.id,
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
            quantityOutput: dto.quantityOutput,
            quantityReject: rejectQty,
            actualYieldPercent: actualYield,
          },
        }),
      );

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
          notes: `Yield ${actualYield.toFixed(1)}% (expected ${run.expectedYieldPercent}%)`,
          createdById: userId ?? null,
          metadata: {
            processRunId: run.id,
            expectedYieldPercent: run.expectedYieldPercent,
            actualYieldPercent: actualYield,
            unitCost: outputUnitCost,
          },
        }),
      ]);

      const roastProfileId =
        dto.roastProfileId ?? run.roastProfileId ?? inputLot.roastProfileId;
      let shelfLifeDays = 90;
      if (roastProfileId) {
        const profile = await manager
          .getRepository(RoastProfile)
          .findOne({ where: { id: roastProfileId } });
        if (profile) shelfLifeDays = profile.shelfLifeDays ?? 90;
      }

      const today = new Date();
      const roastDate =
        dto.roastDate ??
        (run.template.outputForm === CoffeeForm.ROASTED ||
        run.template.outputForm === CoffeeForm.PACKAGED
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
        run.template.outputForm === CoffeeForm.PACKAGED
      ) {
        outputLot.roastDate = roastDate;
        outputLot.bestBefore = bestBefore;
        outputLot.roastProfileId = roastProfileId;
        await lotRepo.save(outputLot);

        const marketEvent =
          run.template.outputForm === CoffeeForm.PACKAGED
            ? LotEventType.PACKAGED
            : LotEventType.ROASTED;
        await eventRepo.save(
          eventRepo.create({
            lotId: outputLot.id,
            eventType: marketEvent,
            quantity: outputLot.quantity,
            toLocationId: run.locationId,
            relatedLotId: inputLot.id,
            notes:
              marketEvent === LotEventType.PACKAGED
                ? `Packaged from ${inputLot.code}`
                : `Roasted from ${inputLot.code}`,
            createdById: userId ?? null,
            metadata: {
              processRunId: run.id,
              roastProfileId,
              roastDate,
              bestBefore,
            },
          }),
        );
      }

      if (rejectQty > 0) {
        await eventRepo.save(
          eventRepo.create({
            lotId: inputLot.id,
            eventType: LotEventType.ADJUSTED,
            quantity: rejectQty.toFixed(3),
            notes: `Process reject / loss on ${run.runNumber}`,
            createdById: userId ?? null,
            metadata: { processRunId: run.id, reason: 'REJECT' },
          }),
        );
      }

      run.outputLotId = outputLot.id;
      run.quantityOutput = dto.quantityOutput.toFixed(3);
      run.quantityReject = rejectQty.toFixed(3);
      run.actualYieldPercent = actualYield.toFixed(2);
      run.status = ProcessRunStatus.COMPLETED;
      run.completedAt = new Date();
      if (dto.notes) run.notes = dto.notes;
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
      [CoffeeForm.ROASTED]: 'COF-ROAST-250',
      [CoffeeForm.PACKAGED]: 'COF-ROAST-250',
      [CoffeeForm.CHERRY]: 'COF-CHERRY',
    };
    const sku = skuByForm[template.outputForm] ?? `COF-${template.outputForm}`;
    let item = await itemRepo.findOne({ where: { sku } });
    if (!item) {
      item = await itemRepo.save(
        itemRepo.create({
          sku,
          description: `Coffee ${template.outputForm.toLowerCase()}`,
          unit: 'kg',
          itemType:
            template.outputForm === CoffeeForm.ROASTED ||
            template.outputForm === CoffeeForm.PACKAGED
              ? ItemType.FINISHED
              : ItemType.RAW,
        }),
      );
    }
    return item;
  }
}
