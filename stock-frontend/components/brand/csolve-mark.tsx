import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  /** Show wordmark + subtitle next to the icon */
  withWordmark?: boolean;
  /**
   * `full` — complete logo (login / marketing)
   * `rectangular` — horizontal sidebar mark
   * `icon` — square EB icon (default)
   */
  variant?: "icon" | "full" | "rectangular";
  /** Compact for sidebar */
  size?: "sm" | "md" | "lg";
};

/** @deprecated Prefer BrandMark — kept as alias for existing imports. */
export function CsolveMark(props: BrandMarkProps) {
  return <BrandMark {...props} />;
}

export function BrandMark({
  className,
  withWordmark = false,
  variant = "icon",
  size = "md",
}: BrandMarkProps) {
  if (variant === "full") {
    const width = size === "lg" ? 260 : size === "sm" ? 160 : 220;
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <Image
          src={BRAND.logo}
          alt={BRAND.name}
          width={width}
          height={width}
          priority
          className="h-auto w-full max-w-[min(100%,260px)] object-contain"
        />
        {withWordmark ? (
          <p className="text-center text-xs font-medium tracking-wide text-[var(--csolve-moss)]">
            {BRAND.tagline}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "rectangular") {
    const height = size === "lg" ? 44 : size === "sm" ? 32 : 36;
    const width = Math.round(height * 3.2);
    return (
      <div className={cn("flex items-center", className)}>
        <Image
          src={BRAND.logoRectangular}
          alt={BRAND.name}
          width={width}
          height={height}
          priority
          className="h-8 w-auto max-w-[160px] object-contain object-left"
          style={{ height }}
        />
      </div>
    );
  }

  const iconPx = size === "lg" ? 56 : size === "sm" ? 32 : 40;
  const titleSize =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--csolve-border)]"
        style={{ width: iconPx, height: iconPx }}
        aria-hidden
      >
        <Image
          src={BRAND.logoIcon}
          alt=""
          width={iconPx}
          height={iconPx}
          className="size-full object-contain p-0.5"
        />
      </span>
      {withWordmark ? (
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              "font-heading font-bold tracking-tight text-[var(--csolve-espresso)] dark:text-[var(--csolve-cream)]",
              titleSize
            )}
          >
            {BRAND.shortName}
          </p>
          <p className="truncate text-[11px] font-medium tracking-wide text-[var(--csolve-moss)]">
            {BRAND.tagline}
          </p>
        </div>
      ) : null}
    </div>
  );
}
