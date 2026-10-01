"use client";

import Link from "next/link";

const CHOICES = [
  {
    href: "/process-runs/new/local",
    title: "Local market",
    detail: "Cleaning, roast and ground, then the sales store.",
  },
  {
    href: "/process-runs/new/export",
    title: "Export",
    detail:
      "Processing, cleaning, and packaging move coffee into the export store.",
  },
] as const;

export function ProcessRunChoice() {
  return (
    <section className="mx-auto max-w-3xl rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-5">
      <p className="text-sm font-medium text-[var(--frappe-text)]">
        Start processing for
      </p>
      <p className="mt-1 text-xs text-[var(--frappe-text-muted)]">
        Choose local market or export. Each one opens its own processing page.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CHOICES.map((choice) => (
          <Link
            key={choice.href}
            href={choice.href}
            className="rounded-lg border border-[var(--frappe-border)] px-4 py-4 text-left transition hover:border-[var(--frappe-primary)]"
          >
            <span className="block text-sm font-semibold text-[var(--frappe-text)]">
              {choice.title}
            </span>
            <span className="mt-1 block text-xs text-[var(--frappe-text-muted)]">
              {choice.detail}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
