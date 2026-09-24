import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  BankAccountType,
  BankTransactionDirection,
  BankTransactionType,
  CoffeeForm,
  CreditStatus,
  DocumentStatus,
  ExportContractStatus,
  Incoterm,
  ItemType,
  LotEventType,
  LotStatus,
  NotificationType,
  PaymentMethod,
  ProcessRunStatus,
  SaleChannel,
  TransferStatus,
} from '../common/enums';
import { BankAccount } from './entities/bank-account.entity';
import { BankTransaction } from './entities/bank-transaction.entity';
import { CollectionTicket } from './entities/collection-ticket.entity';
import { Customer } from './entities/customer.entity';
import { CustomerCredit } from './entities/customer-credit.entity';
import { Expense } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { ExportAllocation } from './entities/export-allocation.entity';
import { ExportContract } from './entities/export-contract.entity';
import { Item } from './entities/item.entity';
import { Location } from './entities/location.entity';
import { Lot } from './entities/lot.entity';
import { LotEvent } from './entities/lot-event.entity';
import { Notification } from './entities/notification.entity';
import { ProcessRun } from './entities/process-run.entity';
import { ProcessTemplate } from './entities/process-template.entity';
import { Purchase } from './entities/purchase.entity';
import { PurchaseLine } from './entities/purchase-line.entity';
import { RoastProfile } from './entities/roast-profile.entity';
import { Sale } from './entities/sale.entity';
import { SaleLine } from './entities/sale-line.entity';
import { StockLevel } from './entities/stock-level.entity';
import { StockTransfer } from './entities/stock-transfer.entity';
import { StockTransferLine } from './entities/stock-transfer-line.entity';
import { Supplier } from './entities/supplier.entity';
import { User } from './entities/user.entity';

const MARKER_LOT = 'LOT-EXEC-GREEN-01';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return n.toFixed(2);
}

function qty(n: number): string {
  return n.toFixed(3);
}

/**
 * Rich, idempotent demo pack so Command Center / AI / ops screens
 * look realistic for executive walkthroughs.
 */
export async function seedExecutiveDemo(
  dataSource: DataSource,
  logger: Logger,
): Promise<void> {
  const lotRepo = dataSource.getRepository(Lot);
  const marker = await lotRepo.findOne({ where: { code: MARKER_LOT } });
  if (marker) {
    logger.log('Executive demo pack already present — skip');
    return;
  }

  logger.log('Seeding executive demo pack…');

  const userRepo = dataSource.getRepository(User);
  const locRepo = dataSource.getRepository(Location);
  const itemRepo = dataSource.getRepository(Item);
  const stockRepo = dataSource.getRepository(StockLevel);
  const eventRepo = dataSource.getRepository(LotEvent);
  const supplierRepo = dataSource.getRepository(Supplier);
  const customerRepo = dataSource.getRepository(Customer);
  const bankRepo = dataSource.getRepository(BankAccount);
  const txnRepo = dataSource.getRepository(BankTransaction);
  const collectionRepo = dataSource.getRepository(CollectionTicket);
  const purchaseRepo = dataSource.getRepository(Purchase);
  const purchaseLineRepo = dataSource.getRepository(PurchaseLine);
  const saleRepo = dataSource.getRepository(Sale);
  const saleLineRepo = dataSource.getRepository(SaleLine);
  const creditRepo = dataSource.getRepository(CustomerCredit);
  const expenseCatRepo = dataSource.getRepository(ExpenseCategory);
  const expenseRepo = dataSource.getRepository(Expense);
  const exportRepo = dataSource.getRepository(ExportContract);
  const allocRepo = dataSource.getRepository(ExportAllocation);
  const transferRepo = dataSource.getRepository(StockTransfer);
  const transferLineRepo = dataSource.getRepository(StockTransferLine);
  const templateRepo = dataSource.getRepository(ProcessTemplate);
  const processRepo = dataSource.getRepository(ProcessRun);
  const roastRepo = dataSource.getRepository(RoastProfile);
  const notifRepo = dataSource.getRepository(Notification);

  const admin =
    (await userRepo.findOne({ where: { email: 'admin@csolve.local' } })) ??
    (await userRepo.findOne({ where: { email: 'admin@stock.local' } }));
  const userId = admin?.id ?? null;

  const loc = async (name: string) => {
    const found = await locRepo.findOne({ where: { name } });
    if (!found) throw new Error(`Missing location: ${name}`);
    return found;
  };

  const warehouse = await loc('Main Warehouse');
  const collection = await loc('Yirgacheffe Collection Center');
  const wetMill = await loc('Yirgacheffe Wet Mill');
  const roastery = await loc('Csolve Roastery');
  const showroom = await loc('Local Showroom');
  const staging = await loc('Export Staging');

  const itemBySku = async (sku: string, fallback?: Partial<Item>) => {
    let item = await itemRepo.findOne({ where: { sku } });
    if (!item && fallback) {
      item = await itemRepo.save(
        itemRepo.create({
          sku,
          description: fallback.description ?? sku,
          unit: fallback.unit ?? 'kg',
          itemType: fallback.itemType ?? ItemType.OTHER,
          isActive: true,
        }),
      );
    }
    if (!item) throw new Error(`Missing item ${sku}`);
    return item;
  };

  const green = await itemBySku('COF-GREEN-G1');
  const cherry = await itemBySku('COF-CHERRY');
  const parchment = await itemBySku('COF-PARCHMENT');
  const roasted = await itemBySku('COF-ROAST-250');
  const bags = await itemBySku('PKG-JUTE-60', {
    description: 'Jute export bag 60kg',
    unit: 'pcs',
    itemType: ItemType.OTHER,
  });
  const labels = await itemBySku('PKG-LABEL-LOCAL', {
    description: 'Local roast label roll',
    unit: 'pcs',
    itemType: ItemType.OTHER,
  });

  const ensureSupplier = async (data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  }) => {
    let s = await supplierRepo.findOne({ where: { name: data.name } });
    if (!s) {
      s = await supplierRepo.save(
        supplierRepo.create({
          name: data.name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          isActive: true,
        }),
      );
    }
    return s;
  };

  const farmers = [
    await ensureSupplier({
      name: 'Abebe Cooperative — Aricha',
      phone: '+251911100001',
      email: 'aricha@coop.csolve.local',
      address: 'Aricha, Yirgacheffe',
    }),
    await ensureSupplier({
      name: 'Tigist Smallholder Group',
      phone: '+251911100002',
      address: 'Konga, Yirgacheffe',
    }),
    await ensureSupplier({
      name: 'Sidama Bensa Natural Union',
      phone: '+251911100003',
      email: 'bensa@sidama.csolve.local',
      address: 'Bensa, Sidama',
    }),
    await ensureSupplier({
      name: 'Addis Pack Supplies PLC',
      phone: '+251911200010',
      email: 'sales@pack.csolve.local',
      address: 'Addis Ababa industrial zone',
    }),
  ];

  const ensureCustomer = async (data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: string;
  }) => {
    let c = await customerRepo.findOne({ where: { name: data.name } });
    if (!c) {
      c = await customerRepo.save(
        customerRepo.create({
          name: data.name,
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          creditLimit: data.creditLimit ?? null,
          isActive: true,
        }),
      );
    } else if (data.creditLimit != null && !c.creditLimit) {
      c.creditLimit = data.creditLimit;
      c = await customerRepo.save(c);
    }
    return c;
  };

  const customers = [
    await ensureCustomer({
      name: 'Tomoca Café Group',
      phone: '+251911300001',
      email: 'orders@tomoca.demo',
      address: 'Addis Ababa',
      creditLimit: '500000.00',
    }),
    await ensureCustomer({
      name: 'Sheraton Addis F&B',
      phone: '+251911300002',
      email: 'fnb@sheraton.demo',
      address: 'Addis Ababa',
      creditLimit: '750000.00',
    }),
    await ensureCustomer({
      name: 'Nordic Specialty Roasters',
      email: 'buy@nordic.demo',
      address: 'Oslo, Norway',
      creditLimit: '2000000.00',
    }),
    await ensureCustomer({
      name: 'Tokyo Cupping Lab KK',
      email: 'import@tokyo.demo',
      address: 'Tokyo, Japan',
      creditLimit: '1500000.00',
    }),
    await ensureCustomer({
      name: 'Kaldi Local Wholesale',
      phone: '+251911300005',
      address: 'Bole, Addis Ababa',
      creditLimit: '300000.00',
    }),
  ];

  const etbBank =
    (await bankRepo.findOne({ where: { accountNumber: 'MAIN-001' } })) ??
    (await bankRepo.findOne({ where: { accountType: BankAccountType.BANK } }));
  const cash =
    (await bankRepo.findOne({ where: { accountNumber: 'CASH-001' } })) ??
    (await bankRepo.findOne({ where: { accountType: BankAccountType.CASH } }));
  const usdBank = await bankRepo.findOne({
    where: { accountNumber: 'USD-001' },
  });

  if (etbBank) {
    etbBank.balance = money(2_450_000);
    await bankRepo.save(etbBank);
  }
  if (cash) {
    cash.balance = money(186_500);
    await bankRepo.save(cash);
  }
  if (usdBank) {
    usdBank.balance = money(52_400);
    await bankRepo.save(usdBank);
  }

  const postTxn = async (opts: {
    account: BankAccount;
    type: BankTransactionType;
    direction: BankTransactionDirection;
    amount: number;
    description: string;
    days: number;
    balanceAfter: number;
  }) => {
    const row = txnRepo.create({
      bankAccountId: opts.account.id,
      type: opts.type,
      direction: opts.direction,
      amount: money(opts.amount),
      balanceAfter: money(opts.balanceAfter),
      description: opts.description,
      refType: 'demo',
      refId: null,
      createdById: userId,
    });
    const saved = await txnRepo.save(row);
    await txnRepo.update(saved.id, {
      createdAt: daysAgo(opts.days),
    } as any);
  };

  if (etbBank) {
    await postTxn({
      account: etbBank,
      type: BankTransactionType.OPENING,
      direction: BankTransactionDirection.IN,
      amount: 2_000_000,
      description: 'Opening balance FY26',
      days: 45,
      balanceAfter: 2_000_000,
    });
    await postTxn({
      account: etbBank,
      type: BankTransactionType.SALE,
      direction: BankTransactionDirection.IN,
      amount: 420_000,
      description: 'Local roast wholesale — Tomoca',
      days: 3,
      balanceAfter: 2_450_000,
    });
    await postTxn({
      account: etbBank,
      type: BankTransactionType.PURCHASE,
      direction: BankTransactionDirection.OUT,
      amount: 185_000,
      description: 'Cherry settlement — Aricha coop',
      days: 2,
      balanceAfter: 2_265_000,
    });
  }
  if (usdBank) {
    await postTxn({
      account: usdBank,
      type: BankTransactionType.OPENING,
      direction: BankTransactionDirection.IN,
      amount: 40_000,
      description: 'Export FX float',
      days: 40,
      balanceAfter: 40_000,
    });
    await postTxn({
      account: usdBank,
      type: BankTransactionType.SALE,
      direction: BankTransactionDirection.IN,
      amount: 12_400,
      description: 'Partial receipt — Nordic EXP',
      days: 8,
      balanceAfter: 52_400,
    });
  }

  const createLot = async (opts: {
    code: string;
    item: Item;
    location: Location;
    form: CoffeeForm;
    grade: string;
    qty: number;
    moisture?: number;
    region: string;
    woreda?: string;
    processMethod: string;
    status?: LotStatus;
    cost?: number;
    notes?: string;
    days?: number;
  }) => {
    const lot = await lotRepo.save(
      lotRepo.create({
        code: opts.code,
        itemId: opts.item.id,
        locationId: opts.location.id,
        form: opts.form,
        grade: opts.grade,
        cropYear: '2025/26',
        variety: 'Heirloom',
        processMethod: opts.processMethod,
        region: opts.region,
        woreda: opts.woreda ?? null,
        moisturePercent:
          opts.moisture != null ? opts.moisture.toFixed(2) : null,
        quantity: qty(opts.qty),
        status: opts.status ?? LotStatus.ACTIVE,
        notes: opts.notes ?? 'Executive demo lot',
        createdById: userId,
      }),
    );
    if (opts.days != null) {
      await lotRepo.update(lot.id, {
        createdAt: daysAgo(opts.days),
      } as any);
    }
    await eventRepo.save(
      eventRepo.create({
        lotId: lot.id,
        eventType: LotEventType.CREATED,
        quantity: qty(opts.qty),
        toLocationId: opts.location.id,
        notes: 'Executive demo seed',
        createdById: userId,
        metadata: { executiveDemo: true },
      }),
    );
    await stockRepo.save(
      stockRepo.create({
        locationId: opts.location.id,
        itemId: opts.item.id,
        lotId: lot.id,
        quantity: qty(opts.qty),
        purchasePrice: money(opts.cost ?? 280),
        reorderPoint: '0',
      }),
    );
    return lot;
  };

  const greenLots = [
    await createLot({
      code: MARKER_LOT,
      item: green,
      location: warehouse,
      form: CoffeeForm.GREEN,
      grade: 'G1',
      qty: 4800,
      moisture: 11.1,
      region: 'Yirgacheffe',
      woreda: 'Yirgacheffe',
      processMethod: 'Washed',
      cost: 420,
      notes: 'Flagship washed G1 — export ready',
      days: 28,
    }),
    await createLot({
      code: 'LOT-EXEC-GREEN-02',
      item: green,
      location: warehouse,
      form: CoffeeForm.GREEN,
      grade: 'G1',
      qty: 3200,
      moisture: 11.4,
      region: 'Yirgacheffe',
      woreda: 'Kochere',
      processMethod: 'Washed',
      cost: 410,
      days: 21,
    }),
    await createLot({
      code: 'LOT-EXEC-GREEN-03',
      item: green,
      location: warehouse,
      form: CoffeeForm.GREEN,
      grade: 'G2',
      qty: 2600,
      moisture: 10.9,
      region: 'Sidama',
      woreda: 'Bensa',
      processMethod: 'Natural',
      cost: 360,
      days: 18,
    }),
    await createLot({
      code: 'LOT-EXEC-GREEN-MOIST',
      item: green,
      location: warehouse,
      form: CoffeeForm.GREEN,
      grade: 'G1',
      qty: 900,
      moisture: 13.2,
      region: 'Guji',
      woreda: 'Shakiso',
      processMethod: 'Washed',
      cost: 400,
      status: LotStatus.HOLD,
      notes: 'Moisture hold — dry before export',
      days: 10,
    }),
  ];

  await createLot({
    code: 'LOT-EXEC-CHERRY-01',
    item: cherry,
    location: collection,
    form: CoffeeForm.CHERRY,
    grade: 'Cherry A',
    qty: 4200,
    moisture: 18.0,
    region: 'Yirgacheffe',
    woreda: 'Aricha',
    processMethod: 'Fresh',
    cost: 95,
    days: 1,
  });

  await createLot({
    code: 'LOT-EXEC-PARCH-01',
    item: parchment,
    location: wetMill,
    form: CoffeeForm.PARCHMENT,
    grade: 'Parchment',
    qty: 1800,
    moisture: 11.8,
    region: 'Yirgacheffe',
    woreda: 'Konga',
    processMethod: 'Washed',
    cost: 210,
    days: 5,
  });

  const roastLot = await createLot({
    code: 'LOT-EXEC-ROAST-01',
    item: roasted,
    location: showroom,
    form: CoffeeForm.ROASTED,
    grade: 'Retail',
    qty: 640,
    region: 'Blend',
    processMethod: 'Medium City',
    cost: 85,
    notes: 'Showroom roasted stock (bags)',
    days: 4,
  });

  await createLot({
    code: 'LOT-EXEC-ROAST-WIP',
    item: roasted,
    location: roastery,
    form: CoffeeForm.ROASTED,
    grade: 'Retail',
    qty: 220,
    region: 'Yirgacheffe',
    processMethod: 'Light filter',
    cost: 80,
    days: 1,
  });

  // Timeline depth on flagship green
  for (const [type, notes, d] of [
    [LotEventType.COLLECTED, 'Cherry intake from Aricha coop', 30],
    [LotEventType.PROCESS_COMPLETED, 'Wet + dry mill → green G1', 28],
    [LotEventType.QC_RELEASED, 'Cupping 85.5 — export release', 27],
    [LotEventType.TRANSFERRED, 'Moved to Main Warehouse', 26],
  ] as Array<[LotEventType, string, number]>) {
    const ev = await eventRepo.save(
      eventRepo.create({
        lotId: greenLots[0].id,
        eventType: type,
        quantity: qty(4800),
        notes,
        createdById: userId,
        metadata: { executiveDemo: true },
      }),
    );
    await eventRepo.update(ev.id, {
      createdAt: daysAgo(d),
    } as any);
  }

  // Collections across last 14 days (AI trends)
  const collectionDays = [13, 11, 9, 7, 5, 3, 2, 1, 0];
  let ticketSeq = 1;
  for (const day of collectionDays) {
    const farmer = farmers[day % 3];
    const weight = 1800 + (day % 5) * 220;
    const price = 92 + (day % 3);
    const total = weight * price;
    const lot = await createLot({
      code: `LOT-EXEC-COLL-${String(ticketSeq).padStart(2, '0')}`,
      item: cherry,
      location: collection,
      form: CoffeeForm.CHERRY,
      grade: 'Cherry A',
      qty: weight,
      region: 'Yirgacheffe',
      woreda: day % 2 === 0 ? 'Aricha' : 'Konga',
      processMethod: 'Fresh',
      cost: price,
      days: day,
    });
    // remove auto stock double-count later sold? keep as WIP cherry
    const purchase = await purchaseRepo.save(
      purchaseRepo.create({
        supplierId: farmer.id,
        locationId: collection.id,
        paymentMethod: day % 3 === 0 ? PaymentMethod.CREDIT : PaymentMethod.BANK,
        bankAccountId: day % 3 === 0 ? null : etbBank?.id ?? null,
        subtotal: money(total),
        total: money(total),
        notes: 'Executive demo cherry settlement',
        status: DocumentStatus.ACTIVE,
        createdById: userId,
      }),
    );
    await purchaseLineRepo.save(
      purchaseLineRepo.create({
        purchaseId: purchase.id,
        itemId: cherry.id,
        quantity: qty(weight),
        unitPrice: money(price),
        lineTotal: money(total),
      }),
    );
    const ticket = await collectionRepo.save(
      collectionRepo.create({
        ticketNumber: `COL-EXEC-${String(ticketSeq).padStart(3, '0')}`,
        supplierId: farmer.id,
        locationId: collection.id,
        itemId: cherry.id,
        lotId: lot.id,
        purchaseId: purchase.id,
        weightKg: qty(weight),
        grade: 'Cherry A',
        pricePerKg: money(price),
        totalAmount: money(total),
        paymentMethod:
          day % 3 === 0 ? PaymentMethod.CREDIT : PaymentMethod.BANK,
        bankAccountId: day % 3 === 0 ? null : etbBank?.id ?? null,
        moisturePercent: '17.50',
        cropYear: '2025/26',
        region: 'Yirgacheffe',
        woreda: day % 2 === 0 ? 'Aricha' : 'Konga',
        notes: 'Executive demo intake',
        status: DocumentStatus.ACTIVE,
        createdById: userId,
      }),
    );
    await collectionRepo.update(ticket.id, {
      createdAt: daysAgo(day),
    } as any);
    await eventRepo.save(
      eventRepo.create({
        lotId: lot.id,
        eventType: LotEventType.COLLECTED,
        quantity: qty(weight),
        toLocationId: collection.id,
        notes: `Ticket ${ticket.ticketNumber}`,
        createdById: userId,
      }),
    );
    ticketSeq += 1;
  }

  // Process runs: WIP + completed + QC hold
  const wetTpl = await templateRepo.findOne({ where: { code: 'WASHED-WET' } });
  const dryTpl = await templateRepo.findOne({ where: { code: 'DRY-MILL' } });
  const roastTpl = await templateRepo.findOne({ where: { code: 'ROAST-BATCH' } });
  const roastProfile = await roastRepo.findOne({ where: { code: 'MED-CITY' } });
  const cherryWip = await lotRepo.findOne({
    where: { code: 'LOT-EXEC-CHERRY-01' },
  });

  if (wetTpl && cherryWip) {
    await processRepo.save(
      processRepo.create({
        runNumber: 'PR-EXEC-WET-01',
        templateId: wetTpl.id,
        inputLotId: cherryWip.id,
        outputLotId: null,
        locationId: wetMill.id,
        quantityInput: qty(1500),
        quantityOutput: null,
        quantityReject: qty(0),
        expectedYieldPercent: wetTpl.expectedYieldPercent,
        actualYieldPercent: null,
        status: ProcessRunStatus.IN_PROGRESS,
        currentStageIndex: 2,
        stages: wetTpl.stages ?? ['Pulping', 'Fermentation', 'Washing', 'Drying'],
        stagesCompleted: ['Pulping', 'Fermentation'],
        processCost: money(12000),
        notes: 'Peak harvest wet mill — executive WIP',
        startedAt: daysAgo(1),
        createdById: userId,
      }),
    );
  }

  if (dryTpl) {
    const parch = await lotRepo.findOne({
      where: { code: 'LOT-EXEC-PARCH-01' },
    });
    if (parch) {
      await processRepo.save(
        processRepo.create({
          runNumber: 'PR-EXEC-DRY-QC',
          templateId: dryTpl.id,
          inputLotId: parch.id,
          outputLotId: null,
          locationId: wetMill.id,
          quantityInput: qty(600),
          quantityOutput: null,
          quantityReject: qty(0),
          expectedYieldPercent: dryTpl.expectedYieldPercent,
          actualYieldPercent: null,
          status: ProcessRunStatus.QC_HOLD,
          currentStageIndex: 1,
          stages: dryTpl.stages ?? ['Hulling', 'Grading', 'Hand-pick'],
          stagesCompleted: ['Hulling'],
          processCost: money(4500),
          notes: 'Moisture spike — QC hold',
          startedAt: daysAgo(2),
          createdById: userId,
        }),
      );
    }
  }

  if (roastTpl && greenLots[1] && roastProfile) {
    await processRepo.save(
      processRepo.create({
        runNumber: 'PR-EXEC-ROAST-OK',
        templateId: roastTpl.id,
        inputLotId: greenLots[1].id,
        outputLotId: roastLot.id,
        locationId: roastery.id,
        quantityInput: qty(200),
        quantityOutput: qty(168),
        quantityReject: qty(4),
        expectedYieldPercent: roastTpl.expectedYieldPercent,
        actualYieldPercent: '84.00',
        status: ProcessRunStatus.COMPLETED,
        currentStageIndex: 3,
        stages: roastTpl.stages ?? ['Charge', 'Development', 'Drop', 'Cool'],
        stagesCompleted: ['Charge', 'Development', 'Drop', 'Cool'],
        processCost: money(9800),
        notes: 'Completed MED-CITY for showroom',
        startedAt: daysAgo(5),
        completedAt: daysAgo(4),
        roastProfileId: roastProfile.id,
        createdById: userId,
      }),
    );
  }

  // Transfer: warehouse → staging (partial for export story)
  const transfer = await transferRepo.save(
    transferRepo.create({
      fromLocationId: warehouse.id,
      toLocationId: staging.id,
      status: TransferStatus.COMPLETED,
      notes: 'Pre-stage Nordic allocation',
      createdById: userId,
    }),
  );
  await transferLineRepo.save(
    transferLineRepo.create({
      transferId: transfer.id,
      itemId: green.id,
      lotId: greenLots[0].id,
      quantity: qty(1920),
    }),
  );
  // Reflect stock move on lot + levels
  const fromStock = await stockRepo.findOne({
    where: {
      locationId: warehouse.id,
      itemId: green.id,
      lotId: greenLots[0].id,
    },
  });
  if (fromStock) {
    fromStock.quantity = qty(Number(fromStock.quantity) - 1920);
    await stockRepo.save(fromStock);
  }
  await stockRepo.save(
    stockRepo.create({
      locationId: staging.id,
      itemId: green.id,
      lotId: greenLots[0].id,
      quantity: qty(1920),
      purchasePrice: money(420),
      reorderPoint: '0',
    }),
  );
  greenLots[0].locationId = staging.id;
  greenLots[0].quantity = qty(4800); // total still on lot; split across locations via stock_levels
  await lotRepo.save(greenLots[0]);
  await eventRepo.save(
    eventRepo.create({
      lotId: greenLots[0].id,
      eventType: LotEventType.TRANSFERRED,
      quantity: qty(1920),
      fromLocationId: warehouse.id,
      toLocationId: staging.id,
      notes: 'ST transfer executive demo',
      createdById: userId,
    }),
  );

  // Packaging purchase (non-lot)
  const packPurchase = await purchaseRepo.save(
    purchaseRepo.create({
      supplierId: farmers[3].id,
      locationId: warehouse.id,
      paymentMethod: PaymentMethod.BANK,
      bankAccountId: etbBank?.id ?? null,
      subtotal: money(78500),
      total: money(78500),
      notes: 'Jute bags + retail labels',
      status: DocumentStatus.ACTIVE,
      createdById: userId,
    }),
  );
  await purchaseLineRepo.save([
    purchaseLineRepo.create({
      purchaseId: packPurchase.id,
      itemId: bags.id,
      quantity: qty(500),
      unitPrice: money(95),
      lineTotal: money(47500),
    }),
    purchaseLineRepo.create({
      purchaseId: packPurchase.id,
      itemId: labels.id,
      quantity: qty(2000),
      unitPrice: money(15.5),
      lineTotal: money(31000),
    }),
  ]);
  await stockRepo.save(
    stockRepo.create({
      locationId: warehouse.id,
      itemId: bags.id,
      lotId: null,
      quantity: qty(500),
      purchasePrice: money(95),
      reorderPoint: '80',
    }),
  );
  await stockRepo.save(
    stockRepo.create({
      locationId: roastery.id,
      itemId: labels.id,
      lotId: null,
      quantity: qty(2000),
      purchasePrice: money(15.5),
      reorderPoint: '200',
    }),
  );

  // Local sales last 2 weeks
  const localSaleDays = [12, 10, 8, 6, 4, 3, 1];
  let saleIdx = 1;
  for (const day of localSaleDays) {
    const customer = customers[day % 3 === 0 ? 0 : day % 3 === 1 ? 1 : 4];
    const bagsSold = 24 + (day % 4) * 6;
    const unit = 320;
    const total = bagsSold * unit;
    const pay =
      day === 6 ? PaymentMethod.CREDIT : PaymentMethod.BANK;
    const sale = await saleRepo.save(
      saleRepo.create({
        customerId: customer.id,
        locationId: showroom.id,
        channel: SaleChannel.LOCAL,
        currencyCode: 'ETB',
        fxRate: null,
        exportContractId: null,
        paymentMethod: pay,
        bankAccountId: pay === PaymentMethod.BANK ? etbBank?.id ?? null : null,
        subtotal: money(total),
        total: money(total),
        notes: 'Executive demo local roast sale',
        status: DocumentStatus.ACTIVE,
        createdById: userId,
        soldByUserId: userId,
        commissionPercent: '5.00',
      }),
    );
    await saleLineRepo.save(
      saleLineRepo.create({
        saleId: sale.id,
        itemId: roasted.id,
        lotId: roastLot.id,
        quantity: qty(bagsSold),
        unitPrice: money(unit),
        purchaseCost: money(85),
        lineTotal: money(total),
      }),
    );
    await saleRepo.update(sale.id, {
      createdAt: daysAgo(day),
    } as any);
    await eventRepo.save(
      eventRepo.create({
        lotId: roastLot.id,
        eventType: LotEventType.SOLD_LOCAL,
        quantity: qty(bagsSold),
        fromLocationId: showroom.id,
        notes: `Sale ${saleIdx}`,
        createdById: userId,
      }),
    );
    if (pay === PaymentMethod.CREDIT) {
      await creditRepo.save(
        creditRepo.create({
          customerId: customer.id,
          saleId: sale.id,
          amount: money(total),
          paidAmount: money(0),
          balance: money(total),
          status: CreditStatus.OPEN,
          dueDate: isoDate(daysAgo(-14)),
        }),
      );
    }
    // reduce showroom roasted stock
    const rs = await stockRepo.findOne({
      where: {
        locationId: showroom.id,
        itemId: roasted.id,
        lotId: roastLot.id,
      },
    });
    if (rs) {
      rs.quantity = qty(Math.max(0, Number(rs.quantity) - bagsSold));
      await stockRepo.save(rs);
    }
    roastLot.quantity = qty(Math.max(0, Number(roastLot.quantity) - bagsSold));
    await lotRepo.save(roastLot);
    saleIdx += 1;
  }

  // Export contracts: allocated + staged narrative
  const nordic =
    (await exportRepo.findOne({ where: { contractNumber: 'EXP-DEMO-001' } })) ??
    null;
  if (nordic) {
    nordic.status = ExportContractStatus.ALLOCATED;
    nordic.allocatedKg = qty(1920);
    nordic.customerId = customers[2].id;
    nordic.docChecklist = [
      { key: 'COO', label: 'Certificate of Origin', done: true },
      { key: 'PHYTO', label: 'Phytosanitary certificate', done: true },
      { key: 'QC', label: 'QC / cupping certificate', done: false },
      { key: 'PACKING', label: 'Packing list', done: true },
      { key: 'INVOICE', label: 'Commercial invoice', done: false },
    ];
    nordic.packingList = [
      {
        lotId: greenLots[0].id,
        lotCode: greenLots[0].code,
        quantityKg: 1920,
        bags: 32,
        grade: 'G1',
      },
    ];
    await exportRepo.save(nordic);
    const existingAlloc = await allocRepo.findOne({
      where: { contractId: nordic.id, lotId: greenLots[0].id },
    });
    if (!existingAlloc) {
      await allocRepo.save(
        allocRepo.create({
          contractId: nordic.id,
          lotId: greenLots[0].id,
          quantityKg: qty(1920),
          notes: 'Executive demo allocation',
        }),
      );
    }
    await eventRepo.save(
      eventRepo.create({
        lotId: greenLots[0].id,
        eventType: LotEventType.ALLOCATED_EXPORT,
        quantity: qty(1920),
        notes: `Allocated to ${nordic.contractNumber}`,
        createdById: userId,
        metadata: { contractNumber: nordic.contractNumber },
      }),
    );
  }

  const tokyoExisting = await exportRepo.findOne({
    where: { contractNumber: 'EXP-EXEC-TOKYO-01' },
  });
  if (!tokyoExisting) {
    const tokyo = await exportRepo.save(
      exportRepo.create({
        contractNumber: 'EXP-EXEC-TOKYO-01',
        buyerName: 'Tokyo Cupping Lab KK',
        customerId: customers[3].id,
        volumeKg: qty(9600),
        grade: 'G1',
        pricePerKg: '5.1500',
        currencyCode: 'USD',
        incoterm: Incoterm.CIF,
        windowStart: isoDate(daysAgo(-20)),
        windowEnd: isoDate(daysAgo(-50)),
        status: ExportContractStatus.DRAFT,
        allocatedKg: qty(0),
        shippedKg: qty(0),
        stagingLocationId: staging.id,
        bankAccountId: usdBank?.id ?? null,
        packingList: [],
        docChecklist: [
          { key: 'COO', label: 'Certificate of Origin', done: false },
          { key: 'PHYTO', label: 'Phytosanitary certificate', done: false },
          { key: 'QC', label: 'QC / cupping certificate', done: false },
          { key: 'PACKING', label: 'Packing list', done: false },
          { key: 'INVOICE', label: 'Commercial invoice', done: false },
        ],
        notes: 'Q4 Japan specialty — needs allocation',
        createdById: userId,
      }),
    );
    void tokyo;
  }

  // Expenses
  const ensureCat = async (name: string, description: string) => {
    let c = await expenseCatRepo.findOne({ where: { name } });
    if (!c) {
      c = await expenseCatRepo.save(
        expenseCatRepo.create({ name, description }),
      );
    }
    return c;
  };
  const millCat = await ensureCat('Mill operations', 'Wet/dry mill utilities & labor');
  const logisticsCat = await ensureCat('Logistics', 'Transport & CFS');
  const labCat = await ensureCat('QC / Lab', 'Cupping & lab consumables');

  if (etbBank) {
    const expenseDefs = [
      { cat: millCat, amount: 48500, days: 9, desc: 'Wet mill diesel & labor' },
      { cat: logisticsCat, amount: 32000, days: 6, desc: 'Truck Yirgacheffe → Addis' },
      { cat: labCat, amount: 8700, days: 4, desc: 'Cupping samples & reagents' },
      { cat: millCat, amount: 21500, days: 2, desc: 'Hulling spare parts' },
    ];
    for (const e of expenseDefs) {
      const row = await expenseRepo.save(
        expenseRepo.create({
          categoryId: e.cat.id,
          bankAccountId: etbBank.id,
          amount: money(e.amount),
          description: e.desc,
          expenseDate: isoDate(daysAgo(e.days)),
          createdById: userId,
        }),
      );
      await expenseRepo.update(row.id, {
        createdAt: daysAgo(e.days),
      } as any);
    }
  }

  // Notifications for exec users
  if (userId) {
    const notes = [
      {
        type: NotificationType.LOW_STOCK,
        title: 'Jute bags approaching reorder',
        message: 'PKG-JUTE-60 at Main Warehouse nearing reorder point after staging prep.',
        module: 'inventory',
      },
      {
        type: NotificationType.FRESHNESS,
        title: 'Roast freshness window',
        message: 'LOT-EXEC-ROAST-01 showroom stock — prioritize local sales this week.',
        module: 'insights',
      },
      {
        type: NotificationType.SYSTEM,
        title: 'Export window — Nordic',
        message: 'EXP-DEMO-001 missing QC cert & commercial invoice before ship.',
        module: 'export',
      },
    ];
    for (const n of notes) {
      await notifRepo.save(
        notifRepo.create({
          userId,
          module: n.module,
          type: n.type,
          title: n.title,
          message: n.message,
          entityType: null,
          entityId: null,
          isRead: false,
        }),
      );
    }
  }

  logger.log(
    'Executive demo pack ready (lots, collections, process, transfers, sales, exports, finance)',
  );
}
