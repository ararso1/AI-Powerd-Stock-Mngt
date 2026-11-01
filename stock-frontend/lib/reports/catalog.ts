export type ReportCategory =
  | "finance"
  | "sales"
  | "purchases"
  | "inventory"
  | "operations"
  | "exports"
  | "partners"
  | "people"
  | "audit";

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  legacyTab?: string;
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  finance: "Finance",
  sales: "Sales",
  purchases: "Purchases",
  inventory: "Inventory",
  operations: "Operations",
  exports: "Exports",
  partners: "Partners",
  people: "People",
  audit: "Audit",
};

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    id: "summary",
    title: "Financial summary",
    description: "Revenue, COGS, expenses, and profit for the period",
    category: "finance",
    legacyTab: "summary",
  },
  {
    id: "profit-loss",
    title: "Profit & loss",
    description: "P&L using sale-line cost of goods",
    category: "finance",
    legacyTab: "profit-loss",
  },
  {
    id: "cash-flow",
    title: "Cash flow",
    description: "Daily bank inflows and outflows",
    category: "finance",
    legacyTab: "cash-flow",
  },
  {
    id: "expenses",
    title: "Expenses",
    description: "Expense totals by category",
    category: "finance",
    legacyTab: "expenses",
  },
  {
    id: "banks",
    title: "Banks & cash",
    description: "Account balances and transaction register",
    category: "finance",
  },
  {
    id: "market-snapshot",
    title: "Market prices",
    description: "ICE / market price history snapshot",
    category: "finance",
  },
  {
    id: "sales",
    title: "Sales",
    description: "Sales totals by payment method and location",
    category: "sales",
    legacyTab: "sales",
  },
  {
    id: "sales-by-item",
    title: "Sales by item",
    description: "Quantity, revenue, cost, and margin by item",
    category: "sales",
    legacyTab: "sales-by-item",
  },
  {
    id: "commissions",
    title: "Commissions",
    description: "Sales commission by representative",
    category: "sales",
    legacyTab: "commissions",
  },
  {
    id: "purchases",
    title: "Purchases",
    description: "Purchase totals by payment, location, and type",
    category: "purchases",
    legacyTab: "purchases",
  },
  {
    id: "purchases-by-item",
    title: "Purchases by item",
    description: "Quantity and spend by purchased item",
    category: "purchases",
    legacyTab: "purchases-by-item",
  },
  {
    id: "inventory-aging",
    title: "Inventory aging",
    description: "Stock lines ranked by age and value",
    category: "inventory",
    legacyTab: "inventory-aging",
  },
  {
    id: "inventory-on-hand",
    title: "Inventory on hand",
    description: "Available vs reserved stock by location and lot",
    category: "inventory",
  },
  {
    id: "inventory-adjustments",
    title: "Stock adjustments",
    description: "Manual stock adjustments by reason",
    category: "inventory",
  },
  {
    id: "transfers",
    title: "Stock transfers",
    description: "Inter-location transfer register",
    category: "inventory",
  },
  {
    id: "lots",
    title: "Lots register",
    description: "Lots by form, grade, status, and location",
    category: "operations",
  },
  {
    id: "collections",
    title: "Collections / intake",
    description: "Cherry and intake tickets by disposition",
    category: "operations",
  },
  {
    id: "process-yield",
    title: "Process yield & loss",
    description: "Process runs with yield, loss, and reject",
    category: "operations",
  },
  {
    id: "exports-pipeline",
    title: "Export pipeline",
    description: "Export contracts by status and volume",
    category: "exports",
  },
  {
    id: "customer-activity",
    title: "Customer activity",
    description: "Sales count and spend by customer",
    category: "partners",
    legacyTab: "customer-activity",
  },
  {
    id: "supplier-activity",
    title: "Supplier activity",
    description: "Purchase count and spend by supplier",
    category: "partners",
    legacyTab: "supplier-activity",
  },
  {
    id: "credits",
    title: "Credits & aging",
    description: "Customer AR and supplier AP outstanding",
    category: "partners",
    legacyTab: "credits",
  },
  {
    id: "approvals",
    title: "Approvals audit",
    description: "Approval requests by status and entity",
    category: "audit",
  },
  {
    id: "hr-headcount",
    title: "People & HR",
    description: "Headcount by department and employment status",
    category: "people",
  },
];

export function findReport(id: string) {
  return REPORT_CATALOG.find((r) => r.id === id);
}

export function legacyTabToReportId(tab: string) {
  return REPORT_CATALOG.find((r) => r.legacyTab === tab)?.id ?? tab;
}

export function reportsByCategory() {
  const order: ReportCategory[] = [
    "finance",
    "sales",
    "purchases",
    "inventory",
    "operations",
    "exports",
    "partners",
    "people",
    "audit",
  ];
  return order.map((category) => ({
    category,
    label: REPORT_CATEGORY_LABELS[category],
    reports: REPORT_CATALOG.filter((r) => r.category === category),
  }));
}
