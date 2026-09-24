/** Dashboard / report period presets → ISO date range (local calendar). */

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "this_year"
  | "lifetime"
  | "custom";

export const PERIOD_PRESET_OPTIONS: Array<{
  value: PeriodPreset;
  label: string;
  group: string;
}> = [
  { value: "today", label: "Today", group: "Day" },
  { value: "yesterday", label: "Yesterday", group: "Day" },
  { value: "this_week", label: "This week", group: "Week" },
  { value: "last_week", label: "Last week", group: "Week" },
  { value: "this_month", label: "This month", group: "Month" },
  { value: "last_month", label: "Last month", group: "Month" },
  { value: "q1", label: "Q1", group: "Quarter" },
  { value: "q2", label: "Q2", group: "Quarter" },
  { value: "q3", label: "Q3", group: "Quarter" },
  { value: "q4", label: "Q4", group: "Quarter" },
  { value: "this_year", label: "This year", group: "Year" },
  { value: "lifetime", label: "Lifetime", group: "Year" },
  { value: "custom", label: "Custom", group: "Custom" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Local calendar date as YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday-based week start (ISO). */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(d: Date) {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function quarterBounds(year: number, quarter: 1 | 2 | 3 | 4) {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  return { from, to };
}

/**
 * Resolve a preset to API `from` / `to` query params.
 * Lifetime returns both undefined (no date filter).
 * Custom uses the provided customFrom / customTo when set.
 */
export function resolvePeriodRange(
  preset: PeriodPreset,
  options?: {
    now?: Date;
    customFrom?: string;
    customTo?: string;
  }
): { from?: string; to?: string } {
  const now = options?.now ?? new Date();
  const today = startOfDay(now);
  const year = today.getFullYear();

  switch (preset) {
    case "today":
      return { from: toIsoDate(today), to: toIsoDate(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toIsoDate(y), to: toIsoDate(y) };
    }
    case "this_week":
      return {
        from: toIsoDate(startOfWeek(today)),
        to: toIsoDate(endOfWeek(today)),
      };
    case "last_week": {
      const ref = new Date(today);
      ref.setDate(ref.getDate() - 7);
      return {
        from: toIsoDate(startOfWeek(ref)),
        to: toIsoDate(endOfWeek(ref)),
      };
    }
    case "this_month":
      return {
        from: toIsoDate(startOfMonth(today)),
        to: toIsoDate(endOfMonth(today)),
      };
    case "last_month": {
      const ref = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        from: toIsoDate(startOfMonth(ref)),
        to: toIsoDate(endOfMonth(ref)),
      };
    }
    case "q1": {
      const q = quarterBounds(year, 1);
      return { from: toIsoDate(q.from), to: toIsoDate(q.to) };
    }
    case "q2": {
      const q = quarterBounds(year, 2);
      return { from: toIsoDate(q.from), to: toIsoDate(q.to) };
    }
    case "q3": {
      const q = quarterBounds(year, 3);
      return { from: toIsoDate(q.from), to: toIsoDate(q.to) };
    }
    case "q4": {
      const q = quarterBounds(year, 4);
      return { from: toIsoDate(q.from), to: toIsoDate(q.to) };
    }
    case "this_year":
      return {
        from: toIsoDate(new Date(year, 0, 1)),
        to: toIsoDate(new Date(year, 11, 31)),
      };
    case "lifetime":
      return {};
    case "custom": {
      const from = options?.customFrom?.trim() || undefined;
      const to = options?.customTo?.trim() || undefined;
      return { from, to };
    }
    default:
      return {};
  }
}
