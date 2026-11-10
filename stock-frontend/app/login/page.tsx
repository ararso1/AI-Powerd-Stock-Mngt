"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { useIsClient } from "@/hooks/use-is-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/brand";
import { errorMessage } from "@/lib/format";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useIsClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const loginMessage =
    searchParams.get("message") === "password-changed"
      ? "Password updated. Sign in with your new password."
      : null;

  useEffect(() => {
    if (!isClient || authLoading) return;
    if (user) {
      router.replace(redirectTo);
    }
  }, [isClient, authLoading, user, router, redirectTo]);

  if (!isClient || authLoading || user) {
    return <AuthLoading />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col lg:flex-row">
      <div className="absolute right-4 top-4 z-20 lg:right-6 lg:top-6">
        <ThemeToggle />
      </div>

      {/* Brand panel — left on desktop, top on mobile */}
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
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border border-[var(--csolve-honey)]/20"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full border border-[var(--csolve-moss)]/25"
          aria-hidden
        />

        <div className="relative z-10 csolve-enter">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--csolve-honey)]">
            {BRAND.productName}
          </p>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 py-10 text-center csolve-enter lg:items-start lg:text-left [animation-delay:60ms]">
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

      {/* Sign-in panel — right on desktop */}
      <main className="relative flex flex-1 items-center justify-center bg-[var(--csolve-cream)] px-6 py-12 sm:px-10 lg:px-16 dark:bg-[var(--csolve-espresso)]/95">
        <div
          className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-30"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 50% 40% at 80% 10%, color-mix(in srgb, var(--csolve-moss) 12%, transparent), transparent 60%),
              radial-gradient(ellipse 40% 35% at 10% 90%, color-mix(in srgb, var(--csolve-honey) 14%, transparent), transparent 55%)
            `,
          }}
        />

        <div className="relative z-10 w-full max-w-[400px] csolve-enter [animation-delay:100ms]">
          <div className="mb-8">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-[var(--csolve-espresso)] dark:text-[var(--csolve-cream)]">
              Sign in
            </h2>
          </div>

          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-5 rounded-2xl border border-[var(--csolve-border)] bg-[var(--csolve-parchment)]/90 p-6 shadow-lg shadow-[var(--csolve-espresso)]/6 backdrop-blur-sm sm:p-8 dark:bg-[var(--csolve-espresso)]/60 dark:border-[var(--csolve-border)]/30"
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@efnanbusinessplc.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-[var(--csolve-border)] bg-[var(--csolve-parchment)]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 border-[var(--csolve-border)] bg-[var(--csolve-parchment)]"
              />
              <Link
                href="/forgot-password"
                className="justify-self-end text-xs font-medium text-[var(--csolve-roast)] underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            {error ? (
              <p className="rounded-md bg-[var(--csolve-cherry)]/10 px-3 py-2 text-sm text-[var(--csolve-cherry)]">
                {error}
              </p>
            ) : null}
            {loginMessage ? (
              <p className="rounded-md bg-[var(--csolve-moss-soft)] px-3 py-2 text-sm text-[var(--csolve-moss)]">
                {loginMessage}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 w-full bg-[var(--csolve-roast)] text-[var(--csolve-parchment)] hover:bg-[var(--csolve-roast-hover)]"
            >
              {loading ? <Spinner className="size-4" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--csolve-text-muted)]">
            {BRAND.tagline}
          </p>
        </div>
      </main>
    </div>
  );
}
