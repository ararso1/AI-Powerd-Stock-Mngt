import { Suspense } from "react";
import { AuthLoading } from "@/components/auth-loading";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<AuthLoading />}>{children}</Suspense>;
}
