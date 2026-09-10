import { cn } from "@/lib/utils";

type CsolveMarkProps = {
  className?: string;
  /** Show wordmark + subtitle */
  withWordmark?: boolean;
  /** Compact for sidebar */
  size?: "sm" | "md" | "lg";
};

export function CsolveMark({
  className,
  withWordmark = false,
  size = "md",
}: CsolveMarkProps) {
  const iconSize =
    size === "lg" ? "size-11" : size === "sm" ? "size-7" : "size-9";
  const titleSize =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl bg-[var(--csolve-roast)] text-[var(--csolve-parchment)] shadow-md ring-2 ring-[var(--csolve-honey)]/35",
          iconSize
        )}
        aria-hidden
      >
        <svg
          viewBox="0 0 32 32"
          className="size-[58%]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="14" cy="18" rx="9" ry="7" fill="currentColor" opacity="0.95" />
          <path
            d="M23 14c3.2 0 5 2.2 5 5s-1.8 5-5 5h-1.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M11 8c1.2 1.5 1.2 3 0 4.5M15 7.5c1.2 1.5 1.2 3.2 0 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>
      </span>
      {withWordmark ? (
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              "font-heading font-bold tracking-tight text-[var(--csolve-espresso)] dark:text-[var(--csolve-cream)]",
              titleSize
            )}
          >
            Csolve
          </p>
          <p className="truncate text-[11px] font-medium tracking-wide text-[var(--csolve-moss)]">
            Coffee stock · AI
          </p>
        </div>
      ) : null}
    </div>
  );
}
