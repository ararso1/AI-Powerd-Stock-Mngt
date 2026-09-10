import { cn } from "@/lib/utils";

export function FrappeSection({
  title,
  description,
  children,
  className,
  collapsible = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
}) {
  return (
    <section className={cn("border-b border-[var(--frappe-border)] last:border-b-0", className)}>
      <div className="frappe-section-head flex items-center justify-between border-b border-[var(--frappe-border)] bg-[var(--frappe-section-head)] px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--frappe-text)]">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--frappe-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {collapsible ? (
          <span className="text-xs text-[var(--frappe-text-muted)]">Section</span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function FrappeFormGrid({
  children,
  columns = 2,
  className,
}: {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 md:grid-cols-3"
        : columns === 4
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2";

  return (
    <div className={cn("grid gap-4", colClass, className)}>{children}</div>
  );
}
