"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import {
  FrappePageBody,
  FrappePageHead,
  type FrappeBreadcrumb,
} from "@/components/frappe";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AppShell({
  title,
  subtitle,
  breadcrumbs,
  children,
  actions,
  variant = "list",
  layout = "frappe",
  className,
}: {
  title: string;
  subtitle?: string;
  breadcrumbs?: FrappeBreadcrumb[];
  children: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "list" | "form" | "plain";
  /** frappe = ERP-style page content; default = shadcn dashboard-style page */
  layout?: "frappe" | "default";
  className?: string;
}) {
  const isFrappe = layout === "frappe";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <TooltipProvider>
        <AppSidebar variant="inset" />
        <SidebarInset className="flex flex-col bg-[var(--csolve-cream)] dark:bg-background">
          {isFrappe ? (
            <div className="frappe-page flex min-h-0 flex-1 flex-col">
              {variant !== "plain" ? (
                <FrappePageHead
                  title={title}
                  subtitle={subtitle}
                  breadcrumbs={breadcrumbs}
                  actions={actions}
                />
              ) : null}
              <FrappePageBody
                className={cn(variant === "form" && "pb-8", className)}
              >
                {children}
              </FrappePageBody>
            </div>
          ) : (
            <>
              {variant !== "plain" ? (
                <SiteHeader title={title} actions={actions} />
              ) : null}
              <div
                className={cn(
                  "flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6",
                  className
                )}
              >
                {children}
              </div>
            </>
          )}
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
