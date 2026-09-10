"use client";

import dynamic from "next/dynamic";
import { AuthLoading } from "@/components/auth-loading";

const AuthGuard = dynamic(
  () => import("@/components/auth-guard").then((mod) => mod.AuthGuard),
  { ssr: false, loading: () => <AuthLoading /> }
);

export function AuthGuardClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}
