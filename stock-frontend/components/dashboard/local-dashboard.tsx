"use client";

import Link from "next/link";
import {
  FactoryIcon,
  PackageIcon,
  ScaleIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GroupedBarChart,
  InsightsGrid,
  KpiTile,
  MiniBarChart,
} from "@/components/dashboard/dashboard-shared";
import { formatMoney, formatQty } from "@/lib/format";
import type { LocalDashboardData, SalesStorePack } from "@/lib/types";

const STEPS = [
  { key: "purchase", label: "Purchase" },
  { key: "inventory", label: "Inventory" },
  { key: "cleaning", label: "Cleaning" },
  { key: "roast", label: "Roast & Ground" },
  { key: "store", label: "Sales store" },
  { key: "sales", label: "Sales" },
] as const;

export function LocalDashboard({ data }: { data: LocalDashboardData }) {
  const pipe = data.pipeline;
  const activity = data.activity;
  const finance = data.finance;
  const insights = data.executiveInsights ?? [];

  return (
    <div className="flex flex-col gap-6">
      <InsightsGrid
        insights={insights}
        insightsHref="/process-runs"
        emptyHint="Local market is quiet for this period. Purchases, process runs, and local sales will show up here."
      />

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ScaleIcon className="size-4 text-[var(--csolve-moss)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--frappe-text-muted)]">
            Local market flow
          </h2>
        </div>
        <p className="mb-3 text-sm text-[var(--frappe-text-muted)]">
          {flowNote(pipe)}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((step, index) => (
            <FlowStep
              key={step.key}
              index={index + 1}
              title={step.label}
              step={step.key}
              pipe={pipe}
            />
          ))}
        </div>
      </section>

      <SalesStoreAnalysis store={data.salesStore} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageIcon className="size-4" />
              Where local coffee is now
            </CardTitle>
            <CardDescription>
              Kilograms on hand, plus coffee sitting in an open local process
              run. Reject from cleaning is kept separate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiTile
                label="Available to process"
                value={`${formatQty(pipe.inventoryKg)} kg`}
                href="/inventory"
              />
              <KpiTile
                label="Processing started"
                value={`${formatQty(pipe.processingStartedKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="In cleaning"
                value={`${formatQty(pipe.cleaningKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="Roast & ground"
                value={`${formatQty(pipe.roastGroundKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="Sales store"
                value={`${formatQty(pipe.salesStoreKg)} kg`}
                href="/inventory"
              />
              <KpiTile
                label="Reject held"
                value={`${formatQty(pipe.rejectKg)} kg`}
                href="/inventory"
              />
            </div>
            <MiniBarChart data={data.onHandChart} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCartIcon className="size-4" />
              Purchases and sales
            </CardTitle>
            <CardDescription>
              Local-market purchases against local-channel sales for this period
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiTile
                label="Purchases"
                value={formatMoney(pipe.purchaseValue)}
                href="/purchases?purchaseType=LOCAL"
              />
              <KpiTile
                label="Purchased kg"
                value={`${formatQty(pipe.purchaseKg)} kg`}
                href="/purchases?purchaseType=LOCAL"
              />
              <KpiTile
                label="Local sales"
                value={formatMoney(pipe.salesValue)}
                href="/sales?channel=LOCAL"
              />
              <KpiTile
                label="Sold kg"
                value={`${formatQty(pipe.salesKg)} kg`}
                href="/sales?channel=LOCAL"
              />
              <KpiTile
                label="Sale documents"
                value={String(pipe.salesCount)}
                href="/sales?channel=LOCAL"
              />
              <KpiTile
                label="Purchase documents"
                value={String(pipe.purchaseCount)}
                href="/purchases?purchaseType=LOCAL"
              />
            </div>
            <MiniBarChart data={data.tradingChart} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FactoryIcon className="size-4" />
              Cleaning and roast
            </CardTitle>
            <CardDescription>
              Completed local-market stages in this period. Normal cleaning
              yield is 80% or more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KpiTile
                label="Cleaned input"
                value={`${formatQty(activity.cleaningInputKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="Cleaned output"
                value={`${formatQty(activity.cleaningOutputKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="Yield"
                value={`${activity.yieldPercent}%`}
                href="/process-runs"
              />
              <KpiTile
                label="Removed"
                value={`${formatQty(activity.cleaningLossKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="High loss"
                value={String(activity.highLossRuns)}
                href="/process-runs"
              />
              <KpiTile
                label="Under screen"
                value={String(activity.underScreenRuns)}
                href="/process-runs"
              />
              <KpiTile
                label="Roast allocated"
                value={`${formatQty(activity.roastKg)} kg`}
                href="/process-runs"
              />
              <KpiTile
                label="Ground allocated"
                value={`${formatQty(activity.groundKg)} kg`}
                href="/process-runs"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletIcon className="size-4" />
              Local commercial
            </CardTitle>
            <CardDescription>
              Margin and open credit from local sales and local purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <KpiTile
                label="Revenue"
                value={formatMoney(finance.revenue)}
                href="/sales?channel=LOCAL"
              />
              <KpiTile
                label="Cost of goods"
                value={formatMoney(finance.costOfGoodsSold)}
                href="/reports?tab=profit-loss"
              />
              <KpiTile
                label="Gross profit"
                value={formatMoney(finance.grossProfit)}
                href="/reports?tab=profit-loss"
              />
              <KpiTile
                label="Customer credit"
                value={formatMoney(finance.customerCredit)}
                href="/credits"
              />
              <KpiTile
                label="Supplier credit"
                value={formatMoney(finance.supplierCredit)}
                href="/credits"
              />
              <KpiTile
                label="Sales store value"
                value={formatMoney(pipe.salesStoreValue)}
                href="/inventory"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUpIcon className="size-4" />
            Local coffee by location
          </CardTitle>
          <CardDescription>
            Stock value of local-market coffee only, including the sales store
            and reject held from cleaning
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Kg</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.stockByLocation.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No local-market coffee on hand.
                </TableCell>
              </TableRow>
            ) : (
              data.stockByLocation.map((row) => (
                <TableRow key={row.locationId}>
                  <TableCell>
                    <Link
                      href="/inventory"
                      className="hover:text-[var(--frappe-primary)] hover:underline"
                    >
                      {row.locationName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQty(row.kg)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.value)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function FlowStep({
  index,
  title,
  step,
  pipe,
}: {
  index: number;
  title: string;
  step: (typeof STEPS)[number]["key"];
  pipe: LocalDashboardData["pipeline"];
}) {
  const card = flowCard(step, pipe);
  return (
    <Link
      href={card.href}
      className="flex min-h-32 flex-col justify-between rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] p-5 transition hover:border-[var(--frappe-primary)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--frappe-text)]">{title}</p>
        <span className="rounded-full bg-[var(--csolve-moss-soft)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--csolve-moss)]">
          {index}
        </span>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--frappe-text)]">
          {card.value}
        </p>
        <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">{card.caption}</p>
        {card.detail ? (
          <p className="text-sm font-medium tabular-nums text-[var(--frappe-text)]">
            {card.detail}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function SalesStoreAnalysis({
  store,
}: {
  store: LocalDashboardData["salesStore"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageIcon className="size-4" />
          Sales store · Roast and ground
        </CardTitle>
        <CardDescription>
          1 kg and 0.5 kg packs on hand now. The total also includes bulk roast
          and ground still in the sales store. Sales follow the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <PackGroup
            title="Roast coffee"
            oneKg={store.roast.kg1}
            halfKg={store.roast.kg500}
          />
          <PackGroup
            title="Ground coffee"
            oneKg={store.ground.kg1}
            halfKg={store.ground.kg500}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiTile
            label="Available in sales store"
            value={`${formatQty(store.availableKg)} kg`}
            href="/inventory"
          />
          <KpiTile
            label="Sales store value"
            value={formatMoney(store.availableValue)}
            href="/inventory"
          />
          <KpiTile
            label="Sold this period"
            value={`${formatQty(store.soldKg)} kg`}
            href="/sales?channel=LOCAL"
          />
          <KpiTile
            label="Sold amount"
            value={formatMoney(store.soldValue)}
            href="/sales?channel=LOCAL"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Roast sold {formatQty(store.soldRoastKg)} kg ·{" "}
            {formatMoney(store.soldRoastValue)}
          </p>
          <p className="text-sm text-[var(--frappe-text-muted)]">
            Ground sold {formatQty(store.soldGroundKg)} kg ·{" "}
            {formatMoney(store.soldGroundValue)}
          </p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--frappe-text)]">
            Roast and ground sales
          </p>
          <GroupedBarChart
            data={store.trend}
            series={[
              { key: "roastKg", name: "Roast kg", color: "#8b5e3c" },
              { key: "groundKg", name: "Ground kg", color: "#2f6f4e" },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PackGroup({
  title,
  oneKg,
  halfKg,
}: {
  title: string;
  oneKg: SalesStorePack;
  halfKg: SalesStorePack;
}) {
  return (
    <div className="rounded-xl border border-[var(--frappe-border)] p-4">
      <p className="text-sm font-semibold text-[var(--frappe-text)]">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <PackSize label="1 kg" pack={oneKg} />
        <PackSize label="0.5 kg" pack={halfKg} />
      </div>
    </div>
  );
}

function PackSize({ label, pack }: { label: string; pack: SalesStorePack }) {
  return (
    <div>
      <p className="text-xs text-[var(--frappe-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--frappe-text)]">
        {formatQty(pack.packs)} packs
      </p>
      <p className="text-sm tabular-nums text-[var(--frappe-text-muted)]">
        {formatQty(pack.kg)} kg
      </p>
    </div>
  );
}

function flowNote(pipe: LocalDashboardData["pipeline"]) {
  const purchased = parseFloat(pipe.purchaseKg);
  const onHand = parseFloat(pipe.inventoryKg);
  if (!Number.isFinite(purchased) || !Number.isFinite(onHand)) {
    return "Purchase is coffee bought onto lots. Inventory is the part still waiting to be processed.";
  }
  const moved = Math.round((purchased - onHand) * 1000) / 1000;
  if (moved >= 0) {
    return `${formatQty(pipe.inventoryKg)} kg of the ${formatQty(pipe.purchaseKg)} kg purchased is still unprocessed. ${formatQty(String(moved))} kg has moved on to cleaning, the sales store, reject, or sales.`;
  }
  return "Inventory is the unprocessed coffee on hand now, including coffee bought outside this period. Purchase shows only coffee bought in the selected period.";
}

function flowCard(
  step: (typeof STEPS)[number]["key"],
  pipe: LocalDashboardData["pipeline"]
) {
  if (step === "purchase") {
    return {
      href: "/purchases?purchaseType=LOCAL",
      value: `${formatQty(pipe.purchaseKg)} kg`,
      caption: "Coffee bought this period",
      detail: formatMoney(pipe.purchaseValue),
    };
  }
  if (step === "inventory") {
    return {
      href: "/inventory",
      value: `${formatQty(pipe.inventoryKg)} kg`,
      caption: "Still unprocessed",
      detail: formatMoney(pipe.inventoryValue),
    };
  }
  if (step === "cleaning") {
    return {
      href: "/process-runs",
      value: `${formatQty(pipe.cleaningKg)} kg`,
      caption: "In cleaning",
      detail: `${formatQty(pipe.processingStartedKg)} kg started`,
    };
  }
  if (step === "roast") {
    return {
      href: "/process-runs",
      value: `${formatQty(pipe.roastGroundKg)} kg`,
      caption: "In roast and ground",
      detail: null,
    };
  }
  if (step === "store") {
    return {
      href: "/inventory",
      value: `${formatQty(pipe.salesStoreKg)} kg`,
      caption: "Ready to sell",
      detail: formatMoney(pipe.salesStoreValue),
    };
  }
  return {
    href: "/sales?channel=LOCAL",
    value: `${formatQty(pipe.salesKg)} kg`,
    caption: "This period",
    detail: formatMoney(pipe.salesValue),
  };
}
