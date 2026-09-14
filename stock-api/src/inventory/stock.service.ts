import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import {
  StockMovementDirection,
  StockMovementSourceType,
} from '../common/enums';
import { Item } from '../database/entities/item.entity';
import { Lot } from '../database/entities/lot.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { StockMovement } from '../database/entities/stock-movement.entity';

export interface StockAdjustMeta {
  sourceType?: StockMovementSourceType;
  referenceType?: string;
  referenceId?: string;
  reference?: string;
  grade?: string | null;
  batchCode?: string | null;
  createdById?: string | null;
  notes?: string | null;
  /** Skip ledger row (rare internal fixes). */
  skipLedger?: boolean;
}

export interface StockAdjustment {
  locationId: string;
  itemId: string;
  quantityDelta: number;
  purchasePrice?: number;
  /** When set, adjusts lot-linked stock. Omit / null = legacy null-lot row. */
  lotId?: string | null;
  meta?: StockAdjustMeta;
}

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
  ) {}

  private repos(manager?: EntityManager) {
    return {
      stock: manager ? manager.getRepository(StockLevel) : this.stockRepo,
      item: manager ? manager.getRepository(Item) : this.itemRepo,
      movement: manager
        ? manager.getRepository(StockMovement)
        : this.movementRepo,
      lot: manager ? manager.getRepository(Lot) : this.lotRepo,
    };
  }

  /** Coffee catalog SKUs are seeded as COF-*. */
  isCoffeeItem(item: Pick<Item, 'sku'> | null | undefined): boolean {
    const sku = item?.sku?.trim().toUpperCase();
    return !!sku && sku.startsWith('COF-');
  }

  async getStock(
    locationId: string,
    itemId: string,
    manager?: EntityManager,
    lotId?: string | null,
  ): Promise<StockLevel | null> {
    const { stock } = this.repos(manager);
    return stock.findOne({
      where: {
        locationId,
        itemId,
        lotId: lotId ? lotId : IsNull(),
      },
    });
  }

  async getQuantity(
    locationId: string,
    itemId: string,
    manager?: EntityManager,
    lotId?: string | null,
  ): Promise<number> {
    const row = await this.getStock(locationId, itemId, manager, lotId);
    return row ? parseFloat(row.quantity) : 0;
  }

  async getReservedQuantity(
    locationId: string,
    itemId: string,
    manager?: EntityManager,
    lotId?: string | null,
  ): Promise<number> {
    const row = await this.getStock(locationId, itemId, manager, lotId);
    return row ? parseFloat(row.reservedQuantity ?? '0') : 0;
  }

  /** On-hand minus export-reserved — safe to sell locally. */
  async getAvailableQuantity(
    locationId: string,
    itemId: string,
    manager?: EntityManager,
    lotId?: string | null,
  ): Promise<number> {
    const row = await this.getStock(locationId, itemId, manager, lotId);
    if (!row) return 0;
    return Math.max(
      0,
      parseFloat(row.quantity) - parseFloat(row.reservedQuantity ?? '0'),
    );
  }

  async reserve(
    locationId: string,
    itemId: string,
    quantity: number,
    manager?: EntityManager,
    lotId?: string | null,
  ): Promise<StockLevel> {
    if (quantity <= 0) {
      throw new BadRequestException('Reserve quantity must be positive');
    }
    const { stock } = this.repos(manager);
    let row = await this.getStock(locationId, itemId, manager, lotId);
    if (!row) {
      throw new BadRequestException(
        'No stock row to reserve — receive/transfer stock first',
      );
    }
    const onHand = parseFloat(row.quantity);
    const reserved = parseFloat(row.reservedQuantity ?? '0');
    const available = onHand - reserved;
    if (available + 1e-9 < quantity) {
      throw new BadRequestException(
        `Insufficient available stock to reserve. Available: ${available.toFixed(3)}, requested: ${quantity}`,
      );
    }
    row.reservedQuantity = (reserved + quantity).toFixed(3);
    return stock.save(row);
  }

  async releaseReserve(
    locationId: string,
    itemId: string,
    quantity: number,
    manager?: EntityManager,
    lotId?: string | null,
  ): Promise<StockLevel | null> {
    if (quantity <= 0) return null;
    const { stock } = this.repos(manager);
    const row = await this.getStock(locationId, itemId, manager, lotId);
    if (!row) return null;
    const reserved = parseFloat(row.reservedQuantity ?? '0');
    row.reservedQuantity = Math.max(0, reserved - quantity).toFixed(3);
    return stock.save(row);
  }

  async adjust(
    adj: StockAdjustment,
    manager?: EntityManager,
  ): Promise<StockLevel> {
    const { stock, item, movement, lot } = this.repos(manager);
    const catalogItem = await item.findOne({ where: { id: adj.itemId } });
    if (!catalogItem) throw new BadRequestException('Item not found');

    const lotId = adj.lotId ?? null;
    let row = await this.getStock(
      adj.locationId,
      adj.itemId,
      manager,
      lotId,
    );
    if (!row) {
      row = stock.create({
        locationId: adj.locationId,
        itemId: adj.itemId,
        lotId,
        quantity: '0',
        reservedQuantity: '0',
        purchasePrice: String(adj.purchasePrice ?? 0),
      });
    }

    const currentQty = parseFloat(row.quantity);
    const reserved = parseFloat(row.reservedQuantity ?? '0');
    const newQty = currentQty + adj.quantityDelta;

    if (newQty + 1e-9 < reserved) {
      throw new BadRequestException(
        `Cannot reduce stock below export-reserved qty (${reserved.toFixed(3)}). ` +
          `Available for sale: ${(currentQty - reserved).toFixed(3)}`,
      );
    }

    if (adj.purchasePrice !== undefined && adj.quantityDelta > 0) {
      const currentPrice = parseFloat(row.purchasePrice);
      const incoming = adj.quantityDelta;
      const weighted =
        currentQty <= 0
          ? adj.purchasePrice
          : (currentQty * currentPrice + incoming * adj.purchasePrice) /
            (currentQty + incoming);
      row.purchasePrice = weighted.toFixed(2);
    }

    row.quantity = newQty.toFixed(3);
    const saved = await stock.save(row);

    if (!adj.meta?.skipLedger && Math.abs(adj.quantityDelta) > 1e-9) {
      let grade = adj.meta?.grade ?? null;
      let batchCode = adj.meta?.batchCode ?? null;
      if (lotId && (grade == null || batchCode == null)) {
        const lotRow = await lot.findOne({ where: { id: lotId } });
        if (lotRow) {
          grade = grade ?? lotRow.grade ?? null;
          batchCode = batchCode ?? lotRow.code;
        }
      }
      await movement.save(
        movement.create({
          movedAt: new Date(),
          direction:
            adj.quantityDelta >= 0
              ? StockMovementDirection.IN
              : StockMovementDirection.OUT,
          sourceType: adj.meta?.sourceType ?? StockMovementSourceType.OTHER,
          itemId: adj.itemId,
          lotId,
          locationId: adj.locationId,
          quantity: Math.abs(adj.quantityDelta).toFixed(3),
          grade,
          batchCode,
          referenceType: adj.meta?.referenceType ?? null,
          referenceId: adj.meta?.referenceId ?? null,
          reference: adj.meta?.reference ?? null,
          notes: adj.meta?.notes ?? null,
          createdById: adj.meta?.createdById ?? null,
        }),
      );
    }

    return saved;
  }

  async transfer(
    fromLocationId: string,
    toLocationId: string,
    itemId: string,
    quantity: number,
    manager?: EntityManager,
    lotId?: string | null,
    meta?: Omit<StockAdjustMeta, 'sourceType'> & {
      outSourceType?: StockMovementSourceType;
      inSourceType?: StockMovementSourceType;
      /** Move this much of reserved qty with the transfer (export stage). */
      reservedQty?: number;
    },
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    const fromStock = await this.getStock(
      fromLocationId,
      itemId,
      manager,
      lotId,
    );
    const onHand = fromStock ? parseFloat(fromStock.quantity) : 0;
    if (onHand < quantity) {
      throw new BadRequestException(
        `Insufficient stock. On hand: ${onHand}, requested: ${quantity}`,
      );
    }

    const reservedMove = meta?.reservedQty ?? 0;
    if (reservedMove > 0) {
      const reserved = fromStock
        ? parseFloat(fromStock.reservedQuantity ?? '0')
        : 0;
      if (reserved + 1e-9 < reservedMove) {
        throw new BadRequestException(
          `Insufficient reserved stock to transfer. Reserved: ${reserved}, requested: ${reservedMove}`,
        );
      }
      await this.releaseReserve(
        fromLocationId,
        itemId,
        reservedMove,
        manager,
        lotId,
      );
    }

    const purchasePrice = fromStock ? parseFloat(fromStock.purchasePrice) : 0;
    const baseMeta = {
      referenceType: meta?.referenceType,
      referenceId: meta?.referenceId,
      reference: meta?.reference,
      grade: meta?.grade,
      batchCode: meta?.batchCode,
      createdById: meta?.createdById,
      notes: meta?.notes,
    };

    await this.adjust(
      {
        locationId: fromLocationId,
        itemId,
        quantityDelta: -quantity,
        lotId,
        meta: {
          ...baseMeta,
          sourceType:
            meta?.outSourceType ?? StockMovementSourceType.TRANSFER_OUT,
        },
      },
      manager,
    );
    await this.adjust(
      {
        locationId: toLocationId,
        itemId,
        quantityDelta: quantity,
        purchasePrice,
        lotId,
        meta: {
          ...baseMeta,
          sourceType: meta?.inSourceType ?? StockMovementSourceType.TRANSFER_IN,
        },
      },
      manager,
    );

    if (reservedMove > 0) {
      await this.reserve(
        toLocationId,
        itemId,
        reservedMove,
        manager,
        lotId,
      );
    }
  }

  async checkAvailability(
    locationId: string,
    lines: { itemId: string; quantity: number; lotId?: string | null }[],
    allowNegative: boolean,
    manager?: EntityManager,
  ): Promise<string[]> {
    const { item } = this.repos(manager);
    const warnings: string[] = [];
    for (const line of lines) {
      const available = await this.getAvailableQuantity(
        locationId,
        line.itemId,
        manager,
        line.lotId,
      );
      if (available < line.quantity) {
        const catalogItem = await item.findOne({ where: { id: line.itemId } });
        const msg = `${catalogItem?.description ?? line.itemId}: requested ${line.quantity}, available ${available} (excludes export-reserved)`;
        if (!allowNegative) {
          throw new BadRequestException(`Stock unavailable: ${msg}`);
        }
        warnings.push(msg);
      }
    }
    return warnings;
  }
}
