import type {
  BankAccountType,
  BankTransactionDirection,
  BankTransactionType,
  CoffeeForm,
  CreditStatus,
  LocationType,
  LotStatus,
  PaymentMethod,
  ProductionOrderStatus,
  SaleChannel,
  StockAdjustmentDirection,
  StockAdjustmentReason,
  TransferStatus,
} from "@/lib/types";
import { MAX_LIMIT } from "@/lib/pagination";

export type ListQueryParamValue =
  | string
  | number
  | boolean
  | undefined
  | null;

export type ListQueryParams = Record<string, ListQueryParamValue>;

export type GenericListQueryParams = {
  from?: string;
  to?: string;
  search?: string;
};

export type InventoryListQueryParams = GenericListQueryParams & {
  locationId?: string;
  lotId?: string;
  form?: CoffeeForm;
  cropYear?: string;
  grade?: string;
};

export type InventoryAdjustmentsListQueryParams = GenericListQueryParams & {
  locationId?: string;
  itemId?: string;
  direction?: StockAdjustmentDirection;
  reason?: StockAdjustmentReason;
};

export type CustomerSupplierListQueryParams = GenericListQueryParams;

export type PurchasesListQueryParams = GenericListQueryParams & {
  includeVoided?: boolean;
  supplierId?: string;
  locationId?: string;
  paymentMethod?: PaymentMethod;
};

export type SalesListQueryParams = GenericListQueryParams & {
  includeVoided?: boolean;
  soldByUserId?: string;
  customerId?: string;
  locationId?: string;
  paymentMethod?: PaymentMethod;
  channel?: SaleChannel;
};

export type ExpensesListQueryParams = GenericListQueryParams & {
  categoryId?: string;
  bankAccountId?: string;
};

export type CreditsCustomersListQueryParams = GenericListQueryParams & {
  status?: CreditStatus;
  customerId?: string;
};

export type CreditsSuppliersListQueryParams = GenericListQueryParams & {
  status?: CreditStatus;
  supplierId?: string;
};

export type StockTransfersListQueryParams = GenericListQueryParams & {
  fromLocationId?: string;
  toLocationId?: string;
  status?: TransferStatus;
};

export type BomsListQueryParams = GenericListQueryParams & {
  finishedItemId?: string;
  isActive?: boolean;
};

export type ProductionOrdersListQueryParams = GenericListQueryParams & {
  locationId?: string;
  finishedItemId?: string;
  bomId?: string;
  status?: ProductionOrderStatus;
};

export type BanksAccountsListQueryParams = GenericListQueryParams & {
  type?: BankAccountType;
  includeInactive?: boolean;
};

export type BanksTransactionsListQueryParams = GenericListQueryParams & {
  bankAccountId?: string;
  type?: BankTransactionType;
  direction?: BankTransactionDirection;
};

export type LocationsListQueryParams = GenericListQueryParams & {
  type?: LocationType;
  includeInactive?: boolean;
};

export type UsersListQueryParams = GenericListQueryParams & {
  roleId?: string;
  isActive?: boolean;
};

export type RolesListQueryParams = GenericListQueryParams;

export type PermissionsListQueryParams = GenericListQueryParams & {
  module?: string;
};

export type NotificationsListQueryParams = GenericListQueryParams & {
  isRead?: boolean;
  module?: string;
};

export type ReportsDateQueryParams = {
  from?: string;
  to?: string;
};

export type ReportsSalesQueryParams = ReportsDateQueryParams & {
  locationId?: string;
  customerId?: string;
  soldByUserId?: string;
};

export type ReportsPurchasesQueryParams = ReportsDateQueryParams & {
  locationId?: string;
  supplierId?: string;
};

export type ReportsExpensesQueryParams = ReportsDateQueryParams & {
  categoryId?: string;
};

export type ReportsSalesByItemQueryParams = ReportsDateQueryParams & {
  locationId?: string;
};

export type ReportsPurchasesByItemQueryParams = ReportsDateQueryParams & {
  locationId?: string;
  supplierId?: string;
};

export type ReportsCustomerActivityQueryParams = ReportsDateQueryParams & {
  customerId?: string;
};

export type ReportsSupplierActivityQueryParams = ReportsDateQueryParams & {
  supplierId?: string;
};

export type ReportsCommissionsQueryParams = ReportsDateQueryParams & {
  soldByUserId?: string;
};

export function buildListPath(
  endpoint: string,
  options?: {
    params?: ListQueryParams;
    page?: number;
    limit?: number;
  }
): string {
  const [base, existingQuery = ""] = endpoint.split("?");
  const q = new URLSearchParams(existingQuery);

  if (options?.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined || value === null || value === "") {
        q.delete(key);
      } else if (typeof value === "boolean") {
        q.set(key, value ? "true" : "false");
      } else {
        q.set(key, String(value));
      }
    }
  }

  if (options?.page !== undefined) {
    q.set("page", String(options.page));
  }
  if (options?.limit !== undefined) {
    q.set("limit", String(Math.min(options.limit, MAX_LIMIT)));
  }

  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildInventoryListPath(
  params?: InventoryListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/inventory", { params, page, limit });
}

export function buildLowStockListPath(
  params?: InventoryListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/inventory/low-stock", { params, page, limit });
}

export function buildInventoryAdjustmentsListPath(
  params?: InventoryAdjustmentsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/inventory/adjustments", { params, page, limit });
}

export function buildCustomersListPath(
  params?: CustomerSupplierListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/customers", { params, page, limit });
}

export function buildSuppliersListPath(
  params?: CustomerSupplierListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/suppliers", { params, page, limit });
}

export function buildPurchasesListPath(
  params?: PurchasesListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/purchases", { params, page, limit });
}

export function buildSalesListPath(
  params?: SalesListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/sales", { params, page, limit });
}

export function buildExpensesListPath(
  params?: ExpensesListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/expenses", { params, page, limit });
}

export function buildCreditsCustomersListPath(
  params?: CreditsCustomersListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/credits/customers", { params, page, limit });
}

export function buildCreditsSuppliersListPath(
  params?: CreditsSuppliersListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/credits/suppliers", { params, page, limit });
}

export function buildStockTransfersListPath(
  params?: StockTransfersListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/stock-transfers", { params, page, limit });
}

export type LotsListQueryParams = GenericListQueryParams & {
  locationId?: string;
  form?: CoffeeForm;
  status?: LotStatus;
  cropYear?: string;
  grade?: string;
};

export function buildLotsListPath(
  params?: LotsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/lots", { params, page, limit });
}

export type CollectionsListQueryParams = GenericListQueryParams & {
  locationId?: string;
  supplierId?: string;
  paymentMethod?: PaymentMethod;
  grade?: string;
  status?: string;
};

export function buildCollectionsListPath(
  params?: CollectionsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/collections", { params, page, limit });
}

export type ExportsListQueryParams = GenericListQueryParams & {
  status?: string;
};

export function buildExportsListPath(
  params?: ExportsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/exports", { params, page, limit });
}

export function buildRoastProfilesListPath(
  params?: GenericListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/roast-profiles", { params, page, limit });
}

export type ProcessRunsListQueryParams = GenericListQueryParams & {
  locationId?: string;
  templateId?: string;
  status?: string;
};

export function buildProcessRunsListPath(
  params?: ProcessRunsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/process-runs", { params, page, limit });
}

export function buildBomsListPath(
  params?: BomsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/boms", { params, page, limit });
}

export function buildProductionOrdersListPath(
  params?: ProductionOrdersListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/production-orders", { params, page, limit });
}

export function buildCommissionsSummaryPath(
  params?: {
    from?: string;
    to?: string;
    soldByUserId?: string;
  },
  page?: number,
  limit?: number
): string {
  return buildListPath("/sales/commissions/summary", { params, page, limit });
}

export function buildBanksAccountsListPath(
  params?: BanksAccountsListQueryParams
): string {
  return buildListPath("/banks/accounts", { params });
}

export function buildBanksTransactionsListPath(
  params?: BanksTransactionsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/banks/transactions", { params, page, limit });
}

export function buildLocationsListPath(
  params?: LocationsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/locations", { params, page, limit });
}

export function buildUsersListPath(
  params?: UsersListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/users", { params, page, limit });
}

export function buildRolesListPath(
  params?: RolesListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/roles", { params, page, limit });
}

export function buildPermissionsListPath(
  params?: PermissionsListQueryParams
): string {
  return buildListPath("/permissions", { params });
}

export function buildNotificationsListPath(
  params?: NotificationsListQueryParams,
  page?: number,
  limit?: number
): string {
  return buildListPath("/notifications", { params, page, limit });
}

export function buildReportsSummaryPath(params?: ReportsDateQueryParams): string {
  return buildListPath("/reports/summary", { params });
}

export function buildReportsSalesPath(params?: ReportsSalesQueryParams): string {
  return buildListPath("/reports/sales", { params });
}

export function buildReportsPurchasesPath(
  params?: ReportsPurchasesQueryParams
): string {
  return buildListPath("/reports/purchases", { params });
}

export function buildReportsExpensesPath(
  params?: ReportsExpensesQueryParams
): string {
  return buildListPath("/reports/expenses", { params });
}

export function buildReportsSalesByItemPath(
  params?: ReportsSalesByItemQueryParams
): string {
  return buildListPath("/reports/sales-by-item", { params });
}

export function buildReportsPurchasesByItemPath(
  params?: ReportsPurchasesByItemQueryParams
): string {
  return buildListPath("/reports/purchases-by-item", { params });
}

export function buildReportsInventoryAgingPath(): string {
  return "/reports/inventory-aging";
}

export function buildReportsCustomerActivityPath(
  params?: ReportsCustomerActivityQueryParams
): string {
  return buildListPath("/reports/customer-activity", { params });
}

export function buildReportsSupplierActivityPath(
  params?: ReportsSupplierActivityQueryParams
): string {
  return buildListPath("/reports/supplier-activity", { params });
}

export function buildReportsCommissionsPath(
  params?: ReportsCommissionsQueryParams
): string {
  return buildListPath("/reports/commissions", { params });
}

export function buildReportsCreditsPath(): string {
  return "/reports/credits";
}

export function buildReportsCashFlowPath(params?: ReportsDateQueryParams): string {
  return buildListPath("/reports/cash-flow", { params });
}

/** @deprecated Prefer `buildListPath` with `page` and `limit` options */
export function appendPagination(
  path: string,
  page: number,
  limit: number
): string {
  return buildListPath(path, { page, limit });
}
