"use client";

import {
  CarIcon,
  FactoryIcon,
  DropletsIcon,
  PackageIcon,
  WheatIcon,
  WrenchIcon,
} from "lucide-react";

const IMPORT_LINES = [
  {
    icon: WheatIcon,
    title: "Rice & grains",
    detail: "Inbound shipments, warehouse lots, and landed cost.",
  },
  {
    icon: DropletsIcon,
    title: "Edible oil",
    detail: "Container intake, storage tanks, and sales allocation.",
  },
  {
    icon: PackageIcon,
    title: "Metal & materials",
    detail: "Bulk import tracking from port to yard stock.",
  },
  {
    icon: CarIcon,
    title: "Vehicles",
    detail: "Unit-level import, clearing, and showroom readiness.",
  },
] as const;

export function OthersDashboard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.55]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in srgb, var(--csolve-moss) 18%, transparent), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, color-mix(in srgb, var(--csolve-amber, #c47b3a) 14%, transparent), transparent 50%)",
        }}
      />

      <div className="relative flex flex-col gap-8 p-6 sm:p-8">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--csolve-moss)]">
            Expanding beyond coffee
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--frappe-text)] sm:text-3xl">
            More lines are on the way
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--frappe-text-muted)] sm:text-base">
            Local roast and export coffee are live today. Import trade and
            manufacturing will join this command center next — same stock,
            approvals, and finance backbone.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-bg,var(--background))]/70 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-md bg-[var(--csolve-moss)]/12 text-[var(--csolve-moss)]">
                  <PackageIcon className="size-4" />
                </span>
                <h3 className="font-semibold text-[var(--frappe-text)]">
                  Import trade
                </h3>
              </div>
              <span className="rounded-full border border-[var(--frappe-border)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
                Coming soon
              </span>
            </div>
            <p className="mb-4 text-sm text-[var(--frappe-text-muted)]">
              Non-coffee imports will share intake, warehouse, and cost
              visibility across the business.
            </p>
            <ul className="grid gap-3">
              {IMPORT_LINES.map(({ icon: Icon, title, detail }) => (
                <li
                  key={title}
                  className="flex gap-3 rounded-md border border-transparent px-1 py-1.5 transition-colors hover:border-[var(--frappe-border)] hover:bg-[var(--frappe-surface)]"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--frappe-text)]">
                      {title}
                    </p>
                    <p className="text-xs leading-relaxed text-[var(--frappe-text-muted)]">
                      {detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="flex flex-col rounded-lg border border-[var(--frappe-border)] bg-[var(--frappe-bg,var(--background))]/70 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-md bg-[var(--csolve-amber,#c47b3a)]/15 text-[var(--csolve-amber,#c47b3a)]">
                  <FactoryIcon className="size-4" />
                </span>
                <h3 className="font-semibold text-[var(--frappe-text)]">
                  Manufacturing
                </h3>
              </div>
              <span className="rounded-full border border-[var(--frappe-border)] px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--frappe-text-muted)]">
                Coming soon
              </span>
            </div>
            <p className="mb-4 text-sm text-[var(--frappe-text-muted)]">
              Production planning, bill of materials, and finished-goods output
              will sit beside coffee process runs.
            </p>
            <div className="mt-auto flex flex-1 flex-col justify-end gap-3">
              <div className="flex items-start gap-3 rounded-md border border-dashed border-[var(--frappe-border)] px-3 py-3">
                <WrenchIcon className="mt-0.5 size-4 shrink-0 text-[var(--frappe-text-muted)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--frappe-text)]">
                    Work orders &amp; BOM
                  </p>
                  <p className="text-xs text-[var(--frappe-text-muted)]">
                    Consume raw stock, track yield, and post finished inventory.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-dashed border-[var(--frappe-border)] px-3 py-3">
                <FactoryIcon className="mt-0.5 size-4 shrink-0 text-[var(--frappe-text-muted)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--frappe-text)]">
                    Plant capacity
                  </p>
                  <p className="text-xs text-[var(--frappe-text-muted)]">
                    Line schedules and throughput once manufacturing goes live.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <p className="text-center text-xs text-[var(--frappe-text-muted)] sm:text-left">
          Coffee Local and Export dashboards remain fully available. These
          modules will unlock in the same workspace when ready.
        </p>
      </div>
    </div>
  );
}
