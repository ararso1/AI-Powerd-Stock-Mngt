import Image from "next/image";
import { BRAND } from "@/lib/brand";

/** Shared loading shell for auth — branded spinner to avoid icon hydration issues. */
export function AuthLoading() {
  return (
    <div
      className="csolve-login-bg flex min-h-svh flex-col items-center justify-center gap-4"
      suppressHydrationWarning
    >
      <Image
        src={BRAND.logoIcon}
        alt={BRAND.name}
        width={56}
        height={56}
        priority
        className="size-14 object-contain"
      />
      <div
        className="size-8 animate-spin rounded-full border-2 border-[var(--csolve-caramel)]/40 border-t-[var(--csolve-roast)]"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
