"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/format";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(
    () => searchParams.get("token")?.trim() ?? "",
    [searchParams]
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing reset token. Open the link from your email again.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword: password },
        auth: false,
      });
      router.replace("/login?message=password-changed");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Set new password">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-[var(--csolve-border)] bg-[var(--csolve-parchment)]/90 p-6 shadow-lg sm:p-8 dark:bg-[var(--csolve-espresso)]/60"
      >
        {!token ? (
          <p className="rounded-md bg-[var(--csolve-cherry)]/10 px-3 py-2 text-sm text-[var(--csolve-cherry)]">
            This page needs a valid reset token from your email link.
          </p>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="h-11 border-[var(--csolve-border)] bg-[var(--csolve-parchment)]"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder="Repeat new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
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
          disabled={loading || !token}
          className="mt-1 h-11 w-full bg-[var(--csolve-roast)] text-[var(--csolve-parchment)] hover:bg-[var(--csolve-roast-hover)]"
        >
          {loading ? <Spinner className="size-4" /> : "Update password"}
        </Button>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </form>
    </AuthShell>
  );
}
