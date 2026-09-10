import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function FrappeField({
  label,
  required,
  hint,
  children,
  className,
  fullWidth,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "frappe-control grid gap-1.5",
        fullWidth && "md:col-span-2",
        className
      )}
    >
      <Label className="text-xs font-medium text-[var(--frappe-text-muted)]">
        {label}
        {required ? <span className="text-[var(--frappe-red)]"> *</span> : null}
      </Label>
      <div className="[&_input]:h-8 [&_input]:rounded [&_input]:border-[var(--frappe-border)] [&_input]:bg-[var(--frappe-surface)] [&_input]:text-sm [&_button]:h-8 [&_button]:rounded [&_button]:border-[var(--frappe-border)] [&_button]:bg-[var(--frappe-surface)] [&_button]:text-sm [&_button]:shadow-none">
        {children}
      </div>
      {hint ? (
        <p className="text-[11px] text-[var(--frappe-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
