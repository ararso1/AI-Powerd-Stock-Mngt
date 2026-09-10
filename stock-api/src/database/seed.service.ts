import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
} from './constants/permissions';
import { BankAccount } from './entities/bank-account.entity';
import { CherryPrice } from './entities/cherry-price.entity';
import { Item } from './entities/item.entity';
import { Location } from './entities/location.entity';
import { Lot } from './entities/lot.entity';
import { LotEvent } from './entities/lot-event.entity';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { StockLevel } from './entities/stock-level.entity';
import { ProcessTemplate } from './entities/process-template.entity';
import { RoastProfile } from './entities/roast-profile.entity';
import { ExportContract } from './entities/export-contract.entity';
import { Supplier } from './entities/supplier.entity';
import { User } from './entities/user.entity';
import {
  BankAccountType,
  CoffeeForm,
  ExportContractStatus,
  Incoterm,
  ItemType,
  LocationType,
  LotEventType,
  LotStatus,
} from '../common/enums';

const DEMO_PASSWORD = 'Demo@123';

const DEMO_USERS: Array<{
  email: string;
  fullName: string;
  roleName: string;
}> = [
  {
    email: 'admin@csolve.local',
    fullName: 'Csolve Admin',
    roleName: 'Admin',
  },
  {
    email: 'sales@csolve.local',
    fullName: 'Demo Sales Rep',
    roleName: 'Sales Representative',
  },
  {
    email: 'purchase@csolve.local',
    fullName: 'Demo Purchaser',
    roleName: 'Purchaser',
  },
  {
    email: 'stock@csolve.local',
    fullName: 'Demo Stock Keeper',
    roleName: 'Stock Keeper',
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(BankAccount)
    private readonly bankRepo: Repository<BankAccount>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    @InjectRepository(LotEvent)
    private readonly lotEventRepo: Repository<LotEvent>,
    @InjectRepository(CherryPrice)
    private readonly cherryPriceRepo: Repository<CherryPrice>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(ProcessTemplate)
    private readonly processTemplateRepo: Repository<ProcessTemplate>,
    @InjectRepository(RoastProfile)
    private readonly roastProfileRepo: Repository<RoastProfile>,
    @InjectRepository(ExportContract)
    private readonly exportContractRepo: Repository<ExportContract>,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
  ) {}

  async onModuleInit() {
    if (process.env.DB_SEED !== 'true') return;
    await this.seed();
  }

  async seed() {
    this.logger.log('Seeding database...');

    const permissions: Permission[] = [];
    for (const def of PERMISSION_DEFINITIONS) {
      let perm = await this.permissionRepo.findOne({
        where: { code: def.code },
      });
      if (!perm) {
        perm = this.permissionRepo.create(def);
        await this.permissionRepo.save(perm);
      }
      permissions.push(perm);
    }

    const permByCode = new Map(permissions.map((p) => [p.code, p]));

    for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      let role = await this.roleRepo.findOne({
        where: { name: roleName },
        relations: { permissions: true },
      });
      if (!role) {
        role = this.roleRepo.create({
          name: roleName,
          description: `System role: ${roleName}`,
          isSystem: true,
          permissions: codes.map((c) => permByCode.get(c)!).filter(Boolean),
        });
      } else {
        role.permissions = codes
          .map((c) => permByCode.get(c)!)
          .filter(Boolean);
      }
      await this.roleRepo.save(role);
    }

    const adminRole = await this.roleRepo.findOne({ where: { name: 'Admin' } });
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@stock.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';

    let admin = await this.userRepo.findOne({ where: { email: adminEmail } });
    if (!admin && adminRole) {
      admin = this.userRepo.create({
        email: adminEmail,
        fullName: 'System Administrator',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        roleId: adminRole.id,
        isActive: true,
      });
      await this.userRepo.save(admin);
      this.logger.log(`Admin user created: ${adminEmail}`);
    }

    await this.seedDemoUsers();
    await this.seedBanks();
    const locations = await this.seedCoffeeLocations();
    const greenItem = await this.seedCoffeeItems();
    await this.seedCherryPrices();
    await this.seedDemoFarmer();
    await this.seedProcessTemplates();
    await this.seedRoastProfiles();
    await this.seedSampleLots(locations, greenItem, admin?.id ?? null);
    await this.seedLotStockLinks();
    await this.seedDemoExportContract(locations, greenItem, admin?.id ?? null);

    this.logger.log('Seeding complete');
  }

  private async seedDemoUsers() {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    for (const demo of DEMO_USERS) {
      const role = await this.roleRepo.findOne({
        where: { name: demo.roleName },
      });
      if (!role) continue;

      let user = await this.userRepo.findOne({ where: { email: demo.email } });
      if (!user) {
        user = this.userRepo.create({
          email: demo.email,
          fullName: demo.fullName,
          passwordHash,
          roleId: role.id,
          isActive: true,
        });
        await this.userRepo.save(user);
        this.logger.log(`Demo user created: ${demo.email} / ${DEMO_PASSWORD}`);
      } else if (user.roleId !== role.id) {
        user.roleId = role.id;
        user.fullName = demo.fullName;
        await this.userRepo.save(user);
      }
    }
  }

  private async seedBanks() {
    const bankCount = await this.bankRepo.count();
    if (bankCount === 0) {
      await this.bankRepo.save([
        this.bankRepo.create({
          name: 'Main Bank',
          accountType: BankAccountType.BANK,
          bankName: 'Main Bank Account',
          accountHolderName: 'Main Account',
          accountNumber: 'MAIN-001',
          balance: '0',
          currencyCode: 'ETB',
        }),
        this.bankRepo.create({
          name: 'Cash',
          accountType: BankAccountType.CASH,
          bankName: null,
          accountHolderName: 'Main Account',
          accountNumber: 'CASH-001',
          balance: '0',
          currencyCode: 'ETB',
        }),
      ]);
      this.logger.log('Default bank accounts created (Main Bank, Cash)');
    }

    const usd = await this.bankRepo.findOne({
      where: { accountNumber: 'USD-001' },
    });
    if (!usd) {
      await this.bankRepo.save(
        this.bankRepo.create({
          name: 'Export USD',
          accountType: BankAccountType.BANK,
          bankName: 'Correspondent USD',
          accountHolderName: 'Csolve Export',
          accountNumber: 'USD-001',
          balance: '0',
          currencyCode: 'USD',
        }),
      );
      this.logger.log('USD export bank account created');
    }
  }

  private async seedCoffeeLocations(): Promise<Record<string, Location>> {
    const defs: Array<{
      key: string;
      name: string;
      type: LocationType;
      address: string;
    }> = [
      {
        key: 'warehouse',
        name: 'Main Warehouse',
        type: LocationType.WAREHOUSE,
        address: 'Addis Ababa green coffee warehouse',
      },
      {
        key: 'collection',
        name: 'Yirgacheffe Collection Center',
        type: LocationType.COLLECTION_CENTER,
        address: 'Yirgacheffe, Gedeo',
      },
      {
        key: 'wetMill',
        name: 'Yirgacheffe Wet Mill',
        type: LocationType.WET_MILL,
        address: 'Yirgacheffe washing station',
      },
      {
        key: 'roastery',
        name: 'Csolve Roastery',
        type: LocationType.ROASTERY,
        address: 'Addis Ababa roast facility',
      },
      {
        key: 'showroom',
        name: 'Local Showroom',
        type: LocationType.SHOWROOM,
        address: 'Retail / wholesale counter',
      },
      {
        key: 'export',
        name: 'Export Staging',
        type: LocationType.EXPORT_STAGING,
        address: 'Container prep / CFS',
      },
    ];

    const map: Record<string, Location> = {};
    for (const def of defs) {
      let loc = await this.locationRepo.findOne({ where: { name: def.name } });
      if (!loc) {
        try {
          loc = await this.locationRepo.save(
            this.locationRepo.create({
              name: def.name,
              type: def.type,
              address: def.address,
            }),
          );
          this.logger.log(`Location created: ${def.name}`);
        } catch (err) {
          // Enum may not include new types until migration runs — fall back warehouse
          this.logger.warn(
            `Could not create ${def.name} with type ${def.type}; using WAREHOUSE`,
          );
          loc = await this.locationRepo.save(
            this.locationRepo.create({
              name: def.name,
              type: LocationType.WAREHOUSE,
              address: def.address,
            }),
          );
        }
      }
      map[def.key] = loc;
    }
    return map;
  }

  private async seedCoffeeItems(): Promise<Item> {
    let green = await this.itemRepo.findOne({
      where: { sku: 'COF-GREEN-G1' },
    });
    if (!green) {
      green = await this.itemRepo.save(
        this.itemRepo.create({
          sku: 'COF-GREEN-G1',
          description: 'Green coffee Grade 1',
          unit: 'kg',
          itemType: ItemType.RAW,
        }),
      );
    }

    const cherry = await this.itemRepo.findOne({
      where: { sku: 'COF-CHERRY' },
    });
    if (!cherry) {
      await this.itemRepo.save(
        this.itemRepo.create({
          sku: 'COF-CHERRY',
          description: 'Coffee cherry',
          unit: 'kg',
          itemType: ItemType.RAW,
        }),
      );
    }

    const parchment = await this.itemRepo.findOne({
      where: { sku: 'COF-PARCHMENT' },
    });
    if (!parchment) {
      await this.itemRepo.save(
        this.itemRepo.create({
          sku: 'COF-PARCHMENT',
          description: 'Coffee parchment',
          unit: 'kg',
          itemType: ItemType.SEMI,
        }),
      );
    }

    const roasted = await this.itemRepo.findOne({
      where: { sku: 'COF-ROAST-250' },
    });
    if (!roasted) {
      await this.itemRepo.save(
        this.itemRepo.create({
          sku: 'COF-ROAST-250',
          description: 'Roasted coffee 250g',
          unit: 'pcs',
          itemType: ItemType.FINISHED,
        }),
      );
    }

    return green;
  }

  private async seedProcessTemplates() {
    const cherry = await this.itemRepo.findOne({ where: { sku: 'COF-CHERRY' } });
    const parchment = await this.itemRepo.findOne({
      where: { sku: 'COF-PARCHMENT' },
    });
    const green = await this.itemRepo.findOne({
      where: { sku: 'COF-GREEN-G1' },
    });
    const roast = await this.itemRepo.findOne({
      where: { sku: 'COF-ROAST-250' },
    });

    const templates = [
      {
        code: 'WASHED-WET',
        name: 'Washed wet mill',
        inputForm: CoffeeForm.CHERRY,
        outputForm: CoffeeForm.PARCHMENT,
        expectedYieldPercent: '45.00',
        requiresQc: true,
        stages: ['Pulping', 'Fermentation', 'Washing', 'Drying'],
        maxMoisturePercent: '12.00',
        inputItemId: cherry?.id ?? null,
        outputItemId: parchment?.id ?? null,
      },
      {
        code: 'DRY-MILL',
        name: 'Dry mill hulling',
        inputForm: CoffeeForm.PARCHMENT,
        outputForm: CoffeeForm.GREEN,
        expectedYieldPercent: '80.00',
        requiresQc: true,
        stages: ['Hulling', 'Grading', 'Hand-pick'],
        maxMoisturePercent: '12.00',
        inputItemId: parchment?.id ?? null,
        outputItemId: green?.id ?? null,
      },
      {
        code: 'NATURAL-DRY',
        name: 'Natural process',
        inputForm: CoffeeForm.CHERRY,
        outputForm: CoffeeForm.GREEN,
        expectedYieldPercent: '18.00',
        requiresQc: true,
        stages: ['Drying', 'Hulling', 'Grading'],
        maxMoisturePercent: '11.50',
        inputItemId: cherry?.id ?? null,
        outputItemId: green?.id ?? null,
      },
      {
        code: 'ROAST-BATCH',
        name: 'Roast batch',
        inputForm: CoffeeForm.GREEN,
        outputForm: CoffeeForm.ROASTED,
        expectedYieldPercent: '85.00',
        requiresQc: true,
        stages: ['Charge', 'Development', 'Drop', 'Cool'],
        maxMoisturePercent: null,
        inputItemId: green?.id ?? null,
        outputItemId: roast?.id ?? null,
      },
      {
        code: 'PACK-250',
        name: 'Package 250g',
        inputForm: CoffeeForm.ROASTED,
        outputForm: CoffeeForm.PACKAGED,
        expectedYieldPercent: '100.00',
        requiresQc: false,
        stages: ['Weigh', 'Seal', 'Label'],
        maxMoisturePercent: null,
        inputItemId: roast?.id ?? null,
        outputItemId: roast?.id ?? null,
      },
    ];

    for (const t of templates) {
      const existing = await this.processTemplateRepo.findOne({
        where: { code: t.code },
      });
      if (!existing) {
        await this.processTemplateRepo.save(
          this.processTemplateRepo.create({
            ...t,
            isActive: true,
            notes: 'Seeded Csolve process template',
          }),
        );
      }
    }
    this.logger.log(
      'Process templates seeded (wet/dry/natural/roast/pack)',
    );
  }

  private async seedRoastProfiles() {
    const profiles = [
      {
        code: 'MED-CITY',
        name: 'Medium City',
        roastLevel: 'Medium',
        targetAgtron: 58,
        durationMinutes: 11,
        shelfLifeDays: 90,
        blendNotes: 'Single origin or 70/30 Yirgacheffe/Sidamo',
      },
      {
        code: 'LIGHT-FILTER',
        name: 'Light filter',
        roastLevel: 'Light',
        targetAgtron: 65,
        durationMinutes: 9,
        shelfLifeDays: 60,
        blendNotes: '100% washed G1',
      },
    ];
    for (const p of profiles) {
      const existing = await this.roastProfileRepo.findOne({
        where: { code: p.code },
      });
      if (!existing) {
        await this.roastProfileRepo.save(this.roastProfileRepo.create(p));
      }
    }
    this.logger.log('Roast profiles seeded');
  }

  private async seedDemoExportContract(
    locations: Record<string, Location>,
    greenItem: Item,
    userId: string | null,
  ) {
    const existing = await this.exportContractRepo.findOne({
      where: { contractNumber: 'EXP-DEMO-001' },
    });
    if (existing) return;

    const staging = locations.export ?? locations.warehouse;
    const usdBank = await this.bankRepo.findOne({
      where: { accountNumber: 'USD-001' },
    });

    await this.exportContractRepo.save(
      this.exportContractRepo.create({
        contractNumber: 'EXP-DEMO-001',
        buyerName: 'Nordic Specialty Roasters',
        volumeKg: '19200.000',
        grade: 'G1',
        pricePerKg: '4.8500',
        currencyCode: 'USD',
        incoterm: Incoterm.FOB,
        windowStart: '2026-10-01',
        windowEnd: '2026-11-15',
        status: ExportContractStatus.DRAFT,
        allocatedKg: '0.000',
        shippedKg: '0.000',
        stagingLocationId: staging?.id ?? null,
        bankAccountId: usdBank?.id ?? null,
        packingList: [],
        docChecklist: [
          { key: 'COO', label: 'Certificate of Origin', done: false },
          { key: 'PHYTO', label: 'Phytosanitary certificate', done: false },
          { key: 'QC', label: 'QC / cupping certificate', done: false },
          { key: 'PACKING', label: 'Packing list', done: false },
          { key: 'INVOICE', label: 'Commercial invoice', done: false },
        ],
        notes: `Demo contract — allocate ${greenItem.sku} lots then stage/ship`,
        createdById: userId,
      }),
    );
    this.logger.log('Demo export contract EXP-DEMO-001 created');
  }

  private async seedSampleLots(
    locations: Record<string, Location>,
    greenItem: Item,
    userId: string | null,
  ) {
    const warehouse = locations.warehouse;
    const collectionLoc = locations.collection;
    if (!warehouse) return;

    const existing = await this.lotRepo.count();
    if (existing === 0) {
      const lotA = await this.lotRepo.save(
        this.lotRepo.create({
          code: 'LOT-2026-0001',
          itemId: greenItem.id,
          locationId: warehouse.id,
          form: CoffeeForm.GREEN,
          grade: 'G1',
          cropYear: '2025/26',
          variety: 'Heirloom',
          processMethod: 'Washed',
          region: 'Yirgacheffe',
          woreda: 'Yirgacheffe',
          kebele: 'Aricha',
          moisturePercent: '11.20',
          quantity: '1200.000',
          status: LotStatus.ACTIVE,
          notes: 'Demo washed G1 lot',
          createdById: userId,
        }),
      );

      await this.lotEventRepo.save([
        this.lotEventRepo.create({
          lotId: lotA.id,
          eventType: LotEventType.CREATED,
          quantity: '1200.000',
          toLocationId: collectionLoc?.id ?? warehouse.id,
          notes: 'Lot opened after milling',
          createdById: userId,
          metadata: { demo: true },
        }),
        this.lotEventRepo.create({
          lotId: lotA.id,
          eventType: LotEventType.COLLECTED,
          quantity: '3500.000',
          toLocationId: collectionLoc?.id ?? warehouse.id,
          notes: 'Cherry intake (demo)',
          createdById: userId,
        }),
        this.lotEventRepo.create({
          lotId: lotA.id,
          eventType: LotEventType.PROCESS_COMPLETED,
          quantity: '1200.000',
          fromLocationId: collectionLoc?.id ?? null,
          toLocationId: warehouse.id,
          notes: 'Washed & dried → green',
          createdById: userId,
        }),
        this.lotEventRepo.create({
          lotId: lotA.id,
          eventType: LotEventType.QC_RELEASED,
          quantity: '1200.000',
          notes: 'Moisture 11.2% — released',
          createdById: userId,
          metadata: { moisturePercent: 11.2 },
        }),
      ]);

      const lotB = await this.lotRepo.save(
        this.lotRepo.create({
          code: 'LOT-2026-0002',
          itemId: greenItem.id,
          locationId: warehouse.id,
          form: CoffeeForm.GREEN,
          grade: 'G2',
          cropYear: '2025/26',
          variety: 'Heirloom',
          processMethod: 'Natural',
          region: 'Sidama',
          woreda: 'Bensa',
          moisturePercent: '10.80',
          quantity: '800.000',
          status: LotStatus.ACTIVE,
          notes: 'Demo natural G2 lot',
          createdById: userId,
        }),
      );

      await this.lotEventRepo.save(
        this.lotEventRepo.create({
          lotId: lotB.id,
          eventType: LotEventType.CREATED,
          quantity: '800.000',
          toLocationId: warehouse.id,
          notes: 'Demo lot created',
          createdById: userId,
        }),
      );

      this.logger.log(
        'Sample coffee lots created (LOT-2026-0001, LOT-2026-0002)',
      );
    }

    const cherryItem = await this.itemRepo.findOne({
      where: { sku: 'COF-CHERRY' },
    });
    const cherryLocation = collectionLoc ?? warehouse;
    if (cherryItem) {
      const existingCherry = await this.lotRepo.findOne({
        where: { code: 'LOT-CHERRY-DEMO' },
      });
      if (!existingCherry) {
        const cherryLot = await this.lotRepo.save(
          this.lotRepo.create({
            code: 'LOT-CHERRY-DEMO',
            itemId: cherryItem.id,
            locationId: cherryLocation.id,
            form: CoffeeForm.CHERRY,
            grade: 'Cherry A',
            cropYear: '2025/26',
            variety: 'Heirloom',
            region: 'Yirgacheffe',
            quantity: '2000.000',
            status: LotStatus.ACTIVE,
            notes: 'Demo cherry lot for processing',
            createdById: userId,
          }),
        );
        await this.lotEventRepo.save(
          this.lotEventRepo.create({
            lotId: cherryLot.id,
            eventType: LotEventType.CREATED,
            quantity: '2000.000',
            toLocationId: cherryLocation.id,
            notes: 'Demo cherry lot',
            createdById: userId,
          }),
        );
        const stock = await this.stockRepo.findOne({
          where: {
            locationId: cherryLocation.id,
            itemId: cherryItem.id,
            lotId: cherryLot.id,
          },
        });
        if (!stock) {
          await this.stockRepo.save(
            this.stockRepo.create({
              locationId: cherryLocation.id,
              itemId: cherryItem.id,
              lotId: cherryLot.id,
              quantity: '2000.000',
              purchasePrice: '45.00',
            }),
          );
        }
        this.logger.log('Demo cherry lot created (LOT-CHERRY-DEMO)');
      }
    }
  }

  /** Ensure active coffee lots have matching lot-linked stock rows. */
  private async seedLotStockLinks() {
    const lots = await this.lotRepo.find({
      where: { status: LotStatus.ACTIVE },
    });
    let created = 0;
    for (const lot of lots) {
      if (!lot.locationId || !lot.itemId) continue;
      const qty = parseFloat(lot.quantity);
      if (!(qty > 0)) continue;
      const existing = await this.stockRepo.findOne({
        where: { lotId: lot.id },
      });
      if (existing) continue;

      // Prefer cost from legacy null-lot row for same location+item
      const legacy = await this.stockRepo.findOne({
        where: {
          locationId: lot.locationId,
          itemId: lot.itemId,
          lotId: IsNull(),
        },
      });

      await this.stockRepo.save(
        this.stockRepo.create({
          locationId: lot.locationId,
          itemId: lot.itemId,
          lotId: lot.id,
          quantity: lot.quantity,
          purchasePrice: legacy?.purchasePrice ?? '0.00',
        }),
      );
      created += 1;
    }
    if (created > 0) {
      this.logger.log(`Lot stock links seeded (${created} rows)`);
    }
  }

  private async seedCherryPrices() {
    const defaults = [
      { grade: 'Cherry A', cropYear: '2025/26', pricePerKg: '45.00' },
      { grade: 'Cherry B', cropYear: '2025/26', pricePerKg: '38.00' },
      { grade: 'Cherry C', cropYear: '2025/26', pricePerKg: '30.00' },
    ];
    for (const row of defaults) {
      const existing = await this.cherryPriceRepo.findOne({
        where: { grade: row.grade, cropYear: row.cropYear },
      });
      if (!existing) {
        await this.cherryPriceRepo.save(this.cherryPriceRepo.create(row));
      }
    }
    this.logger.log('Cherry price table seeded (2025/26)');
  }

  private async seedDemoFarmer() {
    const name = 'Demo Farmer Cooperative';
    let farmer = await this.supplierRepo.findOne({ where: { name } });
    if (!farmer) {
      farmer = await this.supplierRepo.save(
        this.supplierRepo.create({
          name,
          phone: '0911000000',
          email: 'farmer@csolve.local',
          address: 'Yirgacheffe',
        }),
      );
      this.logger.log(`Demo farmer/supplier created: ${name}`);
    }
  }
}
