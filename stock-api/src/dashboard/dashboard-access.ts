export type DashboardAccess = {
  userId: string;
  roleName: string | null;
  /** null = company-wide; otherwise only these warehouses. */
  locationIds: string[] | null;
  permissions: Set<string>;
};

export function hasPerm(access: DashboardAccess, ...codes: string[]): boolean {
  return codes.some((c) => access.permissions.has(c));
}

export function canViewExport(access: DashboardAccess): boolean {
  return hasPerm(access, 'export.read') || access.roleName === 'Admin';
}

export function canViewLocal(access: DashboardAccess): boolean {
  // Most operational roles work the local market; export-only would be rare.
  return (
    hasPerm(
      access,
      'inventory.read',
      'process.read',
      'sales.read',
      'purchase.read',
      'lot.read',
    ) || access.roleName === 'Admin'
  );
}

export function canViewFinance(access: DashboardAccess): boolean {
  return hasPerm(
    access,
    'bank.read',
    'profit_loss.read',
    'reports.read',
    'credit.read',
  );
}

export function scopeMeta(access: DashboardAccess) {
  return {
    roleName: access.roleName,
    companyWide: access.locationIds == null,
    locationIds: access.locationIds,
    sections: {
      local: canViewLocal(access),
      export: canViewExport(access),
      inventory: hasPerm(access, 'inventory.read', 'lot.read'),
      purchases: hasPerm(access, 'purchase.read'),
      sales: hasPerm(access, 'sales.read'),
      process: hasPerm(access, 'process.read'),
      finance: canViewFinance(access),
      credits: hasPerm(access, 'credit.read'),
      banks: hasPerm(access, 'bank.read'),
      contracts: hasPerm(access, 'export.read'),
    },
  };
}

/** Apply location scope to an in-memory row with locationId. */
export function inScopedLocations<T extends { locationId?: string | null }>(
  rows: T[],
  locationIds: string[] | null,
): T[] {
  if (!locationIds) return rows;
  const set = new Set(locationIds);
  return rows.filter((r) => r.locationId != null && set.has(r.locationId));
}
