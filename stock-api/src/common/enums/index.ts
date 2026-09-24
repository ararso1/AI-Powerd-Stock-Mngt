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
  FLOUR = 'FLOUR',
  PACKAGED = 'PACKAGED',
  REJECT = 'REJECT',
}

/** Local processing operation family. */
export enum ProcessOperationType {
  MILL = 'MILL',
  FLOUR = 'FLOUR',
  ROAST = 'ROAST',
  PACK = 'PACK',
  OTHER = 'OTHER',
}

/** Domestic customer segment. */
export enum CustomerType {
  NORMAL = 'NORMAL',
  AGENT = 'AGENT',
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
  CAFE = 'CAFE',
  OTHER = 'OTHER',
}

/** Uploaded customer document category. */
export enum CustomerDocumentKind {
  AGENT_AGREEMENT = 'AGENT_AGREEMENT',
  OTHER = 'OTHER',
}

/** Coffee procurement supplier classification. */
export enum SupplierType {
  SUPPLIER = 'SUPPLIER',
  FARMER = 'FARMER',
  COOPERATIVE = 'COOPERATIVE',
  COLLECTOR = 'COLLECTOR',
  UNION = 'UNION',
  TRADER = 'TRADER',
  PROCESSOR = 'PROCESSOR',
  OTHER = 'OTHER',
}

/** Uploaded supplier document category. */
export enum SupplierDocumentKind {
  ID = 'ID',
  AGREEMENT = 'AGREEMENT',
  BUSINESS_LICENSE = 'BUSINESS_LICENSE',
  OTHER = 'OTHER',
}

/** Unified stock ledger direction. */
export enum StockMovementDirection {
  IN = 'IN',
  OUT = 'OUT',
}

/** Unified stock ledger source (why the qty moved). */
export enum StockMovementSourceType {
  PURCHASE = 'PURCHASE',
  COLLECTION = 'COLLECTION',
  PRODUCTION_OUTPUT = 'PRODUCTION_OUTPUT',
  PRODUCTION_CONSUMPTION = 'PRODUCTION_CONSUMPTION',
  PRODUCTION_LOSS = 'PRODUCTION_LOSS',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  SALE_LOCAL = 'SALE_LOCAL',
  SALE_EXPORT = 'SALE_EXPORT',
  SALE_RETURN = 'SALE_RETURN',
  EXPORT_SHIPMENT = 'EXPORT_SHIPMENT',
  REJECTION = 'REJECTION',
  DAMAGE = 'DAMAGE',
  WASTAGE = 'WASTAGE',
  RETURN_SUPPLIER = 'RETURN_SUPPLIER',
  ADJUSTMENT = 'ADJUSTMENT',
  OTHER = 'OTHER',
}

export enum LotStatus {
  ACTIVE = 'ACTIVE',
  HOLD = 'HOLD',
  VOIDED = 'VOIDED',
}

/**
 * Quality / grade lifecycle on a lot (orthogonal to operational LotStatus).
 * Received → Sample Tested → Graded → Accepted/Rejected → Processed → Final Grade
 */
export enum LotQcPhase {
  RECEIVED = 'RECEIVED',
  SAMPLE_TESTED = 'SAMPLE_TESTED',
  GRADED = 'GRADED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PROCESSED = 'PROCESSED',
  FINAL_GRADE = 'FINAL_GRADE',
}

/** Receiving inspection outcome on collection / purchase intake. */
export enum ReceivingDisposition {
  ACCEPTED = 'ACCEPTED',
  PARTIAL = 'PARTIAL',
  REJECTED = 'REJECTED',
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
  RELEASED_EXPORT = 'RELEASED_EXPORT',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  VOIDED = 'VOIDED',
  SAMPLE_TESTED = 'SAMPLE_TESTED',
  GRADED = 'GRADED',
  RECEIVING_ACCEPTED = 'RECEIVING_ACCEPTED',
  RECEIVING_REJECTED = 'RECEIVING_REJECTED',
  FINAL_GRADED = 'FINAL_GRADED',
  SALE_RETURNED = 'SALE_RETURNED',
  PRODUCTION_LOSS = 'PRODUCTION_LOSS',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  CREDIT = 'CREDIT',
  /** Deposit now via bank; remainder tracked as supplier credit. */
  PARTIAL = 'PARTIAL',
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
  DELIVERED = 'DELIVERED',
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

/** AI decision-support insight categories (Step 8 / §10). */
export enum AiInsightKind {
  DEMAND_FORECAST = 'DEMAND_FORECAST',
  INTAKE_ADVICE = 'INTAKE_ADVICE',
  STOCK_PREDICTION = 'STOCK_PREDICTION',
  PROCUREMENT = 'PROCUREMENT',
  YIELD_ANOMALY = 'YIELD_ANOMALY',
  BLEND_OPTIMIZER = 'BLEND_OPTIMIZER',
  PRICING = 'PRICING',
  EXPORT_READINESS = 'EXPORT_READINESS',
  QUALITY_RISK = 'QUALITY_RISK',
  CREDIT_RISK = 'CREDIT_RISK',
  MARKET_ALERT = 'MARKET_ALERT',
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
