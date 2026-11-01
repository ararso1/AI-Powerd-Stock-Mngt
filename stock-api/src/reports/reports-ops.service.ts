import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { applyDateRangeToQb } from '../common/utils/query.util';
import { getAppCurrency } from '../common/utils/currency.util';
import { ApprovalRequest } from '../database/entities/approval-request.entity';
import { BankAccount } from '../database/entities/bank-account.entity';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { CollectionTicket } from '../database/entities/collection-ticket.entity';
import { ExportContract } from '../database/entities/export-contract.entity';
import { Lot } from '../database/entities/lot.entity';
import { MarketPrice } from '../database/entities/market-price.entity';
import { ProcessRun } from '../database/entities/process-run.entity';
import { StockAdjustment } from '../database/entities/stock-adjustment.entity';
import { StockLevel } from '../database/entities/stock-level.entity';
import { StockTransfer } from '../database/entities/stock-transfer.entity';
import { User } from '../database/entities/user.entity';
import { ReportQueryDto } from './report-query.dto';

@Injectable()
export class ReportsOpsService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    @InjectRepository(StockAdjustment)
    private readonly adjustmentRepo: Repository<StockAdjustment>,
    @InjectRepository(StockTransfer)
    private readonly transferRepo: Repository<StockTransfer>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(CollectionTicket)
    private readonly collectionRepo: Repository<CollectionTicket>,
    @InjectRepository(ProcessRun)
    private readonly processRepo: Repository<ProcessRun>,
    @InjectRepository(ExportContract)
    private readonly exportRepo: Repository<ExportContract>,
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(BankTransaction)
    private readonly bankTxRepo: Repository<BankTransaction>,
    @InjectRepository(ApprovalRequest)
    private readonly approvalRepo: Repository<ApprovalRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MarketPrice)
    private readonly marketPriceRepo: Repository<MarketPrice>,
  ) {}

  private currency() {
    return getAppCurrency(this.config);
  }

  private period(from?: string, to?: string) {
    return { from: from ?? null, to: to ?? null };
  }

  async inventoryOnHand(query: ReportQueryDto) {
    const qb = this.stockRepo
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.item', 'item')
      .leftJoinAndSelect('stock.location', 'location')
      .leftJoinAndSelect('stock.lot', 'lot')
      .where('stock.quantity::numeric > 0');
    if (query.locationId) {
      qb.andWhere('stock.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    const rows = await qb.orderBy('location.name', 'ASC').getMany();
    let totalValue = 0;
    let totalQty = 0;
    let reservedQty = 0;
    const items = rows.map((s) => {
      const qty = parseFloat(s.quantity);
      const reserved = parseFloat(s.reservedQuantity ?? '0');
      const value = qty * parseFloat(s.purchasePrice);
      totalValue += value;
      totalQty += qty;
      reservedQty += reserved;
      return {
        itemId: s.itemId,
        description: s.item?.description ?? '',
        sku: s.item?.sku ?? null,
        locationId: s.locationId,
        locationName: s.location?.name ?? '',
        lotCode: s.lot?.code ?? null,
        form: s.lot?.form ?? null,
        grade: s.lot?.grade ?? null,
        quantity: qty.toFixed(3),
        reservedQuantity: reserved.toFixed(3),
        available: Math.max(0, qty - reserved).toFixed(3),
        purchasePrice: parseFloat(s.purchasePrice).toFixed(2),
        inventoryValue: value.toFixed(2),
      };
    });
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: {
        lines: items.length,
        quantity: totalQty.toFixed(3),
        reserved: reservedQty.toFixed(3),
        available: Math.max(0, totalQty - reservedQty).toFixed(3),
        value: totalValue.toFixed(2),
      },
      items,
    };
  }

  async inventoryAdjustments(query: ReportQueryDto) {
    const qb = this.adjustmentRepo
      .createQueryBuilder('adj')
      .leftJoinAndSelect('adj.item', 'item')
      .leftJoinAndSelect('adj.location', 'location')
      .leftJoinAndSelect('adj.lot', 'lot')
      .leftJoinAndSelect('adj.createdBy', 'user');
    if (query.locationId) {
      qb.andWhere('adj.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.direction) {
      qb.andWhere('adj.direction = :direction', { direction: query.direction });
    }
    if (query.reason) {
      qb.andWhere('adj.reason = :reason', { reason: query.reason });
    }
    applyDateRangeToQb(qb, 'adj.created_at', query.from, query.to);
    const rows = await qb.orderBy('adj.created_at', 'DESC').take(2000).getMany();
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: { count: rows.length },
      adjustments: rows.map((r) => ({
        id: r.id,
        date: r.createdAt.toISOString(),
        direction: r.direction,
        reason: r.reason,
        quantity: r.quantity,
        item: r.item?.description ?? r.itemId,
        sku: r.item?.sku ?? null,
        location: r.location?.name ?? r.locationId,
        lotCode: r.lot?.code ?? null,
        createdBy: r.createdBy?.fullName ?? null,
        notes: r.notes ?? null,
      })),
    };
  }

  async transfers(query: ReportQueryDto) {
    const qb = this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.fromLocation', 'fromLoc')
      .leftJoinAndSelect('t.toLocation', 'toLoc')
      .leftJoinAndSelect('t.lines', 'line')
      .leftJoinAndSelect('line.item', 'item');
    if (query.locationId) {
      qb.andWhere(
        '(t.from_location_id = :locationId OR t.to_location_id = :locationId)',
        { locationId: query.locationId },
      );
    }
    const transferStatus = query.transferStatus ?? query.status;
    if (transferStatus) {
      qb.andWhere('t.status = :transferStatus', { transferStatus });
    }
    applyDateRangeToQb(qb, 't.created_at', query.from, query.to);
    const rows = await qb.orderBy('t.created_at', 'DESC').take(1000).getMany();
    const transfers = rows.map((t) => {
      const qty = (t.lines ?? []).reduce(
        (sum, l) => sum + parseFloat(l.quantity),
        0,
      );
      return {
        id: t.id,
        date: t.createdAt.toISOString(),
        status: t.status,
        fromLocation: t.fromLocation?.name ?? t.fromLocationId,
        toLocation: t.toLocation?.name ?? t.toLocationId,
        lineCount: t.lines?.length ?? 0,
        quantity: qty.toFixed(3),
        notes: t.notes ?? null,
      };
    });
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: { count: transfers.length },
      transfers,
    };
  }

  async lots(query: ReportQueryDto) {
    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.location', 'location')
      .leftJoinAndSelect('lot.item', 'item');
    if (query.locationId) {
      qb.andWhere('lot.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    const lotStatus = query.lotStatus ?? query.status;
    if (lotStatus) {
      qb.andWhere('lot.status = :lotStatus', { lotStatus });
    }
    if (query.form) {
      qb.andWhere('lot.form = :form', { form: query.form });
    }
    applyDateRangeToQb(qb, 'lot.created_at', query.from, query.to);
    const rows = await qb.orderBy('lot.created_at', 'DESC').take(2000).getMany();
    const byForm = new Map<string, number>();
    for (const lot of rows) {
      byForm.set(lot.form, (byForm.get(lot.form) ?? 0) + parseFloat(lot.quantity));
    }
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: { count: rows.length },
      byForm: [...byForm.entries()].map(([form, quantity]) => ({
        form,
        quantity: quantity.toFixed(3),
      })),
      lots: rows.map((lot) => ({
        id: lot.id,
        code: lot.code,
        form: lot.form,
        grade: lot.grade,
        cropYear: lot.cropYear,
        status: lot.status,
        qcPhase: lot.qcPhase,
        quantity: lot.quantity,
        location: lot.location?.name ?? null,
        item: lot.item?.description ?? null,
        processMethod: lot.processMethod,
        createdAt: lot.createdAt.toISOString(),
      })),
    };
  }

  async collections(query: ReportQueryDto) {
    const qb = this.collectionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.supplier', 'supplier')
      .leftJoinAndSelect('c.location', 'location');
    if (query.locationId) {
      qb.andWhere('c.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.supplierId) {
      qb.andWhere('c.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.disposition) {
      qb.andWhere('c.disposition = :disposition', {
        disposition: query.disposition,
      });
    }
    if (query.status) {
      qb.andWhere('c.status = :ticketStatus', { ticketStatus: query.status });
    }
    applyDateRangeToQb(qb, 'c.created_at', query.from, query.to);
    const rows = await qb.orderBy('c.created_at', 'DESC').take(2000).getMany();
    let totalKg = 0;
    const byDisposition = new Map<string, number>();
    for (const t of rows) {
      const kg = parseFloat(t.weightKg);
      totalKg += kg;
      byDisposition.set(
        t.disposition,
        (byDisposition.get(t.disposition) ?? 0) + kg,
      );
    }
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: {
        count: rows.length,
        weightKg: totalKg.toFixed(3),
      },
      byDisposition: [...byDisposition.entries()].map(([disposition, kg]) => ({
        disposition,
        weightKg: kg.toFixed(3),
      })),
      tickets: rows.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        date: t.createdAt.toISOString(),
        supplier: t.supplier?.name ?? t.supplierId,
        location: t.location?.name ?? t.locationId,
        weightKg: t.weightKg,
        disposition: t.disposition,
        status: t.status,
      })),
    };
  }

  async processYield(query: ReportQueryDto) {
    const qb = this.processRepo
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.template', 'template')
      .leftJoinAndSelect('run.location', 'location');
    if (query.locationId) {
      qb.andWhere('run.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    const processStatus = query.processStatus ?? query.status;
    if (processStatus) {
      qb.andWhere('run.status = :processStatus', { processStatus });
    }
    if (query.workflow) {
      qb.andWhere('run.workflow = :workflow', { workflow: query.workflow });
    }
    applyDateRangeToQb(qb, 'run.created_at', query.from, query.to);
    const rows = await qb.orderBy('run.created_at', 'DESC').take(1000).getMany();
    let input = 0;
    let output = 0;
    let loss = 0;
    let reject = 0;
    const runs = rows.map((r) => {
      const qi = parseFloat(r.quantityInput);
      const qo = parseFloat(r.quantityOutput ?? '0');
      const ql = parseFloat(r.quantityLoss ?? '0');
      const qr = parseFloat(r.quantityReject ?? '0');
      input += qi;
      output += qo;
      loss += ql;
      reject += qr;
      return {
        id: r.id,
        runNumber: r.runNumber,
        date: r.createdAt.toISOString(),
        template: r.template?.name ?? r.templateId,
        workflow: r.workflow,
        status: r.status,
        location: r.location?.name ?? r.locationId,
        quantityInput: r.quantityInput,
        quantityOutput: r.quantityOutput,
        quantityLoss: r.quantityLoss,
        quantityReject: r.quantityReject,
        actualYieldPercent: r.actualYieldPercent,
        expectedYieldPercent: r.expectedYieldPercent,
      };
    });
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: {
        count: runs.length,
        inputKg: input.toFixed(3),
        outputKg: output.toFixed(3),
        lossKg: loss.toFixed(3),
        rejectKg: reject.toFixed(3),
        yieldPercent: input > 0 ? ((output / input) * 100).toFixed(2) : '0.00',
      },
      runs,
    };
  }

  async exportsPipeline(query: ReportQueryDto) {
    const qb = this.exportRepo.createQueryBuilder('c');
    const exportStatus = query.exportStatus ?? query.status;
    if (exportStatus) {
      qb.andWhere('c.status = :exportStatus', { exportStatus });
    }
    applyDateRangeToQb(qb, 'c.created_at', query.from, query.to);
    const rows = await qb.orderBy('c.created_at', 'DESC').take(1000).getMany();
    const byStatus = new Map<string, { count: number; volume: number }>();
    for (const c of rows) {
      const cur = byStatus.get(c.status) ?? { count: 0, volume: 0 };
      cur.count += 1;
      cur.volume += parseFloat(c.volumeKg);
      byStatus.set(c.status, cur);
    }
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: { count: rows.length },
      byStatus: [...byStatus.entries()].map(([status, v]) => ({
        status,
        count: v.count,
        volumeKg: v.volume.toFixed(3),
      })),
      contracts: rows.map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        buyerName: c.buyerName,
        buyerCountry: c.buyerCountry,
        status: c.status,
        volumeKg: c.volumeKg,
        allocatedKg: c.allocatedKg,
        shippedKg: c.shippedKg,
        pricePerKg: c.pricePerKg,
        currencyCode: c.currencyCode,
        grade: c.grade,
        windowStart: c.windowStart,
        windowEnd: c.windowEnd,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async banks(query: ReportQueryDto) {
    const accounts = await this.bankAccountRepo.find({
      order: { name: 'ASC' },
    });
    const txQb = this.bankTxRepo.createQueryBuilder('tx');
    applyDateRangeToQb(txQb, 'tx.created_at', query.from, query.to);
    const transactions = await txQb
      .leftJoinAndSelect('tx.bankAccount', 'account')
      .orderBy('tx.created_at', 'DESC')
      .take(2000)
      .getMany();
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        accountType: a.accountType,
        currencyCode: a.currencyCode,
        balance: a.balance,
        isActive: a.isActive,
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        date: t.createdAt.toISOString(),
        account: t.bankAccount?.name ?? t.bankAccountId,
        type: t.type,
        amount: t.amount,
        description: t.description,
        refType: t.refType,
        refId: t.refId,
      })),
    };
  }

  async approvals(query: ReportQueryDto) {
    const qb = this.approvalRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.initiatedBy', 'user');
    const approvalStatus = query.approvalStatus ?? query.status;
    if (approvalStatus) {
      qb.andWhere('a.status = :approvalStatus', { approvalStatus });
    }
    if (query.entityType) {
      qb.andWhere('a.entity_type = :entityType', {
        entityType: query.entityType,
      });
    }
    applyDateRangeToQb(qb, 'a.created_at', query.from, query.to);
    const rows = await qb.orderBy('a.created_at', 'DESC').take(1000).getMany();
    const byStatus = new Map<string, number>();
    for (const r of rows) {
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    }
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: { count: rows.length },
      byStatus: [...byStatus.entries()].map(([status, count]) => ({
        status,
        count,
      })),
      approvals: rows.map((a) => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        status: a.status,
        initiatedBy: a.initiatedBy?.fullName ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        notes: a.notes,
      })),
    };
  }

  async hrHeadcount(query: ReportQueryDto) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role');
    if (query.employmentStatus) {
      qb.andWhere('u.employment_status = :employmentStatus', {
        employmentStatus: query.employmentStatus,
      });
    }
    applyDateRangeToQb(qb, 'u.created_at', query.from, query.to);
    const users = await qb.orderBy('u.full_name', 'ASC').getMany();
    const byDepartment = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const u of users) {
      const dept = u.department?.trim() || 'Unassigned';
      byDepartment.set(dept, (byDepartment.get(dept) ?? 0) + 1);
      const status = u.employmentStatus ?? 'ACTIVE';
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    }
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: {
        count: users.length,
        active: users.filter((u) => u.isActive).length,
      },
      byDepartment: [...byDepartment.entries()].map(([department, count]) => ({
        department,
        count,
      })),
      byStatus: [...byStatus.entries()].map(([status, count]) => ({
        status,
        count,
      })),
      users: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role?.name ?? null,
        department: u.department,
        designation: u.designation,
        employmentType: u.employmentType,
        employmentStatus: u.employmentStatus,
        isActive: u.isActive,
        hiredAt: u.hiredAt,
      })),
    };
  }

  async marketSnapshot(query: ReportQueryDto) {
    const qb = this.marketPriceRepo.createQueryBuilder('p');
    if (query.symbol) {
      qb.andWhere('p.symbol = :symbol', {
        symbol: query.symbol.toUpperCase(),
      });
    }
    applyDateRangeToQb(qb, 'p.price_date', query.from, query.to);
    const rows = await qb
      .orderBy('p.price_date', 'DESC')
      .addOrderBy('p.symbol', 'ASC')
      .take(500)
      .getMany();
    return {
      currency: this.currency(),
      period: this.period(query.from, query.to),
      totals: { count: rows.length },
      prices: rows.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        priceDate: p.priceDate,
        nativePrice: p.nativePrice,
        nativeUnit: p.nativeUnit,
        usdPerKg: p.usdPerKg ?? null,
      })),
    };
  }
}
