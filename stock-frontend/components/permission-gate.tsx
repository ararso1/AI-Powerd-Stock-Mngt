"use client";

import { useAuth } from "@/lib/auth";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

export function PermissionGate({
  permission,
  permissions,
  children,
  fallback = null,
}: {
  permission?: string;
  permissions?: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = useAuth();
  const allowed = permission
    ? hasPermission(user, permission)
    : permissions
      ? hasAnyPermission(user, permissions)
      : true;
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
