"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { CsolveMark } from "@/components/brand/csolve-mark";
import { useIsClient } from "@/hooks/use-is-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/theme-toggle";
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
    <div className="csolve-login-bg relative flex min-h-svh flex-col items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="csolve-enter mb-8 flex flex-col items-center gap-4 text-center">
        <CsolveMark withWordmark size="lg" className="flex-col sm:flex-row" />
        <p className="max-w-sm text-sm text-[var(--csolve-text-muted)]">
          AI-powered stock management for coffee exporters and the local roast
          market.
        </p>
      </div>

      <Card className="csolve-enter w-full max-w-md border-[var(--csolve-border)] bg-[var(--csolve-parchment)]/95 shadow-lg shadow-[var(--csolve-espresso)]/8 backdrop-blur-sm [animation-delay:80ms]">
        <CardHeader>
          <CardTitle className="font-heading text-[var(--csolve-espresso)] dark:text-[var(--csolve-cream)]">
            Sign in
          </CardTitle>
          <CardDescription>
            Use your Csolve account credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@stock.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[var(--csolve-border)] bg-[var(--csolve-parchment)]"
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
                className="border-[var(--csolve-border)] bg-[var(--csolve-parchment)]"
              />
            </div>
            {error ? (
              <p className="text-sm text-[var(--csolve-cherry)]">{error}</p>
            ) : null}
            {loginMessage ? (
              <p className="text-sm text-[var(--csolve-text-muted)]">
                {loginMessage}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--csolve-roast)] text-[var(--csolve-parchment)] hover:bg-[var(--csolve-roast-hover)]"
            >
              {loading ? <Spinner className="size-4" /> : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
