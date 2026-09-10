"use client";

import Link from "next/link";
import { ChevronRight, HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FrappeBreadcrumb } from "./frappe-page";

export function FrappeBreadcrumbs({
  items,
  className,
}: {
  items: FrappeBreadcrumb[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      className={cn(
        "flex flex-wrap items-center gap-1 text-[13px] leading-none",
        className
      )}
      aria-label="Breadcrumb"
    >
      {items.map((crumb, i) => {
        const isLast = i === items.length - 1;
        const isFirst = i === 0;

        return (
          <span
            key={`${crumb.label}-${i}`}
            className="inline-flex items-center gap-1"
          >
            {i > 0 ? (
              <ChevronRight
                className="size-3.5 shrink-0 text-[var(--frappe-text-muted)]/70"
                aria-hidden
              />
            ) : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-[var(--frappe-text-muted)] transition-colors",
                  "hover:bg-[var(--frappe-section-head)] hover:text-[var(--frappe-primary)]"
                )}
              >
                {isFirst ? (
                  <HomeIcon className="size-3.5 shrink-0 opacity-80" />
                ) : null}
                <span>{crumb.label}</span>
              </Link>
            ) : (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
                  isLast
                    ? "bg-[var(--frappe-primary)]/10 text-[var(--frappe-primary)]"
                    : "text-[var(--frappe-text)]"
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {isFirst && !crumb.href ? (
                  <HomeIcon className="size-3.5 shrink-0 opacity-80" />
                ) : null}
                <span>{crumb.label}</span>
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
