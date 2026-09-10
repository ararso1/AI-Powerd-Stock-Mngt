"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const QuickCreateTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { label: string }
>(function QuickCreateTrigger({ label, className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-[var(--frappe-primary)] hover:underline",
        className
      )}
      {...props}
    >
      <PlusIcon className="size-3.5" />
      {label}
    </button>
  );
});

export const QuickCreateInlineTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { label: string }
>(function QuickCreateInlineTrigger(
  { label, className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "font-medium text-[var(--frappe-primary)] hover:underline",
        className
      )}
      {...props}
    >
      {label}
    </button>
  );
});
