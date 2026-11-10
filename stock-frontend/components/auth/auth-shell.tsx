"use client";

import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col lg:flex-row">
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>

      <aside className="relative flex flex-1 flex-col justify-between overflow-hidden bg-[var(--csolve-espresso)] px-8 py-10 text-[var(--csolve-cream)] sm:px-12 lg:max-w-[48%] lg:px-14 lg:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 15%, color-mix(in srgb, var(--csolve-honey) 28%, transparent), transparent 55%),
              radial-gradient(ellipse 70% 50% at 90% 80%, color-mix(in srgb, var(--csolve-moss) 35%, transparent), transparent 50%),
              linear-gradient(160deg, var(--csolve-espresso) 0%, #3d2416 45%, var(--csolve-roast) 100%)
            `,
          }}
        />
        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--csolve-honey)]">
            {BRAND.productName}
          </p>
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 py-10 text-center lg:items-start lg:text-left">
          <div className="rounded-2xl bg-white/95 p-5 shadow-xl shadow-black/25 ring-1 ring-white/40 sm:p-7">
            <Image
              src={BRAND.logo}
              alt={BRAND.name}
              width={280}
              height={280}
              priority
              className="mx-auto h-auto w-[min(100%,220px)] object-contain sm:w-[240px]"
            />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {BRAND.name}
            </h1>
            <p className="max-w-sm text-sm text-[var(--csolve-caramel)]">
              AI-powered business management for coffee and beyond.
            </p>
          </div>
        </div>
        <p className="relative z-10 text-center text-[11px] text-[var(--csolve-caramel)]/70 lg:text-left">
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </aside>

      <main className="relative flex flex-1 items-center justify-center bg-[var(--csolve-cream)] px-6 py-12 sm:px-10 lg:px-16 dark:bg-[var(--csolve-espresso)]/95">
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[var(--csolve-espresso)] dark:text-[var(--csolve-cream)]">
              {title}
            </h2>
          </div>
          {children}
          <p className="mt-6 text-center text-xs text-[var(--csolve-text-muted)]">
            {BRAND.tagline}
          </p>
        </div>
      </main>
    </div>
  );
}
