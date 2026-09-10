"use client";

import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { FrappeBreadcrumbs } from "./frappe-breadcrumbs";

export interface FrappeBreadcrumb {
  label: string;
  href?: string;
}

export function FrappePageHead({
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: FrappeBreadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "frappe-page-head shrink-0 border-b border-[var(--frappe-border)] bg-[var(--frappe-surface)]",
        className
      )}
    >
      <div className="flex items-start gap-3 px-4 py-4 lg:px-6 lg:py-5">
        <SidebarTrigger className="mt-0.5 size-8 shrink-0 text-[var(--frappe-text-muted)] hover:text-[var(--frappe-text)]" />
        <div className="min-w-0 flex-1">
          {breadcrumbs && breadcrumbs.length > 0 ? (
            <FrappeBreadcrumbs items={breadcrumbs} className="mb-2.5" />
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <h1 className="font-heading truncate text-xl font-semibold tracking-tight text-[var(--frappe-text)] lg:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-[var(--frappe-text-muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <NotificationBell />
              {actions ? (
                <div className="flex flex-wrap items-center gap-2">{actions}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export function FrappePageBody({
  children,
  className,
  noPadding,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 overflow-auto bg-[var(--frappe-desk)]",
        !noPadding && "p-4 lg:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FrappeFilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-3 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FrappeListToolbar({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--frappe-border)]/80 bg-[var(--frappe-surface)]/60 px-3 py-2 text-sm backdrop-blur-sm",
        className
      )}
    >
      {children ?? (
        <span className="text-[var(--frappe-text-muted)]">
          Click a row or use actions above
        </span>
      )}
    </div>
  );
}

export function FrappeFormToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--frappe-border)] bg-[var(--frappe-surface)] px-4 py-2.5 shadow-sm lg:-mx-6 lg:-mt-6 lg:px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FrappeDocument({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--frappe-border)] bg-[var(--frappe-surface)] shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
