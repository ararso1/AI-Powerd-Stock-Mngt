import type { Permission, Role } from "@/lib/types";

export type RolePermissionEntry = { id?: string; code: string };

/** `GET /roles` may return permission codes (strings) or nested permission objects. */
export function normalizeRolePermissions(
  permissions: Role["permissions"]
): RolePermissionEntry[] {
  if (!permissions?.length) return [];
  return permissions.map((p) =>
    typeof p === "string" ? { code: p } : { id: p.id, code: p.code }
  );
}

export function rolePermissionCodes(
  permissions: Role["permissions"]
): string[] {
  return normalizeRolePermissions(permissions).map((p) => p.code);
}

export function rolePermissionIdsFromRole(
  permissions: Role["permissions"],
  catalog: Permission[]
): string[] {
  const ids: string[] = [];
  for (const p of permissions ?? []) {
    if (typeof p === "string") {
      const match = catalog.find((c) => c.code === p);
      if (match) ids.push(match.id);
    } else {
      ids.push(p.id);
    }
  }
  return ids;
}
