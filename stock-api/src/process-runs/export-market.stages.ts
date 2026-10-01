export const EXPORT_MARKET_STAGES = [
  'Processing Started',
  'Cleaning',
  'Packaging',
  'Export Store',
] as const;

export type ExportMarketStage = (typeof EXPORT_MARKET_STAGES)[number];

/** Loss above this percent is High Loss. Exactly 13% is still within the limit. */
export const EXPORT_MAX_LOSS_PERCENT = 13;

export type ExportStageWarning = 'HIGH_LOSS';

export interface ExportPostEcta {
  grade?: string | null;
  certificateNumber?: string | null;
  moisturePercent?: string | null;
  cuppingScore?: string | null;
  testedAt?: string | null;
  notes?: string | null;
}

export interface ExportDocumentRecord {
  key: string;
  label: string;
  reference?: string | null;
  notes?: string | null;
}

export interface ExportStageResult {
  stage: ExportMarketStage;
  inputQty: string;
  removedQty: string;
  outputQty: string;
  lossPercent: string;
  warnings: ExportStageWarning[];
  completedAt: string;
  completedById: string | null;
  completedByName: string | null;
  outputLotId: string | null;
  outputLotCode: string | null;
  rejectLotId: string | null;
  rejectLotCode: string | null;
  notes: string | null;
  expectedGrade?: string | null;
  kgPerDoniya?: string | null;
  doniyaCount?: number | null;
  packagedKg?: string | null;
  remainderKg?: string | null;
  remainderLotId?: string | null;
  remainderLotCode?: string | null;
  exportStoreLocationId?: string | null;
  exportStoreLocationName?: string | null;
  postEcta?: ExportPostEcta | null;
  documents?: ExportDocumentRecord[] | null;
}

export function lossPercent(input: number, removed: number): number {
  if (!(input > 0)) return 0;
  return (removed / input) * 100;
}

export function exportLossWarnings(
  input: number,
  removed: number,
): ExportStageWarning[] {
  if (lossPercent(input, removed) > EXPORT_MAX_LOSS_PERCENT) return ['HIGH_LOSS'];
  return [];
}
