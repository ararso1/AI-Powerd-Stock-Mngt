import { rolePermissionCodes } from "@/lib/role-permissions";
import type { User } from "@/lib/types";

export function hasPermission(
  user: User | null | undefined,
  permission: string
): boolean {
  if (!user?.role?.permissions) return false;
  return rolePermissionCodes(user.role.permissions).includes(permission);
}

export function hasAnyPermission(
  user: User | null | undefined,
  permissions: string[]
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}
