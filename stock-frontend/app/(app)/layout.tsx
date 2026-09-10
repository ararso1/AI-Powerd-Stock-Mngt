import { AuthGuardClient } from "@/components/auth-guard-client";
import { AppProviders } from "@/components/app-providers";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuardClient>
      <AppProviders>{children}</AppProviders>
    </AuthGuardClient>
  );
}
