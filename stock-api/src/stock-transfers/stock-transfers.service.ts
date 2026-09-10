import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LotEventType, LotStatus, TransferStatus } from '../common/enums';
import {
  applyDateRangeToQb,
  applyIlikeSearch,
  paginatedQueryBuilder,
} from '../common/utils/query.util';
import { StockTransferListQueryDto } from './dto/stock-transfer-list-query.dto';
import { Item } from '../database/entities/item.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { StockTransferLine } from '../database/entities/stock-transfer-line.entity';
import { StockTransfer } from '../database/entities/stock-transfer.entity';
import { StockService } from '../inventory/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LowStockService,
  StockQuantityChange,
} from '../notifications/low-stock.service';
import { CreateStockTransferDto } from './dto/stock-transfer.dto';

@Injectable()
export class StockTransfersService {
  constructor(
    @InjectRepository(StockTransfer)
    private readonly transferRepo: Repository<StockTransfer>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly notifications: NotificationsService,
    private readonly lowStockService: LowStockService,
  ) {}

  findAll(query: StockTransferListQueryDto) {
    const qb = this.transferRepo
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.fromLocation', 'fromLocation')
      .leftJoinAndSelect('transfer.toLocation', 'toLocation')
      .leftJoinAndSelect('transfer.lines', 'lines')
      .leftJoinAndSelect('lines.item', 'item')
      .leftJoinAndSelect('lines.lot', 'lot')
      .orderBy('transfer.created_at', 'DESC');

    if (query.fromLocationId) {
      qb.andWhere('transfer.from_location_id = :fromLocationId', {
        fromLocationId: query.fromLocationId,
      });
    }
    if (query.toLocationId) {
      qb.andWhere('transfer.to_location_id = :toLocationId', {
        toLocationId: query.toLocationId,
      });
    }
    if (query.status) {
      qb.andWhere('transfer.status = :status', { status: query.status });
    }
    applyIlikeSearch(qb, query.search, ['transfer.notes']);
    applyDateRangeToQb(qb, 'transfer.created_at', query.from, query.to);

    return paginatedQueryBuilder(qb, query.page, query.limit);
  }

  findOne(id: string) {
    return this.transferRepo.findOne({
      where: { id },
      relations: {
        fromLocation: true,
        toLocation: true,
        lines: { item: true, lot: true },
      },
    });
  }

  async create(dto: CreateStockTransferDto, userId?: string) {
    if (dto.fromLocationId === dto.toLocationId) {
      throw new BadRequestException('Source and destination must differ');
    }

    for (const line of dto.lines) {
      const item = await this.itemRepo.findOne({ where: { id: line.itemId } });
      if (!item) throw new BadRequestException(`Item not found: ${line.itemId}`);
      if (this.stockService.isCoffeeItem(item) && !line.lotId) {
        throw new BadRequestException(
          `Coffee item ${item.sku ?? item.description} requires a lot on transfer`,
        );
      }
      if (line.lotId) {
        const lot = await this.lotRepo.findOne({ where: { id: line.lotId } });
        if (!lot) throw new BadRequestException(`Lot not found: ${line.lotId}`);
        if (lot.itemId && lot.itemId !== line.itemId) {
          throw new BadRequestException(
            `Lot ${lot.code} does not match item on transfer line`,
          );
        }
        if (lot.locationId && lot.locationId !== dto.fromLocationId) {
          throw new BadRequestException(
            `Lot ${lot.code} is not at the source location`,
          );
        }
        if (lot.status !== LotStatus.ACTIVE) {
          throw new BadRequestException(`Lot ${lot.code} is not active`);
        }
      }
    }

    const stockChanges: StockQuantityChange[] = [];

    const transferId = await this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(StockTransfer);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      const transfer = await transferRepo.save(
        transferRepo.create({
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          notes: dto.notes ?? null,
          status: TransferStatus.PENDING,
          createdById: userId ?? null,
          lines: dto.lines.map((l) =>
            Object.assign(new StockTransferLine(), {
              itemId: l.itemId,
              lotId: l.lotId ?? null,
              quantity: l.quantity.toFixed(3),
            }),
          ),
        }),
      );

      for (const line of dto.lines) {
        const lotId = line.lotId ?? null;
        const previousQuantity = await this.stockService.getQuantity(
          dto.fromLocationId,
          line.itemId,
          manager,
          lotId,
        );
        await this.stockService.transfer(
          dto.fromLocationId,
          dto.toLocationId,
          line.itemId,
          line.quantity,
          manager,
          lotId,
        );

        if (lotId) {
          const lot = await lotRepo.findOne({ where: { id: lotId } });
          if (lot) {
            lot.locationId = dto.toLocationId;
            await lotRepo.save(lot);
            await eventRepo.save(
              eventRepo.create({
                lotId,
                eventType: LotEventType.TRANSFERRED,
                quantity: line.quantity.toFixed(3),
                fromLocationId: dto.fromLocationId,
                toLocationId: dto.toLocationId,
                notes: dto.notes ?? `Transferred ${line.quantity}`,
                createdById: userId ?? null,
                metadata: { transferId: transfer.id },
              }),
            );
          }
        }

        stockChanges.push({
          locationId: dto.fromLocationId,
          itemId: line.itemId,
          previousQuantity,
          lotId,
        });
      }

      transfer.status = TransferStatus.COMPLETED;
      await transferRepo.save(transfer);
      return transfer.id;
    });

    await this.lowStockService.evaluateChanges(stockChanges);

    const transfer = await this.findOne(transferId);
    if (!transfer) throw new NotFoundException('Stock transfer not found');

    await this.notifications.onStockTransferCompleted({
      transferId,
      fromLocationName: transfer.fromLocation?.name ?? 'Unknown',
      toLocationName: transfer.toLocation?.name ?? 'Unknown',
      lineCount: transfer.lines.length,
      actorUserId: userId,
    });

    return transfer;
  }

  async void(id: string) {
    const transfer = await this.transferRepo.findOne({
      where: { id },
      relations: { lines: true },
    });
    if (!transfer) throw new NotFoundException('Stock transfer not found');
    if (transfer.status !== TransferStatus.COMPLETED) {
      throw new BadRequestException('Only completed transfers can be voided');
    }

    await this.dataSource.transaction(async (manager) => {
      const transferRepo = manager.getRepository(StockTransfer);
      const lotRepo = manager.getRepository(Lot);
      const eventRepo = manager.getRepository(LotEvent);

      for (const line of transfer.lines) {
        const lotId = line.lotId ?? null;
        await this.stockService.transfer(
          transfer.toLocationId,
          transfer.fromLocationId,
          line.itemId,
          parseFloat(line.quantity),
          manager,
          lotId,
        );
        if (lotId) {
          const lot = await lotRepo.findOne({ where: { id: lotId } });
          if (lot) {
            lot.locationId = transfer.fromLocationId;
            await lotRepo.save(lot);
            await eventRepo.save(
              eventRepo.create({
                lotId,
                eventType: LotEventType.TRANSFERRED,
                quantity: line.quantity,
                fromLocationId: transfer.toLocationId,
                toLocationId: transfer.fromLocationId,
                notes: `Void reverse of transfer ${transfer.id.slice(0, 8)}`,
                createdById: null,
                metadata: { transferId: transfer.id, void: true },
              }),
            );
          }
        }
      }
      transfer.status = TransferStatus.CANCELLED;
      await transferRepo.save(transfer);
    });

    return this.findOne(id);
  }
}
