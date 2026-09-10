export enum LocationType {
  WAREHOUSE = 'WAREHOUSE',
  SHOWROOM = 'SHOWROOM',
  COLLECTION_CENTER = 'COLLECTION_CENTER',
  WET_MILL = 'WET_MILL',
  DRY_MILL = 'DRY_MILL',
  ROASTERY = 'ROASTERY',
  EXPORT_STAGING = 'EXPORT_STAGING',
}

/** Physical form of coffee for lot tracking. */
export enum CoffeeForm {
  CHERRY = 'CHERRY',
  PARCHMENT = 'PARCHMENT',
  GREEN = 'GREEN',
  ROASTED = 'ROASTED',
  PACKAGED = 'PACKAGED',
  REJECT = 'REJECT',
}

export enum LotStatus {
  ACTIVE = 'ACTIVE',
  HOLD = 'HOLD',
  VOIDED = 'VOIDED',
}

/** Append-only lot lifecycle events. */
export enum LotEventType {
  CREATED = 'CREATED',
  COLLECTED = 'COLLECTED',
  TRANSFERRED = 'TRANSFERRED',
  PROCESS_STARTED = 'PROCESS_STARTED',
  PROCESS_COMPLETED = 'PROCESS_COMPLETED',
  QC_HELD = 'QC_HELD',
  QC_RELEASED = 'QC_RELEASED',
  ADJUSTED = 'ADJUSTED',
  SPLIT = 'SPLIT',
  MERGED = 'MERGED',
  ROASTED = 'ROASTED',
  PACKAGED = 'PACKAGED',
  SOLD_LOCAL = 'SOLD_LOCAL',
  ALLOCATED_EXPORT = 'ALLOCATED_EXPORT',
  SHIPPED = 'SHIPPED',
  VOIDED = 'VOIDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  CREDIT = 'CREDIT',
}

/** Ledger account: physical cash till vs real bank account. */
export enum BankAccountType {
  CASH = 'CASH',
  BANK = 'BANK',
}

export enum BankTransactionType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  EXPENSE = 'EXPENSE',
  CREDIT_PAYMENT = 'CREDIT_PAYMENT',
  CREDIT_RECEIPT = 'CREDIT_RECEIPT',
  ADJUSTMENT = 'ADJUSTMENT',
  OPENING = 'OPENING',
}

/** Money movement relative to the bank/cash account. */
export enum BankTransactionDirection {
  IN = 'in',
  OUT = 'out',
}

export enum CreditType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
}

export enum CreditStatus {
  OPEN = 'OPEN',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
}

export enum TransferStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DocumentStatus {
  ACTIVE = 'ACTIVE',
  VOIDED = 'VOIDED',
}

/** Whether commission is calculated on sale profit or gross subtotal. */
export enum CommissionBasis {
  PROFIT = 'PROFIT',
  SALES = 'SALES',
}

export const DEFAULT_COMMISSION_PERCENT = 10;

/** Inventory stock adjustment reasons (manual qty changes with audit). */
export enum StockAdjustmentReason {
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
  FOUND = 'FOUND',
  COUNT = 'COUNT',
  OPENING = 'OPENING',
  RETURN = 'RETURN',
  OTHER = 'OTHER',
  MOISTURE_LOSS = 'MOISTURE_LOSS',
  SHRINKAGE = 'SHRINKAGE',
  QC_REJECT = 'QC_REJECT',
}

/** Stock quantity movement for adjustments. */
export enum StockAdjustmentDirection {
  IN = 'in',
  OUT = 'out',
}

/** Catalog classification for manufacturing / BOM. */
export enum ItemType {
  RAW = 'RAW',
  SEMI = 'SEMI',
  FINISHED = 'FINISHED',
  OTHER = 'OTHER',
}

export enum ProductionOrderStatus {
  DRAFT = 'DRAFT',
  RELEASED = 'RELEASED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Coffee mill / roast process run lifecycle. */
export enum ProcessRunStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  QC_HOLD = 'QC_HOLD',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Local roast sale vs export shipment channel. */
export enum SaleChannel {
  LOCAL = 'LOCAL',
  EXPORT = 'EXPORT',
}

/** Export contract / shipment lifecycle. */
export enum ExportContractStatus {
  DRAFT = 'DRAFT',
  ALLOCATED = 'ALLOCATED',
  STAGED = 'STAGED',
  SHIPPED = 'SHIPPED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

/** Common Incoterms for coffee export contracts. */
export enum Incoterm {
  FOB = 'FOB',
  CIF = 'CIF',
  CFR = 'CFR',
  EXW = 'EXW',
  FCA = 'FCA',
  DAP = 'DAP',
}

/** In-app notification categories (matches permission modules where applicable). */
export enum NotificationType {
  LOW_STOCK = 'LOW_STOCK',
  STOCK_TRANSFER = 'STOCK_TRANSFER',
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  CREDIT_DUE = 'CREDIT_DUE',
  EXPENSE = 'EXPENSE',
  SYSTEM = 'SYSTEM',
  FRESHNESS = 'FRESHNESS',
}

/** AI decision-support insight categories (Step 8). */
export enum AiInsightKind {
  DEMAND_FORECAST = 'DEMAND_FORECAST',
  INTAKE_ADVICE = 'INTAKE_ADVICE',
  YIELD_ANOMALY = 'YIELD_ANOMALY',
  BLEND_OPTIMIZER = 'BLEND_OPTIMIZER',
  PRICING = 'PRICING',
  EXPORT_READINESS = 'EXPORT_READINESS',
  QUALITY_RISK = 'QUALITY_RISK',
}

export enum AiInsightSeverity {
  INFO = 'info',
  WARN = 'warn',
  CRITICAL = 'critical',
}

export enum AiInsightStatus {
  OPEN = 'OPEN',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  DISMISSED = 'DISMISSED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum AiInsightSource {
  DEMO = 'DEMO',
  RULES = 'RULES',
  FORECAST = 'FORECAST',
}

export enum AiFeedbackDecision {
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  DISMISS = 'DISMISS',
}
