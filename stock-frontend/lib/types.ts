import type { Currency } from "@/lib/currency";

export type LocationType =
  | "WAREHOUSE"
  | "SHOWROOM"
  | "COLLECTION_CENTER"
  | "WET_MILL"
  | "DRY_MILL"
  | "ROASTERY"
  | "EXPORT_STAGING";
export type PaymentMethod = "CASH" | "BANK" | "CREDIT" | "PARTIAL";
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
  paidAmount?: string;
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
  amount?: string;
  paidAmount?: string;
  balance?: string;
  status?: CreditStatus;
  dueDate?: string | null;
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
  /** Kg locked for open export contracts. Available = quantity − reservedQuantity. */
  reservedQuantity?: string;
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

export type SupplierType =
  | "SUPPLIER"
  | "FARMER"
  | "COOPERATIVE"
  | "COLLECTOR"
  | "UNION"
  | "TRADER"
  | "PROCESSOR"
  | "OTHER";

export type SupplierDocumentKind =
  | "ID"
  | "AGREEMENT"
  | "BUSINESS_LICENSE"
  | "OTHER";

export interface SupplierDocument {
  id: string;
  supplierId: string;
  kind: SupplierDocumentKind;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById?: string | null;
  createdAt: string;
  downloadPath: string;
}

export interface SupplierBankAccountInfo {
  id: string;
  supplierId: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  sortOrder?: number;
}

export interface Supplier {
  id: string;
  name: string;
  supplierType?: SupplierType;
  contactPerson?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  region?: string | null;
  zone?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  organizationName?: string | null;
  tinNumber?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  notes?: string | null;
  isActive?: boolean;
  bankAccounts?: SupplierBankAccountInfo[];
  documents?: SupplierDocument[];
  createdAt?: string;
  updatedAt?: string;
}

export type CustomerDocumentKind = "AGENT_AGREEMENT" | "OTHER";

export interface CustomerDocument {
  id: string;
  customerId: string;
  kind: CustomerDocumentKind;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById?: string | null;
  createdAt: string;
  downloadPath: string;
}

export interface Customer {
  id: string;
  name: string;
  customerType?: CustomerType;
  contactPerson?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  organizationName?: string | null;
  tinNumber?: string | null;
  notes?: string | null;
  creditLimit?: string | null;
  isActive?: boolean;
  documents?: CustomerDocument[];
  createdAt?: string;
  updatedAt?: string;
  credit?: CustomerCreditProfile;
}

export interface CustomerCreditAgingBucket {
  key: string;
  label: string;
  risk?: string | null;
  count: number;
  balance: string;
}

export interface CustomerCreditLine {
  id: string;
  customerId: string;
  saleId: string;
  amount: string;
  paidAmount: string;
  balance: string;
  status: string;
  dueDate?: string | null;
  createdAt?: string;
  isOverdue?: boolean;
  daysOverdue?: number | null;
  agingDays?: number;
  agingKey?: string;
  agingLabel?: string;
  agingRisk?: string;
  sale?: { id: string; createdAt?: string; total?: string } | null;
  saleDate?: string;
}

export interface CustomerCreditPayment {
  id: string;
  date: string;
  amount: string;
  direction?: string;
  type?: string;
  description?: string | null;
  creditId?: string;
  saleId?: string;
  bankAccount?: { id: string; name: string } | null;
}

export interface CustomerCreditProfile {
  customerId: string;
  customerName: string;
  creditLimit: string | null;
  initialCreditLimit?: string | null;
  invoiceTotal: string;
  paidTotal: string;
  outstanding: string;
  usedCredit?: string;
  overdue: string;
  openCount: number;
  availableCredit: string | null;
  overLimit: boolean;
  agingStatus?: string | null;
  agingLabel?: string | null;
  agingDays?: number | null;
  creditScore?: number | null;
  eligibleIncreasePercent?: number | null;
  eligibleIncrease?: string | null;
  normalIncrease?: string | null;
  attentionIncrease?: string | null;
  lastLimitIncrease?: string | null;
  lastLimitIncreasePercent?: number | null;
  lastRepaymentDays?: number | null;
  lastRepaymentRisk?: string | null;
  credits?: CustomerCreditLine[];
  openCredits?: CustomerCreditLine[];
  payments?: CustomerCreditPayment[];
  aging?: {
    totalOutstanding: string;
    buckets: CustomerCreditAgingBucket[];
  };
  alerts?: {
    overdueCount: number;
    highlyCriticalCount: number;
    highlyCriticalBalance: string;
    highRiskCount: number;
    highRiskBalance: string;
  };
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
  paymentMethod?: "CASH" | "BANK";
  amount: string;
  description?: string;
  expenseDate: string;
  receiptOriginalName?: string | null;
  coffeeMarket?: "LOCAL" | "EXPORT" | null;
  category?: ExpenseCategory;
  bankAccount?: { id: string; name: string; accountType?: BankAccountType };
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
  isOverdue?: boolean;
  daysOverdue?: number | null;
  agingDays?: number;
  agingLabel?: string;
  agingRisk?: string;
  customer?: Customer;
  supplier?: Supplier;
  sale?: Pick<
    Sale,
    "id" | "total" | "subtotal" | "totalAmount" | "createdAt" | "paymentMethod" | "status" | "invoiceNumber"
  >;
  purchase?: Pick<
    Purchase,
    "id" | "total" | "subtotal" | "totalAmount" | "createdAt" | "paymentMethod" | "status"
  >;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreditPaymentHistoryItem {
  id: string;
  date: string;
  amount: string;
  direction: string;
  type: string;
  description?: string | null;
  bankAccount?: { id: string; name: string } | null;
  createdBy?: { id: string; fullName?: string } | null;
}

export interface CreditAgingBucket {
  key: string;
  label: string;
  risk?: string | null;
  count: number;
  balance: string;
}

export interface CreditAgingSide {
  totalOutstanding: string;
  buckets: CreditAgingBucket[];
}

export interface CreditAgingReport {
  currency?: string;
  customers: CreditAgingSide;
  suppliers: CreditAgingSide;
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
    localPurchases?: string;
    exportPurchases?: string;
    exportStaged?: string;
    openContracts?: string;
    unlinkedInventory?: string;
    notifications?: string;
    reports?: string;
    profitLoss?: string;
    insights?: string;
    credits?: string;
    marketPrices?: string;
  };
  market?: {
    instruments: Array<Record<string, unknown>>;
    fx: { rate: number; rateDate: string; source: string };
    chart30d: Array<{ date: string; usdPerKg: number; etbPerKg: number }>;
    valuation: {
      marketValueEtb: number;
      bookValueEtb: number;
      gapPercent: number | null;
    };
  } | null;
  analytics?: {
    inventory: {
      totalStockKg: string;
      stockValue: string;
      availableKg: string;
      reservedKg: string;
      exportStockKg: string;
      lowStockItems: number;
    };
    trading: {
      totalPurchases: string;
      localSalesValue: string;
      exportSalesValue: string;
      localSalesVolumeKg?: string;
      exportSalesVolumeKg?: string;
      salesVolumeKg: string;
      salesValue: string;
      chart: Array<{ label: string; value: number }>;
    };
    quality: {
      acceptedQtyKg: string;
      rejectedQtyKg: string;
      rejectionPercent: number;
      gradeDistribution: Array<{ grade: string; kg: number }>;
      supplierRanking: Array<{
        supplierName: string;
        totalKg: string;
        rejectedKg: string;
        rejectionPercent: number;
      }>;
    };
    finance: {
      totalReceivables: string;
      totalPayables: string;
      customerOutstanding: string;
      supplierOutstanding: string;
      overdueBalances: string;
      paidAmount: string;
      unpaidAmount: string;
      chart: Array<{ label: string; value: number }>;
    };
    production: {
      processingVolumeKg: string;
      roastingVolumeKg: string;
      productionYieldPercent: number;
      processingLossKg: string;
      wastageKg: string;
      chart: Array<{ label: string; value: number }>;
    };
    export: {
      exportVolumeKg: string;
      exportValue: string;
      activeContracts: number;
      pendingShipments: number;
      shippedQuantityKg: string;
      outstandingExportPayments: string;
    };
  };
  executiveInsights?: Array<{
    id: string;
    tone: "positive" | "critical" | "warn" | "info" | "profit";
    category: string;
    title: string;
    detail: string;
    href: string;
  }>;
}

export interface SalesStorePack {
  packs: number;
  kg: string;
  value: string;
}

export interface LocalDashboardData {
  channel: "LOCAL";
  currency?: Currency;
  asOf?: string;
  period?: { from?: string | null; to?: string | null };
  pipeline: {
    purchaseCount: number;
    purchaseKg: string;
    purchaseValue: string;
    inventoryKg: string;
    inventoryValue: string;
    processingStartedKg: string;
    cleaningKg: string;
    roastGroundKg: string;
    salesStoreKg: string;
    salesStoreValue: string;
    rejectKg: string;
    salesCount: number;
    salesKg: string;
    salesValue: string;
  };
  onHandChart: Array<{ label: string; value: number }>;
  activity: {
    cleaningInputKg: string;
    cleaningOutputKg: string;
    cleaningLossKg: string;
    yieldPercent: string;
    highLossRuns: number;
    underScreenRuns: number;
    roastKg: string;
    groundKg: string;
  };
  tradingChart: Array<{ label: string; value: number }>;
  salesStore: {
    roast: {
      kg1: SalesStorePack;
      kg500: SalesStorePack;
    };
    ground: {
      kg1: SalesStorePack;
      kg500: SalesStorePack;
    };
    availableKg: string;
    availableValue: string;
    soldKg: string;
    soldValue: string;
    soldRoastKg: string;
    soldRoastValue: string;
    soldGroundKg: string;
    soldGroundValue: string;
    trend: Array<{ label: string; roastKg: number; groundKg: number }>;
  };
  finance: {
    revenue: string;
    costOfGoodsSold: string;
    grossProfit: string;
    netProfit: string;
    customerCredit: string;
    supplierCredit: string;
  };
  stockByLocation: Array<{
    locationId: string;
    locationName: string;
    value: string;
    kg: string;
  }>;
  executiveInsights?: DashboardData["executiveInsights"];
}

export interface ExportDashboardData {
  channel: "EXPORT";
  currency?: Currency;
  asOf?: string;
  period?: { from?: string | null; to?: string | null };
  totalInventoryValue: string;
  stockValueByLocation: DashboardData["stockValueByLocation"];
  dailySales: string;
  profitAndLoss: DashboardData["profitAndLoss"];
  financialOverview: DashboardData["financialOverview"];
  pulse: {
    greenStockKg: string;
    exportStagedKg: string;
    openAlerts: number;
    exportSalesToday: string;
  } | null;
  contracts?: DashboardData["contracts"];
  pipeline?: {
    byStatus: Record<
      string,
      { count: number; volumeKg: string; allocatedKg: string; shippedKg: string }
    >;
    chart: Array<{ label: string; value: number; kg: number }>;
  };
  commercial: {
    exportRevenue: string;
    customerCreditOutstanding: string;
    totalLiquidity: string;
    outstandingExportPayments: string;
  } | null;
  analytics: {
    inventory: {
      totalStockKg: string;
      stockValue: string;
      availableKg: string;
      reservedKg: string;
      exportStockKg: string;
    };
    trading: {
      exportSalesValue: string;
      salesVolumeKg: string;
      salesValue: string;
      chart: Array<{ label: string; value: number }>;
    };
    export: NonNullable<DashboardData["analytics"]>["export"];
  } | null;
  market?: DashboardData["market"];
  recommendations?: DashboardData["recommendations"];
  executiveInsights?: DashboardData["executiveInsights"];
  links?: DashboardData["links"];
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

/** ECTA / lab quality result attached to a coffee purchase line. */
export interface PurchaseQualityResult {
  id: string;
  purchaseId: string;
  purchaseLineId: string;
  lotId: string;
  labName?: string | null;
  testedAt?: string | null;
  certificateNumber?: string | null;
  grade?: string | null;
  moisturePercent?: string | number | null;
  screenSize?: string | null;
  cuppingScore?: string | number | null;
  defectCount?: number | null;
  defectLevel?: string | null;
  passed?: boolean | null;
  notes?: string | null;
  documentOriginalName?: string | null;
  documentMimeType?: string | null;
  documentSizeBytes?: number | null;
  hasDocument?: boolean;
  downloadPath?: string | null;
  recordedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lot?: Pick<Lot, "id" | "code" | "grade"> | null;
}

export interface PurchaseLine {
  id?: string;
  itemId: string;
  lotId?: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal?: string;
  amount?: string;
  item?: Item;
  lot?: Lot | null;
  quality?: PurchaseQualityResult | null;
}

export interface Purchase {
  id: string;
  supplierId?: string;
  locationId?: string;
  purchaseType?: PurchaseType;
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  notes?: string;
  creditDueDate?: string;
  status?: DocumentStatus;
  subtotal?: string;
  total?: string;
  paidAmount?: string;
  outstandingAmount?: string;
  /** True when additional supplier credit payments were posted after create. */
  hasCreditPayments?: boolean;
  /** @deprecated Prefer `total` */
  totalAmount?: string;
  createdAt?: string;
  updatedAt?: string;
  supplier?: Supplier;
  location?: Location;
  bankAccount?: BankAccount;
  credit?: LinkedCredit;
  supplierCredit?: LinkedCredit;
  lines?: PurchaseLine[];
  qualityResults?: PurchaseQualityResult[];
  processRuns?: ProcessRun[];
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

/** Purchase intended for local market vs export-bound stock. */
export type PurchaseType = "LOCAL" | "EXPORT";

export interface Sale {
  id: string;
  invoiceNumber?: string | null;
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
  paidAmount?: string;
  outstandingAmount?: string;
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
  credit?: LinkedCredit;
  customerCredit?: LinkedCredit;
  lines?: SaleLine[];
  returns?: SaleReturn[];
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
  totals: { count: number; total: string; subtotal?: string };
  byPaymentMethod: ReportPaymentMethodRow[];
  byLocation: ReportLocationBreakdownRow[];
  byPurchaseType?: { purchaseType: string; count: number; total: string }[];
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
  aging?: {
    customers: CreditAgingSide;
    suppliers: CreditAgingSide;
  };
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
  | "FLOUR"
  | "PACKAGED"
  | "REJECT";

export type ProcessOperationType =
  | "MILL"
  | "FLOUR"
  | "ROAST"
  | "PACK"
  | "OTHER";

export type CustomerType =
  | "NORMAL"
  | "AGENT"
  | "RETAIL"
  | "WHOLESALE"
  | "CAFE"
  | "OTHER";

export type StockMovementDirection = "IN" | "OUT";

export type StockMovementSourceType =
  | "PURCHASE"
  | "COLLECTION"
  | "PRODUCTION_OUTPUT"
  | "PRODUCTION_CONSUMPTION"
  | "PRODUCTION_LOSS"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "SALE_LOCAL"
  | "SALE_EXPORT"
  | "SALE_RETURN"
  | "EXPORT_SHIPMENT"
  | "REJECTION"
  | "DAMAGE"
  | "WASTAGE"
  | "RETURN_SUPPLIER"
  | "ADJUSTMENT"
  | "OTHER";

export type LotStatus = "ACTIVE" | "HOLD" | "VOIDED";

export type LotQcPhase =
  | "RECEIVED"
  | "SAMPLE_TESTED"
  | "GRADED"
  | "ACCEPTED"
  | "REJECTED"
  | "PROCESSED"
  | "FINAL_GRADE";

export type ReceivingDisposition = "ACCEPTED" | "PARTIAL" | "REJECTED";

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
  | "RELEASED_EXPORT"
  | "SHIPPED"
  | "DELIVERED"
  | "VOIDED"
  | "SAMPLE_TESTED"
  | "GRADED"
  | "RECEIVING_ACCEPTED"
  | "RECEIVING_REJECTED"
  | "FINAL_GRADED"
  | "SALE_RETURNED"
  | "PRODUCTION_LOSS";

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
  zone?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  moisturePercent?: string | null;
  screenSize?: string | null;
  cuppingScore?: string | null;
  defectCount?: number | null;
  defectLevel?: string | null;
  qcPhase?: LotQcPhase;
  inspectorId?: string | null;
  inspectedAt?: string | null;
  rejectReason?: string | null;
  rejectPercent?: string | null;
  rejectAction?: string | null;
  ectaCertificateNumber?: string | null;
  ectaTestedAt?: string | null;
  ectaGrade?: string | null;
  ectaMoisturePercent?: string | null;
  ectaCuppingScore?: string | null;
  ectaNotes?: string | null;
  ectaDocumentOriginalName?: string | null;
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
  inspector?: { id: string; fullName?: string } | null;
  parentLot?: Lot | null;
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
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

export type Incoterm = "FOB" | "CIF" | "CFR" | "EXW" | "FCA" | "DAP";

export interface ExportDocCheckItem {
  key: string;
  label: string;
  done: boolean;
  reference?: string | null;
  url?: string | null;
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
  orderNumber?: string | null;
  buyerName: string;
  buyerCountry?: string | null;
  customerId?: string | null;
  volumeKg: string;
  grade?: string | null;
  coffeeType?: string | null;
  origin?: string | null;
  pricePerKg: string;
  currencyCode: string;
  incoterm: Incoterm;
  windowStart?: string | null;
  windowEnd?: string | null;
  destination?: string | null;
  containerNumber?: string | null;
  shippingDate?: string | null;
  expectedArrival?: string | null;
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
  deliveredAt?: string | null;
  customer?: Customer | null;
  stagingLocation?: Location | null;
  allocations?: ExportAllocation[];
  sale?: Sale | null;
  /** Derived: RESERVED | SHIPPED | DELIVERED | NONE */
  stockState?: string;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "NONE";
  paidAmount?: string | null;
  outstandingAmount?: string | null;
  invoiceTotal?: string | null;
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
  disposition?: ReceivingDisposition;
  acceptedWeightKg?: string | null;
  rejectedWeightKg?: string;
  rejectLotId?: string | null;
  grade?: string | null;
  pricePerKg: string;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  bankAccountId?: string | null;
  moisturePercent?: string | null;
  cropYear?: string | null;
  region?: string | null;
  zone?: string | null;
  woreda?: string | null;
  kebele?: string | null;
  variety?: string | null;
  processMethod?: string | null;
  screenSize?: string | null;
  cuppingScore?: string | null;
  defectLevel?: string | null;
  inspectorId?: string | null;
  inspectedAt?: string | null;
  rejectReason?: string | null;
  rejectPercent?: string | null;
  rejectAction?: string | null;
  rejectDestinationId?: string | null;
  notes?: string | null;
  status: DocumentStatus;
  supplier?: Supplier;
  location?: Location;
  item?: Item;
  lot?: Lot;
  rejectLot?: Lot | null;
  purchase?: Purchase | null;
  bankAccount?: BankAccount | null;
  inspector?: { id: string; fullName?: string } | null;
  rejectDestination?: Location | null;
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
  operationType?: ProcessOperationType;
  packSizeKg?: string | null;
  expectedYieldPercent: string;
  requiresQc: boolean;
  stages: string[];
  inputItemId?: string | null;
  outputItemId?: string | null;
  maxMoisturePercent?: string | null;
  notes?: string | null;
  /** LOCAL or EXPORT intake workflow. Empty for mill/roast/pack templates. */
  workflow?: "LOCAL" | "EXPORT" | null;
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

export type LocalStageWarning = "HIGH_LOSS" | "UNDER_SCREEN";

export interface LocalStagePack {
  sizeKg: number;
  count: number;
  lotId: string;
  lotCode: string;
  sku: string;
  kind?: "ROAST" | "GROUND";
}

export interface LocalStageResult {
  stage: string;
  inputQty: string;
  removedQty: string;
  outputQty: string;
  lossPercent: string;
  warnings: LocalStageWarning[];
  completedAt: string;
  completedById?: string | null;
  completedByName?: string | null;
  outputLotId?: string | null;
  outputLotCode?: string | null;
  rejectLotId?: string | null;
  rejectLotCode?: string | null;
  notes?: string | null;
  packs?: LocalStagePack[];
  remainderKg?: string;
  roastQty?: string;
  groundQty?: string;
  roastLotId?: string | null;
  roastLotCode?: string | null;
  groundLotId?: string | null;
  groundLotCode?: string | null;
  unallocatedKg?: string;
  roastRemainderKg?: string;
  groundRemainderKg?: string;
}

export interface ProcessInputLine {
  lotId: string;
  itemId: string;
  lotCode: string;
  itemDescription: string;
  quantity: string;
}

export interface LocalMarketView {
  stages: string[];
  nextStage: string | null;
  availableInputKg: string;
  cleaningOutputKg: string | null;
  roastOutputKg: string | null;
  roastPackKg: string | null;
  groundPackKg: string | null;
  salesStore: {
    packs: Array<{
      sizeKg: number;
      produced: number;
      onHand: number;
      sold: number;
      lotId: string;
      lotCode: string;
      sku: string;
      kind?: "ROAST" | "GROUND" | null;
      locationName?: string | null;
    }>;
    remainderKg: string;
    roastRemainderKg?: string | null;
    groundRemainderKg?: string | null;
  } | null;
}

export interface ExportPostEcta {
  grade?: string | null;
  certificateNumber?: string | null;
  moisturePercent?: string | null;
  cuppingScore?: string | null;
  testedAt?: string | null;
  notes?: string | null;
}

export interface ExportDocumentRecord {
  key: string;
  label: string;
  reference?: string | null;
  notes?: string | null;
}

export interface ExportDoniyaLabel {
  businessName: string;
  location: string;
  coffeeName: string;
  origin: string;
  netWeight: string;
  certificateNumber: string;
  icoNumber: string;
  productionDate: string;
  expiryDate: string;
  destination: string;
}

export interface ExportStageResult extends LocalStageResult {
  expectedGrade?: string | null;
  kgPerDoniya?: string | null;
  doniyaCount?: number | null;
  packagedKg?: string | null;
  remainderKg?: string | null;
  remainderLotId?: string | null;
  remainderLotCode?: string | null;
  exportStoreLocationId?: string | null;
  exportStoreLocationName?: string | null;
  doniyaLabel?: ExportDoniyaLabel | null;
  postEcta?: ExportPostEcta | null;
  documents?: ExportDocumentRecord[];
}

export interface ExportSourceLot {
  id: string;
  code: string;
  grade?: string | null;
  form?: string | null;
  quantity: string;
  ectaGrade?: string | null;
  ectaCertificateNumber?: string | null;
  ectaMoisturePercent?: string | null;
  ectaCuppingScore?: string | null;
  ectaTestedAt?: string | null;
  ectaNotes?: string | null;
}

export interface ExportMarketView {
  stages: string[];
  nextStage: string | null;
  availableInputKg: string;
  maxLossPercent: number;
  sourceLots: ExportSourceLot[];
}

export interface ExportStoreLot {
  lotId: string;
  lotCode: string;
  grade?: string | null;
  quantityKg: string;
  locationName?: string | null;
  itemDescription?: string | null;
  parentLotId?: string | null;
  ectaGrade?: string | null;
  ectaCertificateNumber?: string | null;
  ectaMoisturePercent?: string | null;
  ectaCuppingScore?: string | null;
  ectaTestedAt?: string | null;
  runId?: string | null;
  runNumber?: string | null;
  kgPerDoniya?: string | null;
  doniyaCount?: number | null;
  remainderKg?: string | null;
  doniyaLabel?: ExportDoniyaLabel | null;
  documents?: ExportDocumentRecord[];
  status: "IN_STORE" | "RESERVED" | "SHIPPED";
  reservedKg: string;
  shippedKg: string;
  contracts: Array<{
    id: string;
    contractNumber?: string | null;
    status?: string | null;
    quantityKg: string;
  }>;
}

export interface ProcessRun {
  id: string;
  runNumber: string;
  templateId: string;
  inputLotId: string;
  outputLotId?: string | null;
  locationId: string;
  workflow?: "LOCAL" | "EXPORT" | null;
  purchaseId?: string | null;
  purchaseLineId?: string | null;
  quantityInput: string;
  quantityOutput?: string | null;
  quantityReject?: string;
  quantityLoss?: string;
  packCount?: string | null;
  expectedYieldPercent: string;
  actualYieldPercent?: string | null;
  status: ProcessRunStatus;
  currentStageIndex: number;
  stages: string[];
  stagesCompleted: string[];
  stageResults?: Array<LocalStageResult | ExportStageResult>;
  inputLines?: ProcessInputLine[];
  localMarket?: LocalMarketView;
  exportMarket?: ExportMarketView;
  processCost?: string;
  roastProfileId?: string | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  template?: ProcessTemplate;
  inputLot?: Lot;
  outputLot?: Lot | null;
  location?: Location;
  roastProfile?: RoastProfile | null;
  qcResults?: QcResult[];
  createdBy?: { id: string; fullName?: string } | null;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  movedAt: string;
  direction: StockMovementDirection;
  sourceType: StockMovementSourceType;
  itemId: string;
  lotId?: string | null;
  locationId: string;
  quantity: string;
  grade?: string | null;
  batchCode?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdById?: string | null;
  item?: Item;
  lot?: Lot | null;
  location?: Location;
  createdBy?: { id: string; fullName?: string } | null;
  createdAt?: string;
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  locationId: string;
  totalAmount: string;
  refundMethod: PaymentMethod | string;
  bankAccountId?: string | null;
  bankAccount?: BankAccount | null;
  refundedAt?: string | null;
  notes?: string | null;
  status: string;
  lines?: SaleReturnLine[];
  createdAt?: string;
}

export interface SaleReturnLine {
  id: string;
  saleReturnId: string;
  saleLineId?: string | null;
  itemId: string;
  lotId?: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  item?: Item;
  lot?: Lot | null;
}

export type AiInsightKind =
  | "DEMAND_FORECAST"
  | "INTAKE_ADVICE"
  | "STOCK_PREDICTION"
  | "PROCUREMENT"
  | "YIELD_ANOMALY"
  | "BLEND_OPTIMIZER"
  | "PRICING"
  | "EXPORT_READINESS"
  | "QUALITY_RISK"
  | "CREDIT_RISK"
  | "MARKET_ALERT";

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
    projectedLocalKg?: number;
    projectedExportKg?: number;
  }>;
  demand?: {
    localDailyKg: number;
    exportDailyKg: number;
    sampleDays: number;
  };
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

export interface AiAskResponse {
  question: string;
  intent: string;
  answer: string;
  data?: Record<string, unknown>;
  href?: string;
  suggestions: string[];
}


