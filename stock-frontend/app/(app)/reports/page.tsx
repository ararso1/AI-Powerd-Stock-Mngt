"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PermissionGate } from "@/components/permission-gate";
import { PageLoading } from "@/components/shared/page-loading";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ReportEntityFilter } from "@/components/reports/report-entity-filter";
import { ReportPaginatedTable } from "@/components/reports/report-paginated-table";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { apiList, unwrapList } from "@/lib/list-response";
import { applyCurrencyFromResponse } from "@/lib/currency";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import {
  buildReportsCashFlowPath,
  buildReportsCommissionsPath,
  buildReportsCreditsPath,
  buildReportsCustomerActivityPath,
  buildReportsExpensesPath,
  buildReportsInventoryAgingPath,
  buildReportsPurchasesByItemPath,
  buildReportsPurchasesPath,
  buildReportsSalesByItemPath,
  buildReportsSalesPath,
  buildReportsSummaryPath,
  buildReportsSupplierActivityPath,
} from "@/lib/list-query";
import type {
  ExpenseCategory,
  PaginatedResponse,
  ReportCashFlow,
  ReportCashFlowRow,
  ReportCommissionRow,
  ReportCommissions,
  ReportCredits,
  ReportCustomerActivity,
  ReportCustomerActivityRow,
  ReportExpenses,
  ReportInventoryAging,
  ReportInventoryAgingRow,
  ReportPurchases,
  ReportPurchasesByItem,
  ReportPurchasesByItemRow,
  ReportSales,
  ReportSalesByItem,
  ReportSalesByItemRow,
  ReportsSummary,
  ReportSupplierActivity,
  ReportSupplierActivityRow,
  UserAdmin,
} from "@/lib/types";
import { locationFilterOptions } from "@/lib/report-list";
import { formatPartyLabel, fetchCustomers, fetchSuppliers } from "@/lib/party-fetch";
import { useFetch } from "@/hooks/use-fetch";
import { useLocations } from "@/hooks/use-locations";
import {
  reportCustomerCredits,
  reportSupplierCredits,
} from "@/lib/report-credits";
import {
  reportCommissionRows,
  reportTotalCommission,
} from "@/lib/report-commissions";
import {
  customerActivitySaleCount,
  customerActivitySpend,
  reportCustomerActivityRows,
  reportSupplierActivityRows,
  sumCustomerActivitySpend,
  sumSupplierActivityPurchased,
} from "@/lib/report-activity";
import {
  agingItemDescription,
  purchasesByItemTotal,
  reportInventoryAgingRows,
  reportInventoryAgingTotal,
  reportPurchasesByItemRows,
  reportSalesByItemRows,
  sumPurchasesByItemTotal,
  sumSalesByItemRevenue,
} from "@/lib/report-items";

function margin(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "—";
  return `${value}%`;
}

function periodParams(from: string, to: string) {
  return { from: from || undefined, to: to || undefined };
}

function SummaryCards({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="tabular-nums">{item.value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tabSearch, setTabSearch] = useState<Record<string, string>>({});
  const [salesReportLocationId, setSalesReportLocationId] = useState("");
  const [salesReportCustomerId, setSalesReportCustomerId] = useState("");
  const [salesReportSoldByUserId, setSalesReportSoldByUserId] = useState("");
  const [purchasesReportLocationId, setPurchasesReportLocationId] =
    useState("");
  const [purchasesReportSupplierId, setPurchasesReportSupplierId] =
    useState("");
  const [expensesCategoryId, setExpensesCategoryId] = useState("");
  const [salesByItemLocationId, setSalesByItemLocationId] = useState("");
  const [purchasesByItemLocationId, setPurchasesByItemLocationId] =
    useState("");
  const [purchasesByItemSupplierId, setPurchasesByItemSupplierId] =
    useState("");
  const [customerActivityCustomerId, setCustomerActivityCustomerId] =
    useState("");
  const [supplierActivitySupplierId, setSupplierActivitySupplierId] =
    useState("");
  const [commissionsSoldByUserId, setCommissionsSoldByUserId] = useState("");

  const filters = periodParams(from, to);
  const getTabSearch = (tab: string) => tabSearch[tab] ?? "";
  const setTabSearchValue = (tab: string, value: string) =>
    setTabSearch((prev) => ({ ...prev, [tab]: value }));

  const { data: locations } = useLocations();
  const { data: expenseCategories } = useFetch(
    () => apiList<ExpenseCategory>("/expenses/categories"),
    []
  );
  const { data: reportCustomers } = useFetch(() => fetchCustomers(), []);
  const { data: reportSuppliers } = useFetch(() => fetchSuppliers(), []);
  const { data: reportUsers } = useFetch(
    () => apiList<UserAdmin>("/users"),
    []
  );

  const locationOptions = locationFilterOptions(locations ?? []);
  const customerOptions = (reportCustomers ?? []).map((customer) => ({
    value: customer.id,
    label: formatPartyLabel(customer),
  }));
  const supplierOptions = (reportSuppliers ?? []).map((supplier) => ({
    value: supplier.id,
    label: formatPartyLabel(supplier),
  }));
  const userOptions = (reportUsers ?? [])
    .filter((user) => user.isActive !== false)
    .map((user) => ({
      value: user.id,
      label: user.fullName,
    }));
  const categoryOptions = (expenseCategories ?? []).map((category) => ({
    value: category.id,
    label: category.name,
  }));

  const { data: summary, loading: summaryLoading } = useFetch(
    () =>
      api<ReportsSummary>(buildReportsSummaryPath(filters)).then((res) => {
        applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to]
  );
  const { data: salesReport, loading: salesReportLoading } = useFetch(
    () =>
      api<ReportSales>(
        buildReportsSalesPath({
          ...filters,
          locationId: salesReportLocationId || undefined,
          customerId: salesReportCustomerId || undefined,
          soldByUserId: salesReportSoldByUserId || undefined,
        })
      ).then((res) => {
        applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, salesReportLocationId, salesReportCustomerId, salesReportSoldByUserId]
  );
  const { data: purchasesReport, loading: purchasesReportLoading } = useFetch(
    () =>
      api<ReportPurchases>(
        buildReportsPurchasesPath({
          ...filters,
          locationId: purchasesReportLocationId || undefined,
          supplierId: purchasesReportSupplierId || undefined,
        })
      ).then((res) => {
        applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, purchasesReportLocationId, purchasesReportSupplierId]
  );
  const { data: expensesReport, loading: expensesReportLoading } = useFetch(
    () =>
      api<ReportExpenses>(
        buildReportsExpensesPath({
          ...filters,
          categoryId: expensesCategoryId || undefined,
        })
      ).then((res) => {
        applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, expensesCategoryId]
  );
  const { data: salesByItemReport, loading: salesLoading } = useFetch(
    () =>
      api<ReportSalesByItem | ReportSalesByItemRow[]>(
        buildReportsSalesByItemPath({
          ...filters,
          locationId: salesByItemLocationId || undefined,
        })
      ).then((res) => {
        if (!Array.isArray(res)) applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, salesByItemLocationId]
  );
  const { data: purchasesByItemReport, loading: purchasesByItemLoading } =
    useFetch(
      () =>
        api<ReportPurchasesByItem | ReportPurchasesByItemRow[]>(
          buildReportsPurchasesByItemPath({
            ...filters,
            locationId: purchasesByItemLocationId || undefined,
            supplierId: purchasesByItemSupplierId || undefined,
          })
        ).then((res) => {
          if (!Array.isArray(res)) applyCurrencyFromResponse(res);
          return res;
        }),
      [from, to, purchasesByItemLocationId, purchasesByItemSupplierId]
    );
  const { data: inventoryAgingReport, loading: agingLoading } = useFetch(
    () =>
      api<ReportInventoryAging | ReportInventoryAgingRow[]>(
        buildReportsInventoryAgingPath()
      ).then((res) => {
        if (!Array.isArray(res)) applyCurrencyFromResponse(res);
        return res;
      }),
    []
  );
  const { data: customerActivityReport, loading: customerLoading } = useFetch(
    () =>
      api<ReportCustomerActivity | ReportCustomerActivityRow[]>(
        buildReportsCustomerActivityPath({
          ...filters,
          customerId: customerActivityCustomerId || undefined,
        })
      ).then((res) => {
        if (!Array.isArray(res)) applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, customerActivityCustomerId]
  );
  const { data: supplierActivityReport, loading: supplierLoading } = useFetch(
    () =>
      api<ReportSupplierActivity | ReportSupplierActivityRow[]>(
        buildReportsSupplierActivityPath({
          ...filters,
          supplierId: supplierActivitySupplierId || undefined,
        })
      ).then((res) => {
        if (!Array.isArray(res)) applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, supplierActivitySupplierId]
  );
  const { data: commissionsReport, loading: commissionsLoading } = useFetch(
    () =>
      api<ReportCommissions | ReportCommissionRow[]>(
        buildReportsCommissionsPath({
          ...filters,
          soldByUserId: commissionsSoldByUserId || undefined,
        })
      ).then((res) => {
        if (!Array.isArray(res)) applyCurrencyFromResponse(res);
        return res;
      }),
    [from, to, commissionsSoldByUserId]
  );
  const { data: credits, loading: creditsLoading } = useFetch(
    () =>
      api<ReportCredits>(buildReportsCreditsPath()).then((res) => {
        applyCurrencyFromResponse(res);
        return res;
      }),
    []
  );
  const { data: cashFlow, loading: cashFlowLoading } = useFetch(
    () =>
      api<ReportCashFlow | ReportCashFlowRow[]>(
        buildReportsCashFlowPath(filters)
      ),
    [from, to]
  );

  const salesRows = useMemo(
    () =>
      reportSalesByItemRows(salesByItemReport).map((r) => ({
        ...r,
        id: r.itemId,
      })),
    [salesByItemReport]
  );
  const purchasesByItemRows = useMemo(
    () =>
      reportPurchasesByItemRows(purchasesByItemReport).map((r) => ({
        ...r,
        id: r.itemId,
      })),
    [purchasesByItemReport]
  );
  const agingRows = useMemo(
    () =>
      reportInventoryAgingRows(inventoryAgingReport).map((r, index) => ({
        ...r,
        id: `${r.itemId}-${r.locationId ?? index}`,
      })),
    [inventoryAgingReport]
  );
  const customerRows = useMemo(
    () =>
      reportCustomerActivityRows(customerActivityReport).map((r) => ({
        ...r,
        id: r.customerId,
      })),
    [customerActivityReport]
  );
  const supplierRows = useMemo(
    () =>
      reportSupplierActivityRows(supplierActivityReport).map((r) => ({
        ...r,
        id: r.supplierId,
      })),
    [supplierActivityReport]
  );
  const commissionRows = useMemo(
    () =>
      reportCommissionRows(commissionsReport).map((r) => ({
        ...r,
        id: r.soldByUserId,
      })),
    [commissionsReport]
  );
  const customerCreditRows = useMemo(() => {
    if (!credits) return [];
    return (reportCustomerCredits(credits).byCustomer ?? []).map((r) => ({
      ...r,
      id: r.customerId,
    }));
  }, [credits]);
  const supplierCreditRows = useMemo(() => {
    if (!credits) return [];
    return (reportSupplierCredits(credits).bySupplier ?? []).map((r) => ({
      ...r,
      id: r.supplierId,
    }));
  }, [credits]);
  const cashFlowRows = useMemo(() => {
    if (!cashFlow) return [];
     const rows = Array.isArray(cashFlow)
      ? cashFlow
      : "dailyBalances" in cashFlow && Array.isArray(cashFlow.dailyBalances)
        ? cashFlow.dailyBalances
        : unwrapList(
            cashFlow as unknown as
              | ReportCashFlowRow[]
              | PaginatedResponse<ReportCashFlowRow>
          );
    return rows.map((r) => ({ ...r, id: r.date }));
  }, [cashFlow]);

  const salesPaymentRows = useMemo(
    () =>
      (salesReport?.byPaymentMethod ?? []).map((r, i) => ({
        ...r,
        id: `${r.paymentMethod}-${i}`,
      })),
    [salesReport]
  );
  const purchasesPaymentRows = useMemo(
    () =>
      (purchasesReport?.byPaymentMethod ?? []).map((r, i) => ({
        ...r,
        id: `${r.paymentMethod}-${i}`,
      })),
    [purchasesReport]
  );
  const expenseCategoryRows = useMemo(
    () =>
      (expensesReport?.byCategory ?? []).map((r) => ({
        ...r,
        id: r.categoryId,
      })),
    [expensesReport]
  );

  const purchasesTotal =
    summary?.totalPurchases ?? summary?.totalCost ?? "0";

  return (
    <AppShell
      title="Reports"
      subtitle="Financial, inventory, customer, supplier, and cash movement reports"
      breadcrumbs={[{ label: "Stock", href: "/dashboard" }, { label: "Reports" }]}
    >
      <PermissionGate permission="reports.read">
        <div className="mb-4">
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </div>

        <Tabs defaultValue="summary" className="gap-4">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="sales-by-item">Sales by item</TabsTrigger>
            <TabsTrigger value="purchases-by-item">Purchases by item</TabsTrigger>
            <TabsTrigger value="inventory-aging">Inventory aging</TabsTrigger>
            <TabsTrigger value="customer-activity">Customers</TabsTrigger>
            <TabsTrigger value="supplier-activity">Suppliers</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash flow</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-2">
            {summaryLoading ? (
              <PageLoading />
            ) : summary ? (
              <SummaryCards
                items={[
                  ["Revenue", formatMoney(summary.totalRevenue)],
                  ["Purchases", formatMoney(purchasesTotal)],
                  ["Expenses", formatMoney(summary.totalExpenses)],
                  ["Gross profit", formatMoney(summary.grossProfit)],
                  ["Net profit", formatMoney(summary.netProfit)],
                  ["Margin", margin(summary.marginPercent)],
                ].map(([label, value]) => ({ label: label as string, value }))}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="sales" className="mt-2">
            {salesReportLoading ? (
              <PageLoading />
            ) : salesReport ? (
              <>
                <SummaryCards
                  items={[
                    { label: "Sales count", value: salesReport.totals.count },
                    {
                      label: "Subtotal",
                      value: formatMoney(salesReport.totals.subtotal),
                    },
                    {
                      label: "Total",
                      value: formatMoney(salesReport.totals.total),
                    },
                    {
                      label: "Commission",
                      value: formatMoney(salesReport.totals.commission),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={salesPaymentRows}
                  emptyTitle="No payment breakdown"
                  search={getTabSearch("sales")}
                  onSearchChange={(value) => setTabSearchValue("sales", value)}
                  searchPlaceholder="Search payment method…"
                  searchKeys={["paymentMethod"]}
                  disabled={salesReportLoading}
                  filters={
                    <>
                      <ReportEntityFilter
                        label="Location"
                        value={salesReportLocationId}
                        onValueChange={setSalesReportLocationId}
                        options={locationOptions}
                        placeholder="All locations"
                      />
                      <ReportEntityFilter
                        label="Customer"
                        value={salesReportCustomerId}
                        onValueChange={setSalesReportCustomerId}
                        options={customerOptions}
                        placeholder="All customers"
                        searchPlaceholder="Search customer…"
                      />
                      <ReportEntityFilter
                        label="Sales rep"
                        value={salesReportSoldByUserId}
                        onValueChange={setSalesReportSoldByUserId}
                        options={userOptions}
                        placeholder="All reps"
                        searchPlaceholder="Search rep…"
                      />
                    </>
                  }
                  columns={[
                    {
                      key: "method",
                      header: "Payment",
                      cell: (r) => r.paymentMethod,
                    },
                    {
                      key: "count",
                      header: "Count",
                      className: "text-right",
                      cell: (r) => r.count,
                    },
                    {
                      key: "total",
                      header: "Total",
                      className: "text-right",
                      cell: (r) => formatMoney(r.total),
                    },
                  ]}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="purchases" className="mt-2">
            {purchasesReportLoading ? (
              <PageLoading />
            ) : purchasesReport ? (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Purchase count",
                      value: purchasesReport.totals.count,
                    },
                    {
                      label: "Total",
                      value: formatMoney(purchasesReport.totals.total),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={purchasesPaymentRows}
                  emptyTitle="No payment breakdown"
                  search={getTabSearch("purchases")}
                  onSearchChange={(value) =>
                    setTabSearchValue("purchases", value)
                  }
                  searchPlaceholder="Search payment method…"
                  searchKeys={["paymentMethod"]}
                  disabled={purchasesReportLoading}
                  filters={
                    <>
                      <ReportEntityFilter
                        label="Location"
                        value={purchasesReportLocationId}
                        onValueChange={setPurchasesReportLocationId}
                        options={locationOptions}
                        placeholder="All locations"
                      />
                      <ReportEntityFilter
                        label="Supplier"
                        value={purchasesReportSupplierId}
                        onValueChange={setPurchasesReportSupplierId}
                        options={supplierOptions}
                        placeholder="All suppliers"
                        searchPlaceholder="Search supplier…"
                      />
                    </>
                  }
                  columns={[
                    {
                      key: "method",
                      header: "Payment",
                      cell: (r) => r.paymentMethod,
                    },
                    {
                      key: "count",
                      header: "Count",
                      className: "text-right",
                      cell: (r) => r.count,
                    },
                    {
                      key: "total",
                      header: "Total",
                      className: "text-right",
                      cell: (r) => formatMoney(r.total),
                    },
                  ]}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="expenses" className="mt-2">
            {expensesReportLoading ? (
              <PageLoading />
            ) : expensesReport ? (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Expense count",
                      value: expensesReport.totals.count,
                    },
                    {
                      label: "Total",
                      value: formatMoney(expensesReport.totals.total),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={expenseCategoryRows}
                  emptyTitle="No category breakdown"
                  search={getTabSearch("expenses")}
                  onSearchChange={(value) =>
                    setTabSearchValue("expenses", value)
                  }
                  searchPlaceholder="Search category…"
                  searchKeys={["categoryName"]}
                  disabled={expensesReportLoading}
                  filters={
                    <ReportEntityFilter
                      label="Category"
                      value={expensesCategoryId}
                      onValueChange={setExpensesCategoryId}
                      options={categoryOptions}
                      placeholder="All categories"
                    />
                  }
                  columns={[
                    {
                      key: "category",
                      header: "Category",
                      cell: (r) => r.categoryName,
                    },
                    {
                      key: "count",
                      header: "Count",
                      className: "text-right",
                      cell: (r) => r.count,
                    },
                    {
                      key: "total",
                      header: "Total",
                      className: "text-right",
                      cell: (r) => formatMoney(r.total),
                    },
                  ]}
                />
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="sales-by-item" className="mt-2">
            {salesLoading ? (
              <PageLoading />
            ) : (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Items sold",
                      value: salesRows.length,
                    },
                    {
                      label: "Total revenue",
                      value: formatMoney(
                        sumSalesByItemRevenue(salesByItemReport)
                      ),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={salesRows}
                  emptyTitle="No item sales"
                  search={getTabSearch("sales-by-item")}
                  onSearchChange={(value) =>
                    setTabSearchValue("sales-by-item", value)
                  }
                  searchPlaceholder="Search item or SKU…"
                  searchKeys={[
                    "description",
                    "itemDescription",
                    "sku",
                  ]}
                  disabled={salesLoading}
                  filters={
                    <ReportEntityFilter
                      label="Location"
                      value={salesByItemLocationId}
                      onValueChange={setSalesByItemLocationId}
                      options={locationOptions}
                      placeholder="All locations"
                    />
                  }
                  columns={[
                    {
                      key: "item",
                      header: "Item",
                      cell: (r) => r.description ?? r.itemDescription ?? "—",
                    },
                    { key: "sku", header: "SKU", cell: (r) => r.sku ?? "—" },
                    {
                      key: "qty",
                      header: "Qty sold",
                      className: "text-right",
                      cell: (r) => formatQty(r.quantitySold),
                    },
                    {
                      key: "revenue",
                      header: "Revenue",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(r.revenue),
                    },
                    {
                      key: "cost",
                      header: "Cost",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(r.cost),
                    },
                    {
                      key: "profit",
                      header: "Profit",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(r.profit),
                    },
                    {
                      key: "margin",
                      header: "Margin",
                      className: "text-right",
                      cell: (r) => margin(r.marginPercent),
                    },
                  ]}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="purchases-by-item" className="mt-2">
            {purchasesByItemLoading ? (
              <PageLoading />
            ) : (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Items purchased",
                      value: purchasesByItemRows.length,
                    },
                    {
                      label: "Total spend",
                      value: formatMoney(
                        sumPurchasesByItemTotal(purchasesByItemReport)
                      ),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={purchasesByItemRows}
                  emptyTitle="No item purchases"
                  search={getTabSearch("purchases-by-item")}
                  onSearchChange={(value) =>
                    setTabSearchValue("purchases-by-item", value)
                  }
                  searchPlaceholder="Search item or SKU…"
                  searchKeys={["description", "sku"]}
                  disabled={purchasesByItemLoading}
                  filters={
                    <>
                      <ReportEntityFilter
                        label="Location"
                        value={purchasesByItemLocationId}
                        onValueChange={setPurchasesByItemLocationId}
                        options={locationOptions}
                        placeholder="All locations"
                      />
                      <ReportEntityFilter
                        label="Supplier"
                        value={purchasesByItemSupplierId}
                        onValueChange={setPurchasesByItemSupplierId}
                        options={supplierOptions}
                        placeholder="All suppliers"
                        searchPlaceholder="Search supplier…"
                      />
                    </>
                  }
                  columns={[
                    { key: "item", header: "Item", cell: (r) => r.description },
                    { key: "sku", header: "SKU", cell: (r) => r.sku ?? "—" },
                    {
                      key: "qty",
                      header: "Qty",
                      className: "text-right",
                      cell: (r) => formatQty(r.quantityPurchased),
                    },
                    {
                      key: "spend",
                      header: "Total spend",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(purchasesByItemTotal(r)),
                    },
                  ]}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="inventory-aging" className="mt-2">
            {agingLoading ? (
              <PageLoading />
            ) : (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Stock lines",
                      value: agingRows.length,
                    },
                    {
                      label: "Total inventory value",
                      value: formatMoney(
                        reportInventoryAgingTotal(inventoryAgingReport)
                      ),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={agingRows}
                  emptyTitle="No aging data"
                  search={getTabSearch("inventory-aging")}
                  onSearchChange={(value) =>
                    setTabSearchValue("inventory-aging", value)
                  }
                  searchPlaceholder="Search item, SKU, or location…"
                  searchKeys={[
                    (r) => agingItemDescription(r),
                    "sku",
                    "locationName",
                    "lotCode",
                    "cropYear",
                    "grade",
                  ]}
                  disabled={agingLoading}
                  columns={[
                    {
                      key: "item",
                      header: "Item",
                      cell: (r) => agingItemDescription(r),
                    },
                    {
                      key: "lot",
                      header: "Lot",
                      cell: (r) => r.lotCode ?? "—",
                    },
                    {
                      key: "cropYear",
                      header: "Crop year",
                      cell: (r) => r.cropYear ?? "—",
                    },
                    {
                      key: "grade",
                      header: "Grade",
                      cell: (r) => r.grade ?? "—",
                    },
                    { key: "sku", header: "SKU", cell: (r) => r.sku ?? "—" },
                    {
                      key: "location",
                      header: "Location",
                      cell: (r) => r.locationName ?? "—",
                    },
                    {
                      key: "qty",
                      header: "Quantity",
                      className: "text-right",
                      cell: (r) => formatQty(r.quantity),
                    },
                    {
                      key: "value",
                      header: "Value",
                      className: "text-right tabular-nums",
                      cell: (r) =>
                        formatMoney(r.inventoryValue ?? r.value ?? "0"),
                    },
                    {
                      key: "lastPurchase",
                      header: "Last update",
                      cell: (r) =>
                        formatDate(r.lastUpdated ?? r.lastPurchaseDate),
                    },
                    {
                      key: "age",
                      header: "Days in warehouse",
                      className: "text-right",
                      cell: (r) => r.ageDays ?? "—",
                    },
                  ]}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="customer-activity" className="mt-2">
            {customerLoading ? (
              <PageLoading />
            ) : (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Customers",
                      value: customerRows.length,
                    },
                    {
                      label: "Total spent",
                      value: formatMoney(
                        sumCustomerActivitySpend(customerActivityReport)
                      ),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={customerRows}
                  emptyTitle="No customer activity"
                  search={getTabSearch("customer-activity")}
                  onSearchChange={(value) =>
                    setTabSearchValue("customer-activity", value)
                  }
                  searchPlaceholder="Search customer or phone…"
                  searchKeys={["customerName", "name", "phone"]}
                  disabled={customerLoading}
                  filters={
                    <ReportEntityFilter
                      label="Customer"
                      value={customerActivityCustomerId}
                      onValueChange={setCustomerActivityCustomerId}
                      options={customerOptions}
                      placeholder="All customers"
                      searchPlaceholder="Search customer…"
                    />
                  }
                  columns={[
                    {
                      key: "customer",
                      header: "Customer",
                      cell: (r) => r.customerName ?? r.name ?? "—",
                    },
                    {
                      key: "phone",
                      header: "Phone",
                      cell: (r) => r.phone ?? "—",
                    },
                    {
                      key: "count",
                      header: "Sales",
                      className: "text-right",
                      cell: (r) => customerActivitySaleCount(r),
                    },
                    {
                      key: "spend",
                      header: "Total spent",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(customerActivitySpend(r)),
                    },
                    ...(customerRows.some((r) => r.outstandingAmount)
                      ? [
                          {
                            key: "outstanding",
                            header: "Outstanding",
                            className: "text-right tabular-nums",
                            cell: (r: (typeof customerRows)[number]) =>
                              formatMoney(r.outstandingAmount ?? "0"),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="supplier-activity" className="mt-2">
            {supplierLoading ? (
              <PageLoading />
            ) : (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Suppliers",
                      value: supplierRows.length,
                    },
                    {
                      label: "Total purchased",
                      value: formatMoney(
                        sumSupplierActivityPurchased(supplierActivityReport)
                      ),
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={supplierRows}
                  emptyTitle="No supplier activity"
                  search={getTabSearch("supplier-activity")}
                  onSearchChange={(value) =>
                    setTabSearchValue("supplier-activity", value)
                  }
                  searchPlaceholder="Search supplier or phone…"
                  searchKeys={["supplierName", "name", "phone"]}
                  disabled={supplierLoading}
                  filters={
                    <ReportEntityFilter
                      label="Supplier"
                      value={supplierActivitySupplierId}
                      onValueChange={setSupplierActivitySupplierId}
                      options={supplierOptions}
                      placeholder="All suppliers"
                      searchPlaceholder="Search supplier…"
                    />
                  }
                  columns={[
                    {
                      key: "supplier",
                      header: "Supplier",
                      cell: (r) => r.supplierName ?? r.name ?? "—",
                    },
                    {
                      key: "phone",
                      header: "Phone",
                      cell: (r) => r.phone ?? "—",
                    },
                    {
                      key: "count",
                      header: "Purchases",
                      className: "text-right",
                      cell: (r) => r.purchaseCount,
                    },
                    {
                      key: "purchased",
                      header: "Total purchased",
                      className: "text-right tabular-nums",
                      cell: (r) => formatMoney(r.totalPurchased),
                    },
                    ...(supplierRows.some((r) => r.outstandingAmount)
                      ? [
                          {
                            key: "outstanding",
                            header: "Outstanding",
                            className: "text-right tabular-nums",
                            cell: (r: (typeof supplierRows)[number]) =>
                              formatMoney(r.outstandingAmount ?? "0"),
                          },
                        ]
                      : []),
                  ]}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="commissions" className="mt-2">
            {commissionsLoading ? (
              <PageLoading />
            ) : (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Total commission",
                      value: formatMoney(
                        reportTotalCommission(commissionsReport)
                      ),
                    },
                    {
                      label: "Sales reps",
                      value: commissionRows.length,
                    },
                  ]}
                />
                <ReportPaginatedTable
                  rows={commissionRows}
                  emptyTitle="No commission data"
                  search={getTabSearch("commissions")}
                  onSearchChange={(value) =>
                    setTabSearchValue("commissions", value)
                  }
                  searchPlaceholder="Search sales rep…"
                  searchKeys={["soldByUserName"]}
                  disabled={commissionsLoading}
                  filters={
                    <ReportEntityFilter
                      label="Sales rep"
                      value={commissionsSoldByUserId}
                      onValueChange={setCommissionsSoldByUserId}
                      options={userOptions}
                      placeholder="All reps"
                      searchPlaceholder="Search rep…"
                    />
                  }
                  columns={[
                    {
                      key: "rep",
                      header: "Sales rep",
                      cell: (r) => r.soldByUserName,
                    },
                    {
                      key: "count",
                      header: "Sales",
                      className: "text-right",
                      cell: (r) => r.saleCount,
                    },
                    {
                      key: "subtotal",
                      header: "Subtotal",
                      className: "text-right",
                      cell: (r) => formatMoney(r.totalSubtotal ?? "0"),
                    },
                    {
                      key: "commission",
                      header: "Commission",
                      className: "text-right",
                      cell: (r) => formatMoney(r.totalCommission),
                    },
                  ]}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="credits" className="mt-2">
            {creditsLoading ? (
              <PageLoading />
            ) : credits ? (
              <>
                <SummaryCards
                  items={[
                    {
                      label: "Customer receivables",
                      value: formatMoney(
                        reportCustomerCredits(credits).totalOutstanding
                      ),
                    },
                    {
                      label: "Customer credit count",
                      value: reportCustomerCredits(credits).creditCount,
                    },
                    {
                      label: "Supplier payables",
                      value: formatMoney(
                        reportSupplierCredits(credits).totalOutstanding
                      ),
                    },
                    {
                      label: "Supplier credit count",
                      value: reportSupplierCredits(credits).creditCount,
                    },
                  ]}
                />
                <div className="grid gap-6 lg:grid-cols-2">
                  <ReportPaginatedTable
                    rows={customerCreditRows}
                    emptyTitle="No customer receivables"
                    search={getTabSearch("credits-customers")}
                    onSearchChange={(value) =>
                      setTabSearchValue("credits-customers", value)
                    }
                    searchPlaceholder="Search customer…"
                    searchKeys={["customerName"]}
                    disabled={creditsLoading}
                    columns={[
                      {
                        key: "customer",
                        header: "Customer",
                        cell: (r) => r.customerName,
                      },
                      {
                        key: "count",
                        header: "Credits",
                        className: "text-right",
                        cell: (r) => r.creditCount,
                      },
                      {
                        key: "outstanding",
                        header: "Outstanding",
                        className: "text-right tabular-nums",
                        cell: (r) => formatMoney(r.outstanding),
                      },
                    ]}
                  />
                  <ReportPaginatedTable
                    rows={supplierCreditRows}
                    emptyTitle="No supplier payables"
                    search={getTabSearch("credits-suppliers")}
                    onSearchChange={(value) =>
                      setTabSearchValue("credits-suppliers", value)
                    }
                    searchPlaceholder="Search supplier…"
                    searchKeys={["supplierName"]}
                    disabled={creditsLoading}
                    columns={[
                      {
                        key: "supplier",
                        header: "Supplier",
                        cell: (r) => r.supplierName,
                      },
                      {
                        key: "count",
                        header: "Credits",
                        className: "text-right",
                        cell: (r) => r.creditCount,
                      },
                      {
                        key: "outstanding",
                        header: "Outstanding",
                        className: "text-right tabular-nums",
                        cell: (r) => formatMoney(r.outstanding),
                      },
                    ]}
                  />
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="cash-flow" className="mt-2">
            {cashFlowLoading ? (
              <PageLoading />
            ) : (
              <ReportPaginatedTable
                rows={cashFlowRows}
                emptyTitle="No cash flow"
                search={getTabSearch("cash-flow")}
                onSearchChange={(value) => setTabSearchValue("cash-flow", value)}
                searchPlaceholder="Search date…"
                searchKeys={["date"]}
                disabled={cashFlowLoading}
                columns={[
                  {
                    key: "date",
                    header: "Date",
                    cell: (r) => formatDate(r.date),
                  },
                  {
                    key: "in",
                    header: "Cash in",
                    className: "text-right",
                    cell: (r) => formatMoney(r.cashIn ?? r.inflow ?? "0"),
                  },
                  {
                    key: "out",
                    header: "Cash out",
                    className: "text-right",
                    cell: (r) => formatMoney(r.cashOut ?? r.outflow ?? "0"),
                  },
                  {
                    key: "net",
                    header: "Net movement",
                    className: "text-right",
                    cell: (r) => formatMoney(r.netMovement ?? r.net ?? "0"),
                  },
                ]}
              />
            )}
          </TabsContent>
        </Tabs>
      </PermissionGate>
    </AppShell>
  );
}
