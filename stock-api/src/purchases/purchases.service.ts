import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  BankTransactionType,
  CreditStatus,
  DocumentStatus,
  LotEventType,
  LotStatus,
  PaymentMethod,
  PurchaseType,
  StockMovementSourceType,
} from '../common/enums';
import {
  applyDateRangeToQb,
  applyRelatedIlikeSearch,
  paginatedQueryBuilder,
  sumFilteredQueryBuilder,
} from '../common/utils/query.util';
import { PurchaseListQueryDto } from './dto/purchase-list-query.dto';
import { BankLedgerService } from '../banks/bank-ledger.service';
import { BanksService } from '../banks/banks.service';
import { BankTransaction } from '../database/entities/bank-transaction.entity';
import { Item } from '../database/entities/item.entity';
import { Lot } from '../database/entities/lot.entity';
import { LotEvent } from '../database/entities/lot-event.entity';
import { PurchaseLine } from '../database/entities/purchase-line.entity';
import { Purchase } from '../database/entities/purchase.entity';
import { SupplierCredit } from '../database/entities/supplier-credit.entity';
import { StockService } from '../inventory/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePurchaseDto, PurchaseLineDto } from './dto/purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { CreditsService } from '../credits/credits.service';
import { ProcessRunsService } from '../process-runs/process-runs.service';
import { PurchaseQualityService } from './purchase-quality.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly stockService: StockService,
    private readonly bankLedger: BankLedgerService,
    private readonly banksService: BanksService,
    private readonly notifications: NotificationsService,
    private readonly creditsService: CreditsService,
    private readonly qualityService: PurchaseQualityService,
    private readonly processRuns: ProcessRunsService,
  ) {}

  async findAll(query: PurchaseListQueryDto) {
    const filteredQb = this.buildPurchaseFilterQb(query);
    const [totals, page] = await Promise.all([
      sumFilteredQueryBuilder(filteredQb, [
        {
          key: 'subtotal',
          sql: 'COALESCE(SUM(purchase.subtotal::numeric), 0)',
        },
        { key: 'total', sql: 'COALESCE(SUM(purchase.total::numeric), 0)' },
        {
          key: 'paidAmount',
          sql: 'COALESCE(SUM(purchase.paid_amount::numeric), 0)',
        },
      ]),
      paginatedQueryBuilder(
        filteredQb
          .clone()
          .leftJoinAndSelect('purchase.supplier', 'supplier')
          .leftJoinAndSelect('purchase.location', 'location')
          .leftJoinAndSelect('purchase.lines', 'lines')
          .leftJoinAndSelect('lines.item', 'item')
          .leftJoinAndSelect('lines.lot', 'lot')
          .leftJoinAndSelect('purchase.credit', 'credit')
          .leftJoinAndSelect('purchase.bankAccount', 'bankAccount')
          .orderBy('purchase.created_at', 'DESC'),
        query.page,
        query.limit,
      ),
    ]);

    return {
      ...page,
      data: page.data.map((p) => this.serializeListRow(p)),
      totals,
    };
  }

  private buildPurchaseFilterQb(query: PurchaseListQueryDto) {
    const includeVoided = query.includeVoided === 'true';
    const qb = this.purchaseRepo.createQueryBuilder('purchase');

    if (!includeVoided) {
      qb.andWhere('purchase.status = :status', {
        status: DocumentStatus.ACTIVE,
      });
    }
    if (query.supplierId) {
      qb.andWhere('purchase.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }
    if (query.locationId) {
      qb.andWhere('purchase.location_id = :locationId', {
        locationId: query.locationId,
      });
    }
    if (query.paymentMethod) {
      qb.andWhere('purchase.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    if (query.purchaseType) {
      qb.andWhere('purchase.purchase_type = :purchaseType', {
        purchaseType: query.purchaseType,
      });
    }
    applyRelatedIlikeSearch(qb, query.search, ['purchase.notes'], {
      table: 'suppliers',
      alias: 'supplier_filter',
      parentKey: 'purchase.supplier_id',
      relatedKey: 'id',
      columns: ['name', 'phone'],
    });
    applyDateRangeToQb(qb, 'purchase.created_at', query.from, query.to);

    return qb;
  }

  async findOne(id: string) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id },
      relations: {
        supplier: true,
        location: true,
        lines: { item: true, lot: true },
        credit: true,
        bankAccount: true,
      },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    const [hasCreditPayments, qualityResults, processRuns] =
      await Promise.all([
        purchase.credit
          ? this.hasSubsequentCreditPayments(purchase.credit.id)
          : Promise.resolve(false),
        this.qualityService.listForPurchase(id),
        this.processRuns.listForPurchase(id),
      ]);
    return {
      ...this.serialize(purchase, hasCreditPayments, qualityResults),
      processRuns,
    };
  }

  private serializeListRow(purchase: Purchase) {
    const total = parseFloat(purchase.total);
    const paid = parseFloat(purchase.paidAmount ?? '0');
    const outstanding = this.outstandingFor(purchase, total, paid);
    return {
      ...purchase,
      outstandingAmount: outstanding.toFixed(2),
      creditDueDate: purchase.credit?.dueDate ?? null,
      supplierCredit: purchase.credit ?? null,
    };
  }

  private serialize(
    purchase: Purchase,
    hasCreditPayments: boolean,
    qualityResults: ReturnType<PurchaseQualityService['serialize']>[] = [],
  ) {
    const total = parseFloat(purchase.total);
    const paid = parseFloat(purchase.paidAmount ?? '0');
    const outstanding = this.outstandingFor(purchase, total, paid);
    const qualityByLine = new Map(
      qualityResults.map((q) => [q.purchaseLineId, q]),
    );
    return {
      ...purchase,
      lines: (purchase.lines ?? []).map((line) => ({
        ...line,
        quality: qualityByLine.get(line.id) ?? null,
      })),
      qualityResults,
      outstandingAmount: outstanding.toFixed(2),
      creditDueDate: purchase.credit?.dueDate ?? null,
      supplierCredit: purchase.credit ?? null,
      hasCreditPayments,
    };
  }

  private outstandingFor(purchase: Purchase, total: number, paid: number) {
    if (
      purchase.paymentMethod === PaymentMethod.CREDIT ||
      purchase.paymentMethod === PaymentMethod.PARTIAL
    ) {
      if (purchase.credit) {
        return parseFloat(purchase.credit.balance);
      }
      return Math.max(0, total - paid);
    }
    return 0;
  }

  private isNotesOnlyUpdate(dto: UpdatePurchaseDto): boolean {
    const keys = (Object.keys(dto) as (keyof UpdatePurchaseDto)[]).filter(
      (k) => dto[k] !== undefined,
    );
    return keys.length === 1 && keys[0] === 'notes';
  }

  private resolveLines(
    purchase: Purchase,
    dto: UpdatePurchaseDto,
  ): PurchaseLineDto[] {
    if (dto.lines) return dto.lines;
    return purchase.lines.map((l) => ({
      itemId: l.itemId,
      lotId: l.lotId ?? undefined,
      quantity: parseFloat(l.quantity),
      unitPrice: parseFloat(l.unitPrice),
    }));
  }

  private async validatePurchaseLines(
    lines: PurchaseLineDto[],
    manager: EntityManager,
  ) {
    const itemRepo = manager.getRepository(Item);
    const lotRepo = manager.getRepository(Lot);

    for (const line of lines) {
      const item = await itemRepo.findOne({ where: { id: line.itemId } });
      if (!item) {
        throw new BadRequestException(`Item not found: ${line.itemId}`);
      }
      const isCoffee = this.stockService.isCoffeeItem(item);
      if (isCoffee && !line.lotId) {
        throw new BadRequestException(
          `Coffee item ${item.sku ?? item.description} requires lotId on purchase line`,
        );
      }
      if (line.lotId) {
        const lot = await lotRepo.findOne({ where: { id: line.lotId } });
        if (!lot) throw new BadRequestException('Lot not found');
        if (lot.status !== LotStatus.ACTIVE) {
          throw new BadRequestException(`Lot ${lot.code} is not active`);
        }
        if (lot.itemId && lot.itemId !== line.itemId) {
          throw new BadRequestException(
            `Lot ${lot.code} does not match purchase line item`,
          );
        }
      } else if (line.quality) {
        throw new BadRequestException(
          'ECTA quality results require a coffee lot on the purchase line',
        );
      }
    }
  }

  private toPurchaseLines(lines: PurchaseLineDto[]): PurchaseLine[] {
    return lines.map((l) => {
      const lineTotal = l.quantity * l.unitPrice;
      return Object.assign(new PurchaseLine(), {
        itemId: l.itemId,
        lotId: l.lotId ?? null,
        quantity: l.quantity.toFixed(3),
        unitPrice: l.unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });
    });
  }

  /** Receive stock onto lines (lot-scoped for coffee) and sync lot qty / events. */
  private async applyReceiveLines(
    manager: EntityManager,
    purchaseId: string,
    locationId: string,
    lines: PurchaseLineDto[],
    savedLines: PurchaseLine[],
    userId?: string,
    purchaseType: PurchaseType = PurchaseType.LOCAL,
  ) {
    const lotRepo = manager.getRepository(Lot);
    const eventRepo = manager.getRepository(LotEvent);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const savedLine = savedLines[i];
      const lotId = line.lotId ?? null;

      await this.stockService.adjust(
        {
          locationId,
          itemId: line.itemId,
          quantityDelta: line.quantity,
          purchasePrice: line.unitPrice,
          lotId,
          meta: this.stockMeta(purchaseId, userId, purchaseType),
        },
        manager,
      );

      if (lotId) {
        const lot = await lotRepo.findOne({ where: { id: lotId } });
        if (lot) {
          lot.quantity = (
            parseFloat(lot.quantity) + line.quantity
          ).toFixed(3);
          if (lot.locationId !== locationId) {
            lot.locationId = locationId;
          }
          if (!lot.itemId) {
            lot.itemId = line.itemId;
          }
          await lotRepo.save(lot);
          await eventRepo.save(
            eventRepo.create({
              lotId,
              eventType: LotEventType.COLLECTED,
              quantity: line.quantity.toFixed(3),
              toLocationId: locationId,
              notes: `Purchase ${purchaseId.slice(0, 8)} (${purchaseType})`,
              createdById: userId ?? null,
              metadata: {
                purchaseId,
                purchaseLineId: savedLine?.id ?? null,
                purchaseType,
              },
            }),
          );
        }
      }

      if (savedLine) {
        await this.qualityService.saveInlineQuality(
          manager,
          purchaseId,
          savedLine,
          line.quality,
          userId,
        );
      }
    }
  }

  /** Reverse previously received purchase stock (used by update/void). */
  private async reverseReceiveLines(
    manager: EntityManager,
    purchase: Purchase,
    userId: string | undefined,
    reason: string,
  ) {
    const lotRepo = manager.getRepository(Lot);
    const eventRepo = manager.getRepository(LotEvent);

    for (const line of purchase.lines) {
      const qty = parseFloat(line.quantity);
      const lotId = line.lotId ?? null;
      await this.stockService.adjust(
        {
          locationId: purchase.locationId,
          itemId: line.itemId,
          quantityDelta: -qty,
          lotId,
          meta: {
            ...this.stockMeta(purchase.id, userId, purchase.purchaseType),
            notes: reason,
          },
        },
        manager,
      );

      if (lotId) {
        const lot = await lotRepo.findOne({ where: { id: lotId } });
        if (lot) {
          lot.quantity = Math.max(0, parseFloat(lot.quantity) - qty).toFixed(3);
          await lotRepo.save(lot);
          await eventRepo.save(
            eventRepo.create({
              lotId,
              eventType: LotEventType.ADJUSTED,
              quantity: qty.toFixed(3),
              fromLocationId: purchase.locationId,
              notes: reason,
              createdById: userId ?? null,
              metadata: { purchaseId: purchase.id, purchaseLineId: line.id },
            }),
          );
        }
      }
    }
  }

  /** Cash, bank transfer, or partial deposit — posts a bank ledger outflow. */
  private paysViaBank(method: PaymentMethod): boolean {
    return (
      method === PaymentMethod.BANK ||
      method === PaymentMethod.CASH ||
      method === PaymentMethod.PARTIAL
    );
  }

  private createsSupplierCredit(method: PaymentMethod): boolean {
    return (
      method === PaymentMethod.CREDIT || method === PaymentMethod.PARTIAL
    );
  }

  private resolveAmountPaid(
    method: PaymentMethod,
    total: number,
    amountPaid?: number,
  ): number {
    if (method === PaymentMethod.CREDIT) return 0;
    if (method === PaymentMethod.CASH || method === PaymentMethod.BANK) {
      return total;
    }
    if (method === PaymentMethod.PARTIAL) {
      if (amountPaid === undefined || amountPaid === null) {
        throw new BadRequestException(
          'amountPaid is required for partially paid purchases',
        );
      }
      if (!(amountPaid > 0) || !(amountPaid < total)) {
        throw new BadRequestException(
          'amountPaid must be greater than 0 and less than the purchase total',
        );
      }
      return amountPaid;
    }
    return total;
  }

  private async hasSubsequentCreditPayments(
    creditId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager
      ? manager.getRepository(BankTransaction)
      : this.dataSource.getRepository(BankTransaction);
    const count = await repo.count({
      where: { refType: 'supplier_credit_payment', refId: creditId },
    });
    return count > 0;
  }

  private assertBankAccountRequired(
    method: PaymentMethod,
    bankAccountId: string | null | undefined,
  ) {
    if (this.paysViaBank(method) && !bankAccountId) {
      throw new BadRequestException(
        method === PaymentMethod.CASH
          ? 'bankAccountId (cash till) required for CASH payments'
          : 'bankAccountId required for bank transfer and partially paid purchases',
      );
    }
  }

  private stockMeta(
    purchaseId: string,
    userId?: string,
    purchaseType?: PurchaseType,
  ) {
    const market = purchaseType ?? PurchaseType.LOCAL;
    return {
      sourceType: StockMovementSourceType.PURCHASE,
      referenceType: 'purchase',
      referenceId: purchaseId,
      reference: `purchaseType:${market}`,
      notes: `Purchase type ${market === PurchaseType.EXPORT ? 'Export' : 'Local market'}`,
      createdById: userId ?? null,
    };
  }

  async update(id: string, dto: UpdatePurchaseDto, userId?: string) {
    if (this.isNotesOnlyUpdate(dto)) {
      const purchase = await this.purchaseRepo.findOne({ where: { id } });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Cannot update a voided purchase');
      }
      purchase.notes = dto.notes ?? null;
      await this.purchaseRepo.save(purchase);
      return this.findOne(id);
    }

    const hasFields = (Object.keys(dto) as (keyof UpdatePurchaseDto)[]).some(
      (k) => dto[k] !== undefined,
    );
    if (!hasFields) return this.findOne(id);

    await this.dataSource.transaction(async (manager) => {
      const purchaseRepo = manager.getRepository(Purchase);
      const lineRepo = manager.getRepository(PurchaseLine);
      const creditRepo = manager.getRepository(SupplierCredit);

      const purchase = await purchaseRepo.findOne({
        where: { id },
        relations: { lines: true, credit: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Cannot update a voided purchase');
      }

      if (purchase.credit) {
        const locked = await this.hasSubsequentCreditPayments(
          purchase.credit.id,
          manager,
        );
        if (locked) {
          throw new BadRequestException(
            'Cannot change purchase after supplier credit payments; only notes may be updated',
          );
        }
      }

      const supplierId = dto.supplierId ?? purchase.supplierId;
      const locationId = dto.locationId ?? purchase.locationId;
      const purchaseType = dto.purchaseType ?? purchase.purchaseType;
      const paymentMethod = dto.paymentMethod ?? purchase.paymentMethod;
      const bankAccountId =
        dto.bankAccountId !== undefined
          ? dto.bankAccountId
          : purchase.bankAccountId;
      const notes =
        dto.notes !== undefined ? (dto.notes ?? null) : purchase.notes;
      const creditDueDate =
        dto.creditDueDate !== undefined
          ? dto.creditDueDate
          : (purchase.credit?.dueDate ?? undefined);
      const lines = this.resolveLines(purchase, dto);
      await this.validatePurchaseLines(lines, manager);

      this.assertBankAccountRequired(paymentMethod, bankAccountId);
      if (this.paysViaBank(paymentMethod) && bankAccountId) {
        await this.banksService.assertPaymentAccount(
          paymentMethod,
          bankAccountId,
          manager,
        );
      }

      const subtotal = lines.reduce(
        (sum, l) => sum + l.quantity * l.unitPrice,
        0,
      );
      const amountPaid = this.resolveAmountPaid(
        paymentMethod,
        subtotal,
        dto.amountPaid !== undefined
          ? dto.amountPaid
          : paymentMethod === PaymentMethod.PARTIAL
            ? parseFloat(purchase.paidAmount)
            : undefined,
      );

      const oldPaymentMethod = purchase.paymentMethod;
      const oldBankAccountId = purchase.bankAccountId;

      await this.processRuns.releasePurchaseWorkflow(
        manager,
        purchase.id,
        userId,
      );
      await this.reverseReceiveLines(
        manager,
        purchase,
        userId,
        'Purchase adjustment (reverse)',
      );

      if (this.paysViaBank(oldPaymentMethod) && oldBankAccountId) {
        await this.bankLedger.reverseByReference(
          'purchase',
          purchase.id,
          `Adjust purchase ${purchase.id}`,
          userId,
          manager,
        );
      }

      if (purchase.credit) {
        await creditRepo.remove(purchase.credit);
      }

      await lineRepo.delete({ purchaseId: purchase.id });

      purchase.supplierId = supplierId;
      purchase.locationId = locationId;
      purchase.purchaseType = purchaseType;
      purchase.paymentMethod = paymentMethod;
      purchase.bankAccountId = bankAccountId ?? null;
      purchase.subtotal = subtotal.toFixed(2);
      purchase.total = subtotal.toFixed(2);
      purchase.paidAmount = amountPaid.toFixed(2);
      purchase.notes = notes;
      purchase.lines = this.toPurchaseLines(lines);

      const saved = await purchaseRepo.save(purchase);

      await this.applyReceiveLines(
        manager,
        saved.id,
        locationId,
        lines,
        saved.lines ?? purchase.lines,
        userId,
        purchaseType,
      );

      if (this.paysViaBank(paymentMethod) && bankAccountId && amountPaid > 0) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId,
            type: BankTransactionType.PURCHASE,
            amount: amountPaid,
            direction: 'out',
            description:
              paymentMethod === PaymentMethod.PARTIAL
                ? `Purchase ${purchase.id} (partial payment)`
                : `Purchase ${purchase.id}`,
            refType: 'purchase',
            refId: purchase.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (this.createsSupplierCredit(paymentMethod)) {
        const balance = Math.max(0, subtotal - amountPaid);
        await creditRepo.save(
          creditRepo.create({
            supplierId,
            purchaseId: purchase.id,
            amount: subtotal.toFixed(2),
            paidAmount: amountPaid.toFixed(2),
            balance: balance.toFixed(2),
            status:
              balance <= 0
                ? CreditStatus.PAID
                : amountPaid > 0
                  ? CreditStatus.PARTIAL
                  : CreditStatus.OPEN,
            dueDate: creditDueDate ?? null,
          }),
        );
      }
    });

    return this.findOne(id);
  }

  async void(id: string, userId?: string) {
    await this.dataSource.transaction(async (manager) => {
      const purchaseRepo = manager.getRepository(Purchase);
      const creditRepo = manager.getRepository(SupplierCredit);

      const purchase = await purchaseRepo.findOne({
        where: { id },
        relations: { lines: true, credit: true },
      });
      if (!purchase) throw new NotFoundException('Purchase not found');
      if (purchase.status === DocumentStatus.VOIDED) {
        throw new BadRequestException('Purchase already voided');
      }
      const createdAt = new Date(purchase.createdAt).getTime();
      const voidWindowMs = 7 * 24 * 60 * 60 * 1000;
      if (
        Number.isNaN(createdAt) ||
        Date.now() - createdAt > voidWindowMs
      ) {
        throw new BadRequestException(
          'A purchase can only be voided within 7 days of creation',
        );
      }

      if (purchase.credit) {
        const locked = await this.hasSubsequentCreditPayments(
          purchase.credit.id,
          manager,
        );
        if (locked) {
          throw new BadRequestException(
            'Cannot void purchase with additional supplier credit payments applied',
          );
        }
        await creditRepo.remove(purchase.credit);
      }

      await this.processRuns.releasePurchaseWorkflow(
        manager,
        purchase.id,
        userId,
      );
      await this.reverseReceiveLines(
        manager,
        purchase,
        userId,
        'Purchase void',
      );

      if (this.paysViaBank(purchase.paymentMethod) && purchase.bankAccountId) {
        await this.bankLedger.reverseByReference(
          'purchase',
          purchase.id,
          `Void purchase ${purchase.id}`,
          userId,
          manager,
        );
      }

      purchase.status = DocumentStatus.VOIDED;
      purchase.voidedAt = new Date();
      await purchaseRepo.save(purchase);
    });

    return this.findOne(id);
  }

  async create(dto: CreatePurchaseDto, userId?: string) {
    this.assertBankAccountRequired(dto.paymentMethod, dto.bankAccountId);

    const subtotal = dto.lines.reduce(
      (sum, l) => sum + l.quantity * l.unitPrice,
      0,
    );
    const amountPaid = this.resolveAmountPaid(
      dto.paymentMethod,
      subtotal,
      dto.amountPaid,
    );

    if (this.createsSupplierCredit(dto.paymentMethod)) {
      const creditPortion = subtotal - amountPaid;
      if (creditPortion > 0) {
        await this.creditsService.assertSupplierWithinLimit(
          dto.supplierId,
          creditPortion,
        );
      }
    }

    const purchaseId = await this.dataSource.transaction(async (manager) => {
      if (this.paysViaBank(dto.paymentMethod) && dto.bankAccountId) {
        await this.banksService.assertPaymentAccount(
          dto.paymentMethod,
          dto.bankAccountId,
          manager,
        );
      }

      const purchaseRepo = manager.getRepository(Purchase);
      const creditRepo = manager.getRepository(SupplierCredit);

      await this.validatePurchaseLines(dto.lines, manager);
      const lineEntities = this.toPurchaseLines(dto.lines);

      const purchase = await purchaseRepo.save(
        purchaseRepo.create({
          supplierId: dto.supplierId,
          locationId: dto.locationId,
          purchaseType: dto.purchaseType,
          paymentMethod: dto.paymentMethod,
          bankAccountId: dto.bankAccountId ?? null,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          paidAmount: amountPaid.toFixed(2),
          notes: dto.notes ?? null,
          status: DocumentStatus.ACTIVE,
          createdById: userId ?? null,
          lines: lineEntities,
        }),
      );

      await this.applyReceiveLines(
        manager,
        purchase.id,
        dto.locationId,
        dto.lines,
        purchase.lines ?? lineEntities,
        userId,
        purchase.purchaseType,
      );

      if (
        this.paysViaBank(dto.paymentMethod) &&
        dto.bankAccountId &&
        amountPaid > 0
      ) {
        await this.bankLedger.recordTransaction(
          {
            bankAccountId: dto.bankAccountId,
            type: BankTransactionType.PURCHASE,
            amount: amountPaid,
            direction: 'out',
            description:
              dto.paymentMethod === PaymentMethod.PARTIAL
                ? `Purchase ${purchase.id} (partial payment)`
                : `Purchase ${purchase.id}`,
            refType: 'purchase',
            refId: purchase.id,
            createdById: userId,
          },
          manager,
        );
      }

      if (this.createsSupplierCredit(dto.paymentMethod)) {
        const balance = Math.max(0, subtotal - amountPaid);
        await creditRepo.save(
          creditRepo.create({
            supplierId: dto.supplierId,
            purchaseId: purchase.id,
            amount: subtotal.toFixed(2),
            paidAmount: amountPaid.toFixed(2),
            balance: balance.toFixed(2),
            status:
              balance <= 0
                ? CreditStatus.PAID
                : amountPaid > 0
                  ? CreditStatus.PARTIAL
                  : CreditStatus.OPEN,
            dueDate: dto.creditDueDate ?? null,
          }),
        );
      }

      return purchase.id;
    });

    await this.notifications.onPurchaseRecorded({
      purchaseId,
      total: subtotal.toFixed(2),
      actorUserId: userId,
      creditDueDate: dto.creditDueDate ?? null,
    });

    return this.findOne(purchaseId);
  }
}
