import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Spinner } from "@/components/ui/spinner";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Set new password">
          <div className="flex justify-center rounded-2xl border border-[var(--csolve-border)] bg-[var(--csolve-parchment)]/90 p-10">
            <Spinner className="size-5" />
          </div>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
