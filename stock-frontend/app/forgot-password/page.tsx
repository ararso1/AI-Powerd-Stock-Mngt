"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api<{ success: boolean; message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
        auth: false,
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot password">
      {done ? (
        <div className="space-y-4 rounded-2xl border border-[var(--csolve-border)] bg-[var(--csolve-parchment)]/90 p-6 shadow-lg sm:p-8 dark:bg-[var(--csolve-espresso)]/60">
          <p className="text-sm text-[var(--csolve-espresso)] dark:text-[var(--csolve-cream)]">
            If an account exists for that email, a password reset link has been
            sent. Check your inbox (and spam folder).
          </p>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-[var(--csolve-border)] bg-[var(--csolve-parchment)]/90 p-6 shadow-lg sm:p-8 dark:bg-[var(--csolve-espresso)]/60"
        >
          <p className="text-sm text-[var(--csolve-text-muted)]">
            Enter your account email and we will send a reset link if it
            matches an active user.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@efnanbusinessplc.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 border-[var(--csolve-border)] bg-[var(--csolve-parchment)]"
            />
          </div>
          {error ? (
            <p className="rounded-md bg-[var(--csolve-cherry)]/10 px-3 py-2 text-sm text-[var(--csolve-cherry)]">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={loading}
            className="mt-1 h-11 w-full bg-[var(--csolve-roast)] text-[var(--csolve-parchment)] hover:bg-[var(--csolve-roast-hover)]"
          >
            {loading ? <Spinner className="size-4" /> : "Send reset link"}
          </Button>
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
