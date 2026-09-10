export type ReportRowKey<T> =
  | keyof T
  | ((row: T) => string | undefined | null);

export function filterReportRows<T>(
  rows: T[],
  query: string,
  keys: ReportRowKey<T>[]
): T[] {
  const term = query.trim().toLowerCase();
  if (!term) return rows;

  return rows.filter((row) =>
    keys.some((key) => {
      const raw =
        typeof key === "function"
          ? key(row)
          : (row[key] as string | undefined | null);
      return String(raw ?? "")
        .toLowerCase()
        .includes(term);
    })
  );
}

export function locationFilterOptions(
  locations: { id: string; name: string; type?: string }[]
) {
  return locations.map((location) => ({
    value: location.id,
    label: location.type
      ? `${location.name} (${location.type})`
      : location.name,
  }));
}
