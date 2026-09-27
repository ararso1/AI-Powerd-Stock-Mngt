export const LOCAL_MARKET_STAGES = [
  'Processing Started',
  'Cleaning',
  'Roast & Ground',
  'Sales Store',
] as const;

export type LocalMarketStage = (typeof LOCAL_MARKET_STAGES)[number];

export type LocalStageWarning = 'HIGH_LOSS' | 'UNDER_SCREEN';

export interface LocalStagePack {
  sizeKg: number;
  count: number;
  lotId: string;
  lotCode: string;
  sku: string;
  kind?: 'ROAST' | 'GROUND';
}

export interface LocalStageResult {
  stage: LocalMarketStage;
  inputQty: string;
  removedQty: string;
  outputQty: string;
  lossPercent: string;
  warnings: LocalStageWarning[];
  completedAt: string;
  completedById: string | null;
  completedByName: string | null;
  outputLotId: string | null;
  outputLotCode: string | null;
  rejectLotId: string | null;
  rejectLotCode: string | null;
  notes: string | null;
  packs?: LocalStagePack[];
  remainderKg?: string;
  roastQty?: string;
  groundQty?: string;
  roastLotId?: string | null;
  roastLotCode?: string | null;
  groundLotId?: string | null;
  groundLotCode?: string | null;
  unallocatedKg?: string;
  roastRemainderKg?: string;
  groundRemainderKg?: string;
}

export function lossPercent(input: number, removed: number): number {
  if (!(input > 0)) return 0;
  return (removed / input) * 100;
}

/** High Loss above 20%. Under Screen when usable output is below 80% of input. */
export function cleaningWarnings(
  input: number,
  output: number,
): LocalStageWarning[] {
  const warnings: LocalStageWarning[] = [];
  const removed = Math.max(0, input - output);
  if (lossPercent(input, removed) > 20) warnings.push('HIGH_LOSS');
  if (input > 0 && output / input < 0.8) warnings.push('UNDER_SCREEN');
  return warnings;
}
