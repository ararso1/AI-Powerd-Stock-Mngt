import type { Currency } from "@/lib/currency";

export type LocationType =
  | "WAREHOUSE"
  | "SHOWROOM"
  | "COLLECTION_CENTER"
  | "WET_MILL"
  | "DRY_MILL"
  | "ROASTERY"
  | "EXPORT_STAGING";
export type PaymentMethod = "CASH" | "BANK" | "CREDIT";
export type BankAccountType = "CASH" | "BANK";
export type BankTransactionType =
  | "SALE"
  | "PURCHASE"
  | "ADJUSTMENT"
  | "CREDIT_PAYMENT"
  | "EXPENSE";
export type BankTransactionDirection = "in" | "out";
export type StockAdjustmentDirection = "in" | "out";
export type StockAdjustmentReason =
  | "DAMAGE"
  | "LOSS"
  | "FOUND"
  | "COUNT"
  | "OPENING"
  | "RETURN"
  | "OTHER"
  | "MOISTURE_LOSS"
  | "SHRINKAGE"
  | "QC_REJECT";
export type ItemType = "RAW" | "SEMI" | "FINISHED" | "OTHER";
export type ProductionOrderStatus =
  | "DRAFT"
  | "RELEASED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type TransferStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type CreditStatus = "OPEN" | "PARTIAL" | "PAID";
export type DocumentStatus = "ACTIVE" | "VOIDED" | "POSTED";
export type CommissionBasis = "PROFIT" | "SALES";

export type { Currency };

export interface HealthResponse {
  status: string;
  service: string;
  currency?: Currency;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T, Totals = undefined> {
  data: T[];
  meta: PaginatedMeta;
  totals?: Totals;
}

export interface InventoryListTotals {
  quantity: string;
  inventoryValue: string;
}

export interface PurchaseListTotals {
  subtotal: string;
  total: string;
}

export interface SaleListTotals {
  subtotal: string;
  total: string;
  commission: string;
}

export interface ExpenseListTotals {
  amount: string;
}

export interface CreditListTotals {
  amount: string;
  paidAmount: string;
  balance: string;
}

export interface LinkedCredit {
  paidAmount?: string;
  status?: CreditStatus;
}

export interface Role {
  id: string;
  name: string;
  /** Auth/login: codes only. `GET /roles` may return full `Permission` objects. */
  permissions?: string[] | Permission[];
  description?: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address?: string;
  isActive?: boolean;
}

export interface Item {
  id: string;
  sku?: string | null;
  description: string;
  unit?: string | null;
  itemType?: ItemType | null;
}

export interface StockRecord {
  id: string;
  locationId: string;
  itemId: string;
  lotId?: string | null;
  quantity: string;
  purchasePrice: string;
  reorderPoint?: string | null;
  item: Item;
  location: Location;
  lot?: Lot | null;
}

export type LowStockStatus = "LOW_STOCK" | "OUT_OF_STOCK";

export interface LowStockRecord extends StockRecord {
  status: LowStockStatus;
  shortage: string;
}

export interface StockAdjustment {
  id: string;
  locationId: string;
  itemId: string;
  lotId?: string | null;
  direction: StockAdjustmentDirection;
  quantity: string;
  quantityBefore: string;
  quantityAfter: string;
  reason: StockAdjustmentReason | string;
  notes?: string | null;
  reference?: string | null;
  purchasePrice?: string | null;
  createdById?: string;
  createdBy?: { id: string; fullName?: string; email?: string };
  item?: Item;
  location?: Location;
  lot?: Lot | null;
  createdAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: string;
  accountType?: BankAccountType;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  currencyCode?: string;
  isActive?: boolean;
}

export interface BankLiquidity {
  accounts: BankAccount[];
  totals: {
    cashTotal: string;
    bankTotal: string;
    totalLiquidity: string;
  };
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  type: BankTransactionType | string;
  /** Money into (`in`) or out of (`out`) the account. Amount is always positive. */
  direction: BankTransactionDirection;
  amount: string;
  balanceAfter?: string;
  description?: string;
  refType?: string;
  refId?: string;
  createdById?: string;
  bankAccount?: BankAccount;
  createdAt?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  bankAccountId: string;
  amount: string;
  description?: string;
  expenseDate: string;
  category?: ExpenseCategory;
}

export interface CreditRecord {
  id: string;
  customerId?: string;
  supplierId?: string;
  saleId?: string;
  purchaseId?: string;
  amount: string;
  paidAmount: string;
  balance?: string;
  status: CreditStatus;
  dueDate?: string;
  customer?: Customer;
  supplier?: Supplier;
  sale?: Pick<
    Sale,
    "id" | "total" | "subtotal" | "totalAmount" | "createdAt" | "paymentMethod" | "status"
  >;
  purchase?: Pick<
    Purchase,
    "id" | "total" | "subtotal" | "totalAmount" | "createdAt" | "paymentMethod" | "status"
  >;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardData {
  totalInventoryValue: string;
  stockValueByLocation: {
    locationId: string;
    locationName: string;
    value: string;
  }[];
  showroomCount: number;
  dailySales: string;
  dailyPurchases: string;
  profitAndLoss: {
    revenue: string;
    costOfGoodsSold: string;
    grossProfit: string;
    totalExpenses: string;
    netProfit: string;
  };
  financialOverview: {
    cashTotal?: string;
    bankTotal?: string;
    totalLiquidity?: string;
    totalBankBalance: string;
    bankAccounts: {
      id: string;
      name: string;
      balance: string;
      accountType?: BankAccountType;
      bankName?: string | null;
      currencyCode?: string;
    }[];
  };
  currency?: Currency;
  asOf?: string;
  period?: { from?: string | null; to?: string | null };
  pulse?: {
    intakeKgToday: string;
    processWipKg: string;
    processWipRuns: number;
    greenStockKg: string;
    roastOutputKgToday: string;
    localSalesToday: string;
    exportStagedKg: string;
    openAlerts: number;
  };
  traceability?: {
    lotLinkedStockPercent: number;
    lotLinkedStockKg: string;
    unlinkedStockKg: string;
    qcHoldLots: number;
    qcHoldKg: string;
    shrinkageSignals: Array<{
      processRunId: string;
      runNumber: string;
      expectedYieldPercent: string;
      actualYieldPercent: string;
      variancePercent: number;
    }>;
  };
  commercial?: {
    localRevenue: string;
    exportRevenue: string;
    customerCreditOutstanding: string;
    supplierCreditOutstanding: string;
    totalLiquidity: string;
  };
  contracts?: {
    openContracts: number;
    openVolumeKg: string;
    allocatedKg: string;
    coveragePercent: number;
    shipWindowRisk: Array<{
      contractId: string;
      contractNumber: string;
      windowEnd: string | null;
      daysRemaining: number | null;
      unallocatedKg: string;
      status?: string;
    }>;
    missingDocs: Array<{
      contractId: string;
      contractNumber: string;
      missing: string[];
    }>;
  };
  recommendations?: Array<{
    id: string;
    severity: "info" | "warn" | "critical";
    code: string;
    title: string;
    detail: string;
    href: string;
  }>;
  links?: {
    collectionsToday?: string;
    processWip?: string;
    greenLots?: string;
    qcHoldLots?: string;
    localSales?: string;
    exportStaged?: string;
    openContracts?: string;
    unlinkedInventory?: string;
    notifications?: string;
    reports?: string;
    profitLoss?: string;
  };
}

export interface ProfitLossItem {
  itemId: string;
  description: string;
  quantitySold: string;
  revenue: string;
  cost: string;
  profit: string;
  marginPercent: string;
}

export interface Permission {
  id: string;
  code: string;
  description?: string;
}

export interface PurchaseLine {
  id?: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  lineTotal?: string;
  amount?: string;
  item?: Item;
}

export interface Purchase {
  id: string;
  supplierId?: string;
  locationId?: string;
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  notes?: string;
  creditDueDate?: string;
  status?: DocumentStatus;
  subtotal?: string;
  total?: string;
  /** @deprecated Prefer `total` */
  totalAmount?: string;
  createdAt?: string;
  updatedAt?: string;
  supplier?: Supplier;
  location?: Location;
  bankAccount?: BankAccount;
  supplierCredit?: LinkedCredit;
  lines?: PurchaseLine[];
}

export interface SaleLine {
  id?: string;
  itemId: string;
  lotId?: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal?: string;
  amount?: string;
  item?: Item;
  lot?: Lot | null;
}

export interface SaleUserRef {
  id: string;
  fullName: string;
  email?: string;
}

export type SaleChannel = "LOCAL" | "EXPORT";

export interface Sale {
  id: string;
  customerId?: string;
  locationId?: string;
  channel?: SaleChannel;
  currencyCode?: string;
  fxRate?: string | null;
  exportContractId?: string | null;
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  notes?: string;
  creditDueDate?: string;
  status?: DocumentStatus;
  subtotal?: string;
  total?: string;
  /** @deprecated Prefer `total` */
  totalAmount?: string;
  soldByUserId?: string;
  commissionPercent?: string | number;
  commissionBasis?: CommissionBasis;
  commissionAmount?: string;
  soldByUser?: SaleUserRef;
  /** @deprecated Prefer `soldByUser` */
  soldBy?: SaleUserRef;
  createdBy?: SaleUserRef;
  createdAt?: string;
  updatedAt?: string;
  customer?: Customer;
  location?: Location;
  bankAccount?: BankAccount;
  customerCredit?: LinkedCredit;
  lines?: SaleLine[];
}

export interface SalesCommissionSummaryRow {
  soldByUserId: string;
  soldByUserName?: string;
  soldByUser?: SaleUserRef;
  /** @deprecated Prefer `soldByUserName` / `totalSubtotal` */
  soldBy?: SaleUserRef;
  saleCount: number;
  totalSubtotal?: string;
  /** @deprecated Prefer `totalSubtotal` */
  totalSales?: string;
  totalCommission: string;
}

export interface ReportPeriod {
  from?: string;
  to?: string;
}

export interface ReportsSummary {
  currency?: Currency;
  totalRevenue: string;
  totalPurchases?: string;
  /** @deprecated Use totalPurchases */
  totalCost?: string;
  totalExpenses: string;
  grossProfit: string;
  netProfit: string;
  marginPercent: string;
  period?: ReportPeriod;
}

export interface ReportPaymentMethodRow {
  paymentMethod: PaymentMethod;
  count: number;
  total: string;
}

export interface ReportLocationBreakdownRow {
  locationId: string;
  locationName: string;
  count: number;
  total: string;
}

export interface ReportSales {
  currency?: Currency;
  period?: ReportPeriod;
  totals: {
    count: number;
    subtotal: string;
    total: string;
    commission: string;
  };
  byPaymentMethod: ReportPaymentMethodRow[];
  byLocation: ReportLocationBreakdownRow[];
}

export interface ReportPurchases {
  currency?: Currency;
  period?: ReportPeriod;
  totals: { count: number; total: string };
  byPaymentMethod: ReportPaymentMethodRow[];
  byLocation: ReportLocationBreakdownRow[];
}

export interface ReportExpenseCategoryRow {
  categoryId: string;
  categoryName: string;
  count: number;
  total: string;
}

export interface ReportExpenses {
  currency?: Currency;
  period?: ReportPeriod;
  totals: { count: number; total: string };
  byCategory: ReportExpenseCategoryRow[];
}

export interface ReportPurchasesByItemRow {
  itemId: string;
  sku?: string;
  description: string;
  quantityPurchased: string;
  total?: string;
  /** @deprecated Prefer `total` */
  totalSpend?: string;
}

export interface ReportPurchasesByItem {
  currency?: Currency;
  period?: { from?: string | null; to?: string | null };
  items: ReportPurchasesByItemRow[];
}

export interface ReportCommissionRow {
  soldByUserId: string;
  soldByUserName: string;
  saleCount: number;
  totalSubtotal?: string;
  totalCommission: string;
}

export interface ReportCommissions {
  currency?: Currency;
  period?: { from?: string | null; to?: string | null };
  totalCommission: string;
  reps: ReportCommissionRow[];
}

export interface ReportCreditByCustomerRow {
  customerId: string;
  customerName: string;
  creditCount: number;
  outstanding: string;
}

export interface ReportCreditBySupplierRow {
  supplierId: string;
  supplierName: string;
  creditCount: number;
  outstanding: string;
}

export interface ReportCreditPartySummary {
  totalOutstanding: string;
  creditCount: number;
  byCustomer?: ReportCreditByCustomerRow[];
  bySupplier?: ReportCreditBySupplierRow[];
}

export interface ReportCredits {
  currency?: Currency;
  customers?: ReportCreditPartySummary;
  suppliers?: ReportCreditPartySummary;
  /** @deprecated Prefer `customers` */
  customerReceivables?: {
    count: number;
    total: string;
    outstanding: string;
  };
  /** @deprecated Prefer `suppliers` */
  supplierPayables?: {
    count: number;
    total: string;
    outstanding: string;
  };
}

export interface ReportSalesByItemRow {
  itemId: string;
  sku?: string;
  description: string;
  itemDescription?: string;
  quantitySold: string;
  revenue: string;
  cost: string;
  profit: string;
  marginPercent: string;
}

export interface ReportSalesByItem {
  currency?: Currency;
  period?: { from?: string | null; to?: string | null };
  items: ReportSalesByItemRow[];
}

export interface ReportInventoryAgingRow {
  itemId: string;
  locationId?: string;
  sku?: string;
  description?: string;
  itemDescription?: string;
  locationName?: string;
  quantity: string;
  purchasePrice?: string;
  inventoryValue?: string;
  value?: string;
  lastPurchaseDate?: string;
  lastUpdated?: string;
  ageDays?: number | string;
  lotId?: string;
  lotCode?: string;
  form?: string;
  grade?: string;
  cropYear?: string;
}

export interface ReportInventoryAging {
  currency?: Currency;
  totalInventoryValue: string;
  items: ReportInventoryAgingRow[];
}

export interface ReportCustomerActivityRow {
  customerId: string;
  customerName?: string;
  name?: string;
  phone?: string;
  saleCount?: number;
  salesCount?: number;
  totalSpend?: string;
  totalSpent?: string;
  paidAmount?: string;
  creditAmount?: string;
  outstandingAmount?: string;
}

export interface ReportCustomerActivity {
  currency?: Currency;
  period?: { from?: string | null; to?: string | null };
  customers: ReportCustomerActivityRow[];
}

export interface ReportSupplierActivityRow {
  supplierId: string;
  supplierName?: string;
  name?: string;
  phone?: string;
  purchaseCount: number;
  totalPurchased: string;
  paidAmount?: string;
  creditAmount?: string;
  outstandingAmount?: string;
}

export interface ReportSupplierActivity {
  currency?: Currency;
  period?: { from?: string | null; to?: string | null };
  suppliers: ReportSupplierActivityRow[];
}

export interface ReportCashFlowRow {
  date: string;
  cashIn?: string;
  cashOut?: string;
  netMovement?: string;
  inflow?: string;
  outflow?: string;
  net?: string;
}

export interface ReportCashFlow {
  period?: ReportPeriod;
  dailyBalances: ReportCashFlowRow[];
}

export interface StockTransferLine {
  id?: string;
  itemId: string;
  lotId?: string | null;
  quantity: string;
  item?: Item;
  lot?: Lot | null;
}

export interface StockTransfer {
  id: string;
  status: TransferStatus;
  fromLocationId?: string;
  toLocationId?: string;
  notes?: string;
  createdAt?: string;
  fromLocation?: Location;
  toLocation?: Location;
  lines?: StockTransferLine[];
}

export interface BomLine {
  id?: string;
  componentItemId: string;
  quantity: string | number;
  scrapPercent?: string | number | null;
  componentItem?: Item;
}

export interface Bom {
  id: string;
  finishedItemId: string;
  name: string;
  version?: string | null;
  notes?: string | null;
  isActive?: boolean;
  finishedItem?: Item;
  lines?: BomLine[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionOrderLine {
  id?: string;
  componentItemId: string;
  quantityRequired?: string;
  quantityIssued?: string;
  scrapPercent?: string | null;
  componentItem?: Item;
}

export interface ProductionOrder {
  id: string;
  bomId: string;
  locationId: string;
  finishedItemId?: string;
  quantityPlanned: string;
  quantityCompleted?: string;
  status: ProductionOrderStatus;
  notes?: string | null;
  bom?: Bom;
  location?: Location;
  finishedItem?: Item;
  lines?: ProductionOrderLine[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserAdmin {
  id: string;
  email: string;
  fullName: string;
  roleId?: string;
  role?: Role;
  isActive?: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export type NotificationType =
  | "LOW_STOCK"
  | "STOCK_TRANSFER"
  | "SALE"
  | "PURCHASE"
  | "CREDIT_DUE"
  | "EXPENSE"
  | "SYSTEM";

export interface Notification {
  id: string;
  userId: string;
  module: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationUnreadCount {
  count: number;
}

export type CoffeeForm =
  | "CHERRY"
  | "PARCHMENT"
  | "GREEN"
  | "ROASTED"
  | "PACKAGED"
  | "REJECT";

export type LotStatus = "ACTIVE" | "HOLD" | "VOIDED";

export type LotEventType =
  | "CREATED"
  | "COLLECTED"
  | "TRANSFERRED"
  | "PROCESS_STARTED"
  | "PROCESS_COMPLETED"
  | "QC_HELD"
  | "QC_RELEASED"
  | "ADJUSTED"
  | "SPLIT"
  | "MERGED"
  | "ROASTED"
  | "PACKAGED"
  | "SOLD_LOCAL"
  | "ALLOCATED_EXPORT"
  | "SHIPPED"
  | "VOIDED";

export interface Lot {
  id: string;
  code: string;
  itemId?: string | null;
  locationId?: string | null;
  form: CoffeeForm;
  grade?: string | null;
  cropYear?: string | null;
  variety?: string | null;
  processMethod?: string | null;
  region?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  moisturePercent?: string | null;
  roastDate?: string | null;
  bestBefore?: string | null;
  roastProfileId?: string | null;
  quantity: string;
  status: LotStatus;
  parentLotId?: string | null;
  notes?: string | null;
  createdById?: string | null;
  item?: Item | null;
  location?: Location | null;
  roastProfile?: RoastProfile | null;
  parentLot?: Pick<Lot, "id" | "code"> | null;
  createdBy?: { id: string; fullName?: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoastProfile {
  id: string;
  code: string;
  name: string;
  roastLevel?: string | null;
  targetAgtron?: number | null;
  durationMinutes?: number | null;
  blendNotes?: string | null;
  shelfLifeDays?: number;
  notes?: string | null;
  isActive?: boolean;
}

export type ExportContractStatus =
  | "DRAFT"
  | "ALLOCATED"
  | "STAGED"
  | "SHIPPED"
  | "CLOSED"
  | "CANCELLED";

export type Incoterm = "FOB" | "CIF" | "CFR" | "EXW" | "FCA" | "DAP";

export interface ExportDocCheckItem {
  key: string;
  label: string;
  done: boolean;
}

export interface ExportPackingLine {
  lotId: string;
  lotCode: string;
  quantityKg: number;
  bags?: number;
  grade?: string | null;
}

export interface ExportAllocation {
  id: string;
  contractId: string;
  lotId: string;
  quantityKg: string;
  notes?: string | null;
  lot?: Lot;
  createdAt?: string;
}

export interface ExportContract {
  id: string;
  contractNumber: string;
  buyerName: string;
  customerId?: string | null;
  volumeKg: string;
  grade?: string | null;
  pricePerKg: string;
  currencyCode: string;
  incoterm: Incoterm;
  windowStart?: string | null;
  windowEnd?: string | null;
  status: ExportContractStatus;
  allocatedKg: string;
  shippedKg: string;
  stagingLocationId?: string | null;
  saleId?: string | null;
  bankAccountId?: string | null;
  packingList?: ExportPackingLine[];
  docChecklist?: ExportDocCheckItem[];
  notes?: string | null;
  shippedAt?: string | null;
  customer?: Customer | null;
  stagingLocation?: Location | null;
  allocations?: ExportAllocation[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LotEvent {
  id: string;
  lotId: string;
  eventType: LotEventType;
  quantity?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  relatedLotId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdById?: string | null;
  fromLocation?: Location | null;
  toLocation?: Location | null;
  relatedLot?: Pick<Lot, "id" | "code"> | null;
  createdBy?: { id: string; fullName?: string; email?: string } | null;
  createdAt: string;
}

export interface CollectionListTotals {
  weightKg: string;
  totalAmount: string;
}

export interface CherryPrice {
  id: string;
  grade: string;
  cropYear: string;
  pricePerKg: string;
  notes?: string | null;
  isActive?: boolean;
}

export interface CollectionTicket {
  id: string;
  ticketNumber: string;
  supplierId: string;
  locationId: string;
  itemId: string;
  lotId: string;
  purchaseId?: string | null;
  weightKg: string;
  grade?: string | null;
  pricePerKg: string;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  bankAccountId?: string | null;
  moisturePercent?: string | null;
  cropYear?: string | null;
  region?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  variety?: string | null;
  notes?: string | null;
  status: DocumentStatus;
  supplier?: Supplier;
  location?: Location;
  item?: Item;
  lot?: Lot;
  purchase?: Purchase | null;
  bankAccount?: BankAccount | null;
  createdBy?: { id: string; fullName?: string; email?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ProcessRunStatus =
  | "DRAFT"
  | "IN_PROGRESS"
  | "QC_HOLD"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface ProcessTemplate {
  id: string;
  code: string;
  name: string;
  inputForm: CoffeeForm;
  outputForm: CoffeeForm;
  expectedYieldPercent: string;
  requiresQc: boolean;
  stages: string[];
  inputItemId?: string | null;
  outputItemId?: string | null;
  maxMoisturePercent?: string | null;
  notes?: string | null;
  isActive?: boolean;
  inputItem?: Item | null;
  outputItem?: Item | null;
}

export interface QcResult {
  id: string;
  processRunId: string;
  lotId: string;
  moisturePercent?: string | null;
  defectCount?: number | null;
  cuppingScore?: string | null;
  passed: boolean;
  notes?: string | null;
  createdBy?: { id: string; fullName?: string } | null;
  createdAt: string;
}

export interface ProcessRun {
  id: string;
  runNumber: string;
  templateId: string;
  inputLotId: string;
  outputLotId?: string | null;
  locationId: string;
  quantityInput: string;
  quantityOutput?: string | null;
  quantityReject?: string;
  expectedYieldPercent: string;
  actualYieldPercent?: string | null;
  status: ProcessRunStatus;
  currentStageIndex: number;
  stages: string[];
  stagesCompleted: string[];
  processCost?: string;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  template?: ProcessTemplate;
  inputLot?: Lot;
  outputLot?: Lot | null;
  location?: Location;
  qcResults?: QcResult[];
  createdBy?: { id: string; fullName?: string } | null;
  createdAt?: string;
}

export type AiInsightKind =
  | "DEMAND_FORECAST"
  | "INTAKE_ADVICE"
  | "YIELD_ANOMALY"
  | "BLEND_OPTIMIZER"
  | "PRICING"
  | "EXPORT_READINESS"
  | "QUALITY_RISK";

export type AiInsightSeverity = "info" | "warn" | "critical";

export type AiInsightStatus =
  | "OPEN"
  | "ACCEPTED"
  | "REJECTED"
  | "DISMISSED"
  | "SUPERSEDED";

export type AiInsightSource = "DEMO" | "RULES" | "FORECAST";

export type AiFeedbackDecision = "ACCEPT" | "REJECT" | "DISMISS";

export interface AiInsight {
  id: string;
  code: string;
  kind: AiInsightKind;
  severity: AiInsightSeverity;
  status: AiInsightStatus;
  title: string;
  summary: string;
  href?: string | null;
  confidence: string;
  score?: string | null;
  payload: Record<string, unknown>;
  source: AiInsightSource;
  lotId?: string | null;
  exportContractId?: string | null;
  expiresAt?: string | null;
  lot?: { id: string; code: string } | null;
  exportContract?: {
    id: string;
    contractNumber: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AiSummary {
  open: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  acceptRate: number | null;
  openByKind: Record<string, number>;
  note: string;
}

export interface AiStockTrends {
  generatedAt: string;
  demoFilled: boolean;
  highlights: string[];
  stockByForm: Array<{ form: string; kg: number }>;
  stockByLocation: Array<{ locationName: string; kg: number }>;
  dailyOps: Array<{
    date: string;
    intakeKg: number;
    transferCount: number;
    transferKg: number;
    processEvents: number;
    soldKg: number;
    demoFilled?: boolean;
  }>;
  forecast: Array<{
    week: string;
    projectedGreenNeedKg: number;
    projectedIntakeKg: number;
  }>;
  signals: Array<{
    code: string;
    title: string;
    severity: string;
    detail: string;
    href: string;
  }>;
  totals: {
    greenKg: number;
    cherryKg: number;
    locationsTracked: number;
    avgDailyIntakeKg: number;
    avgDailySoldKg: number;
  };
}


