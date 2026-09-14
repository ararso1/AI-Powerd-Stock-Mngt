import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CoffeeForm,
  DocumentStatus,
  ItemType,
  LotEventType,
  LotQcPhase,
  LotStatus,
  PaymentMethod,
  ReceivingDisposition,
} from '../common/enums';
import { CollectionTicket } from './entities/collection-ticket.entity';
import { Item } from './entities/item.entity';
import { Location } from './entities/location.entity';
import { Lot } from './entities/lot.entity';
import { LotEvent } from './entities/lot-event.entity';
import { StockLevel } from './entities/stock-level.entity';
import { Supplier } from './entities/supplier.entity';
import { User } from './entities/user.entity';

const ACCEPT_LOT = 'LOT-DEMO-RECV-ACCEPT';
const REJECT_LOT = 'LOT-DEMO-RECV-REJECT';
const GRADED_LOT = 'LOT-DEMO-GRADED-01';

/**
 * Idempotent demo for receiving inspection + reject inventory + QC phases.
 */
export async function seedProcurementGradingDemo(
  dataSource: DataSource,
  logger: Logger,
): Promise<void> {
  const lotRepo = dataSource.getRepository(Lot);
  if (await lotRepo.findOne({ where: { code: REJECT_LOT } })) {
    logger.log('Procurement/grading demo already present — skip');
    return;
  }

  logger.log('Seeding procurement & grading demo…');

  const itemRepo = dataSource.getRepository(Item);
  const locRepo = dataSource.getRepository(Location);
  const stockRepo = dataSource.getRepository(StockLevel);
  const eventRepo = dataSource.getRepository(LotEvent);
  const supplierRepo = dataSource.getRepository(Supplier);
  const collectionRepo = dataSource.getRepository(CollectionTicket);
  const userRepo = dataSource.getRepository(User);

  const admin =
    (await userRepo.findOne({ where: { email: 'admin@csolve.local' } })) ??
    (await userRepo.findOne({ where: { email: 'admin@stock.local' } }));
  const userId = admin?.id ?? null;

  let rejectItem = await itemRepo.findOne({ where: { sku: 'COF-REJECT' } });
  if (!rejectItem) {
    rejectItem = await itemRepo.save(
      itemRepo.create({
        sku: 'COF-REJECT',
        description: 'Rejected coffee (held in inventory)',
        unit: 'kg',
        itemType: ItemType.RAW,
      }),
    );
  }

  let cherryItem = await itemRepo.findOne({ where: { sku: 'COF-CHERRY' } });
  if (!cherryItem) {
    cherryItem = await itemRepo.save(
      itemRepo.create({
        sku: 'COF-CHERRY',
        description: 'Coffee cherry',
        unit: 'kg',
        itemType: ItemType.RAW,
      }),
    );
  }

  const collectionLoc =
    (await locRepo.findOne({
      where: { name: 'Yirgacheffe Collection Center' },
    })) ?? (await locRepo.find({ take: 1 }))[0];
  if (!collectionLoc) {
    logger.warn('No location for procurement demo — skip');
    return;
  }

  const farmer =
    (await supplierRepo.findOne({ where: { name: 'Demo Farmer Cooperative' } })) ??
    (await supplierRepo.find({ take: 1 }))[0];
  if (!farmer) {
    logger.warn('No supplier for procurement demo — skip');
    return;
  }

  const acceptLot = await lotRepo.save(
    lotRepo.create({
      code: ACCEPT_LOT,
      itemId: cherryItem.id,
      locationId: collectionLoc.id,
      form: CoffeeForm.CHERRY,
      grade: 'Cherry A',
      cropYear: '2025/26',
      region: 'Sidama',
      zone: 'Bensa',
      woreda: 'Bensa',
      kebele: 'Shantawene',
      variety: 'Heirloom',
      processMethod: 'Washed',
      moisturePercent: '12.40',
      screenSize: '14/15',
      defectLevel: 'Low',
      cuppingScore: null,
      qcPhase: LotQcPhase.ACCEPTED,
      inspectorId: userId,
      inspectedAt: new Date(),
      quantity: '850.000',
      status: LotStatus.ACTIVE,
      notes: 'Demo partial receive — accepted portion',
      createdById: userId,
    }),
  );

  const rejectLot = await lotRepo.save(
    lotRepo.create({
      code: REJECT_LOT,
      itemId: rejectItem.id,
      locationId: collectionLoc.id,
      form: CoffeeForm.REJECT,
      grade: 'REJECT',
      cropYear: '2025/26',
      region: 'Sidama',
      zone: 'Bensa',
      woreda: 'Bensa',
      moisturePercent: '14.80',
      defectLevel: 'High',
      qcPhase: LotQcPhase.REJECTED,
      inspectorId: userId,
      inspectedAt: new Date(),
      rejectReason: 'Underripe / high defect at intake',
      rejectPercent: '15.00',
      rejectAction: 'Hold for local market / reprocess',
      quantity: '150.000',
      status: LotStatus.HOLD,
      notes: 'Rejected kg kept in inventory (not written off)',
      createdById: userId,
    }),
  );

  const gradedLot = await lotRepo.save(
    lotRepo.create({
      code: GRADED_LOT,
      itemId: cherryItem.id,
      locationId: collectionLoc.id,
      form: CoffeeForm.CHERRY,
      grade: 'Cherry B',
      cropYear: '2025/26',
      region: 'Guji',
      zone: 'Uraga',
      woreda: 'Uraga',
      processMethod: 'Natural',
      moisturePercent: '11.90',
      screenSize: '15',
      defectCount: 8,
      defectLevel: 'Medium',
      cuppingScore: '84.50',
      qcPhase: LotQcPhase.GRADED,
      inspectorId: userId,
      inspectedAt: new Date(),
      quantity: '500.000',
      status: LotStatus.ACTIVE,
      notes: 'Demo lot mid grading lifecycle',
      createdById: userId,
    }),
  );

  for (const entry of [
    { lot: acceptLot, qty: '850.000', itemId: cherryItem.id },
    { lot: rejectLot, qty: '150.000', itemId: rejectItem.id },
    { lot: gradedLot, qty: '500.000', itemId: cherryItem.id },
  ]) {
    await stockRepo.save(
      stockRepo.create({
        itemId: entry.itemId,
        locationId: collectionLoc.id,
        lotId: entry.lot.id,
        quantity: entry.qty,
      }),
    );
  }

  await eventRepo.save([
    eventRepo.create({
      lotId: acceptLot.id,
      eventType: LotEventType.CREATED,
      quantity: acceptLot.quantity,
      toLocationId: collectionLoc.id,
      createdById: userId,
      notes: 'Partial accept create',
    }),
    eventRepo.create({
      lotId: acceptLot.id,
      eventType: LotEventType.RECEIVING_ACCEPTED,
      quantity: acceptLot.quantity,
      createdById: userId,
      notes: '850 kg accepted at intake',
      metadata: { disposition: ReceivingDisposition.PARTIAL },
    }),
    eventRepo.create({
      lotId: rejectLot.id,
      eventType: LotEventType.CREATED,
      quantity: rejectLot.quantity,
      toLocationId: collectionLoc.id,
      createdById: userId,
      notes: 'Reject lot opened — stays in stock',
    }),
    eventRepo.create({
      lotId: rejectLot.id,
      eventType: LotEventType.RECEIVING_REJECTED,
      quantity: rejectLot.quantity,
      createdById: userId,
      notes: rejectLot.rejectReason ?? undefined,
      metadata: {
        rejectPercent: 15,
        rejectAction: rejectLot.rejectAction,
      },
    }),
    eventRepo.create({
      lotId: gradedLot.id,
      eventType: LotEventType.CREATED,
      quantity: gradedLot.quantity,
      toLocationId: collectionLoc.id,
      createdById: userId,
    }),
    eventRepo.create({
      lotId: gradedLot.id,
      eventType: LotEventType.SAMPLE_TESTED,
      quantity: gradedLot.quantity,
      createdById: userId,
      notes: 'Moisture + defects sampled',
    }),
    eventRepo.create({
      lotId: gradedLot.id,
      eventType: LotEventType.GRADED,
      quantity: gradedLot.quantity,
      createdById: userId,
      notes: 'Graded Cherry B · cup 84.5',
      metadata: { grade: 'Cherry B', cuppingScore: 84.5 },
    }),
  ]);

  await collectionRepo.save(
    collectionRepo.create({
      ticketNumber: 'COL-DEMO-PARTIAL-01',
      supplierId: farmer.id,
      locationId: collectionLoc.id,
      itemId: cherryItem.id,
      lotId: acceptLot.id,
      weightKg: '1000.000',
      disposition: ReceivingDisposition.PARTIAL,
      acceptedWeightKg: '850.000',
      rejectedWeightKg: '150.000',
      rejectLotId: rejectLot.id,
      grade: 'Cherry A',
      pricePerKg: '45.00',
      totalAmount: '38250.00',
      paymentMethod: PaymentMethod.CREDIT,
      moisturePercent: '12.40',
      cropYear: '2025/26',
      region: 'Sidama',
      zone: 'Bensa',
      woreda: 'Bensa',
      kebele: 'Shantawene',
      variety: 'Heirloom',
      processMethod: 'Washed',
      screenSize: '14/15',
      defectLevel: 'Low',
      inspectorId: userId,
      inspectedAt: new Date(),
      rejectReason: 'Underripe / high defect at intake',
      rejectPercent: '15.00',
      rejectAction: 'Hold for local market / reprocess',
      notes: 'Demo: accepted 850 kg paid/credited; 150 kg reject lot still in inventory',
      status: DocumentStatus.ACTIVE,
      createdById: userId,
    }),
  );

  logger.log(
    `Procurement/grading demo: ${ACCEPT_LOT}, ${REJECT_LOT}, ${GRADED_LOT}`,
  );
}
