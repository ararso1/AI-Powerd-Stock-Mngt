/**
 * Customer receivable aging from original credit/sale date
 * (how long outstanding credit has remained unpaid).
 */
export const CUSTOMER_CREDIT_AGING_BUCKETS = [
  {
    key: 'd0_15',
    label: '0–15 days',
    risk: 'Normal',
    min: 0,
    max: 15,
  },
  {
    key: 'd16_30',
    label: '16–30 days',
    risk: 'Attention / Critical',
    min: 16,
    max: 30,
  },
  {
    key: 'd31_60',
    label: '31–60 days',
    risk: 'High Risk',
    min: 31,
    max: 60,
  },
  {
    key: 'd60_plus',
    label: '60+ days',
    risk: 'Highly Critical',
    min: 61,
    max: Number.POSITIVE_INFINITY,
  },
] as const;

export type CustomerCreditAgingKey =
  (typeof CUSTOMER_CREDIT_AGING_BUCKETS)[number]['key'];

export type CreditAgingBucketDef = {
  key: string;
  label: string;
  risk?: string;
  min: number;
  max: number;
};

/** Supplier payables keep classic buckets (unchanged UX). */
export const SUPPLIER_CREDIT_AGING_BUCKETS: CreditAgingBucketDef[] = [
  { key: 'current', label: 'Current', min: Number.NEGATIVE_INFINITY, max: 0 },
  { key: 'd1_30', label: '1–30 days', min: 1, max: 30 },
  { key: 'd31_60', label: '31–60 days', min: 31, max: 60 },
  { key: 'd61_90', label: '61–90 days', min: 61, max: 90 },
  {
    key: 'd90_plus',
    label: '90+ days',
    min: 91,
    max: Number.POSITIVE_INFINITY,
  },
];

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

export function resolveAgingBucket(
  days: number,
  buckets: readonly CreditAgingBucketDef[],
): CreditAgingBucketDef {
  return (
    buckets.find((b) => days >= b.min && days <= b.max) ??
    buckets[buckets.length - 1]
  );
}

/** Days outstanding since original credit/sale date (never negative). */
export function creditAgingDays(createdAt: Date | string, today = new Date()) {
  const days = daysBetween(new Date(createdAt), today);
  return Math.max(0, days);
}

export function customerCreditAgingMeta(createdAt: Date | string) {
  const days = creditAgingDays(createdAt);
  return customerCreditAgingFromDays(days);
}

export function customerCreditAgingFromDays(days: number) {
  const bucket = resolveAgingBucket(days, CUSTOMER_CREDIT_AGING_BUCKETS);
  return {
    agingDays: days,
    agingKey: bucket.key,
    agingLabel: bucket.label,
    agingRisk: bucket.risk ?? bucket.label,
  };
}

/**
 * Limit increase earned when a credit balance is fully repaid.
 * Percent is of the customer's initial credit limit.
 * 0–15 days (Normal) → 10%, 16–30 days (Attention) → 5%, later buckets → none.
 */
export function repaymentLimitIncreasePercent(days: number): number {
  if (days <= 15) return 10;
  if (days <= 30) return 5;
  return 0;
}

/** Repayment score aligned with customer aging: Normal 100, Attention 75, High Risk 40, Highly Critical 10. */
export function repaymentPerformanceScore(days: number): number {
  if (days <= 15) return 100;
  if (days <= 30) return 75;
  if (days <= 60) return 40;
  return 10;
}
