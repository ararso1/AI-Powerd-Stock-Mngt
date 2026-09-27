import { cn } from "@/lib/utils";

export function StageProgress({
  stages,
  currentIndex,
}: {
  stages: string[];
  /** Index of the stage in progress. Earlier stages are complete. */
  currentIndex: number;
}) {
  return (
    <ol className="flex w-full items-start">
      {stages.map((stage, index) => {
        const state =
          index < currentIndex
            ? "done"
            : index === currentIndex
              ? "current"
              : "upcoming";
        return (
          <li key={stage} className="relative flex min-w-0 flex-1 flex-col items-center">
            {index < stages.length - 1 ? (
              <span
                className={cn(
                  "absolute top-4 left-1/2 h-0.5 w-full",
                  index < currentIndex
                    ? "bg-[var(--frappe-primary)]"
                    : "bg-[var(--frappe-border)]"
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                state === "done" &&
                  "border-[var(--frappe-primary)] bg-[var(--frappe-primary)] text-white",
                state === "current" &&
                  "border-[var(--frappe-primary)] bg-[var(--frappe-surface)] text-[var(--frappe-primary)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--frappe-primary)_18%,transparent)]",
                state === "upcoming" &&
                  "border-[var(--frappe-border)] bg-[var(--frappe-surface)] text-[var(--frappe-text-muted)]"
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "mt-2 px-1 text-center text-xs font-medium leading-4",
                state === "upcoming"
                  ? "text-[var(--frappe-text-muted)]"
                  : "text-[var(--frappe-text)]"
              )}
            >
              {stage}
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--frappe-text-muted)]">
              {state === "done"
                ? "Done"
                : state === "current"
                  ? "Current"
                  : "Next"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
