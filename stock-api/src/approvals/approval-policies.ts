import { ROLE_NAMES } from '../database/constants/permissions';

export type ApprovalStepDef = {
  requiredRoleName: string;
  requiredPermission: string;
  stepOrder: number;
};

/** Purchase / stock-entry approval chain based on initiator role. */
export function purchaseApprovalSteps(
  initiatorRoleName: string | null | undefined,
): ApprovalStepDef[] {
  const role = initiatorRoleName ?? '';
  if (role === ROLE_NAMES.ADMIN) return [];

  if (role === ROLE_NAMES.OPERATIONS_MANAGER) {
    return [
      {
        requiredRoleName: ROLE_NAMES.HEAD_STOREKEEPER,
        requiredPermission: 'purchase.approve',
        stepOrder: 1,
      },
      {
        requiredRoleName: ROLE_NAMES.ADMIN,
        requiredPermission: 'purchase.approve',
        stepOrder: 2,
      },
    ];
  }

  if (role === ROLE_NAMES.HEAD_STOREKEEPER || role === ROLE_NAMES.STOCK_KEEPER) {
    return [
      {
        requiredRoleName: ROLE_NAMES.OPERATIONS_MANAGER,
        requiredPermission: 'purchase.approve',
        stepOrder: 1,
      },
      {
        requiredRoleName: ROLE_NAMES.ADMIN,
        requiredPermission: 'purchase.approve',
        stepOrder: 2,
      },
    ];
  }

  // Purchaser and other writers: Storekeeper + Admin
  return [
    {
      requiredRoleName: ROLE_NAMES.HEAD_STOREKEEPER,
      requiredPermission: 'purchase.approve',
      stepOrder: 1,
    },
    {
      requiredRoleName: ROLE_NAMES.ADMIN,
      requiredPermission: 'purchase.approve',
      stepOrder: 2,
    },
  ];
}

/** Sales: Storekeeper + Operations Manager before stock out (Admin bypass). */
export function saleApprovalSteps(
  initiatorRoleName: string | null | undefined,
): ApprovalStepDef[] {
  if (initiatorRoleName === ROLE_NAMES.ADMIN) return [];
  return [
    {
      requiredRoleName: ROLE_NAMES.HEAD_STOREKEEPER,
      requiredPermission: 'sales.approve',
      stepOrder: 1,
    },
    {
      requiredRoleName: ROLE_NAMES.OPERATIONS_MANAGER,
      requiredPermission: 'sales.approve',
      stepOrder: 2,
    },
  ];
}

/** Cleaning process: Operations Manager must approve before start. */
export function cleaningApprovalSteps(
  initiatorRoleName: string | null | undefined,
): ApprovalStepDef[] {
  if (initiatorRoleName === ROLE_NAMES.ADMIN) return [];
  return [
    {
      requiredRoleName: ROLE_NAMES.OPERATIONS_MANAGER,
      requiredPermission: 'process.approve',
      stepOrder: 1,
    },
  ];
}

export function isCleaningProcess(opts: {
  initiatorRoleName?: string | null;
  templateCode?: string | null;
  templateName?: string | null;
  stages?: string[] | null;
}): boolean {
  const role = opts.initiatorRoleName ?? '';
  if (role === ROLE_NAMES.CLEANING_TEAM_HEAD) return true;
  const code = (opts.templateCode ?? '').toUpperCase();
  const name = (opts.templateName ?? '').toLowerCase();
  if (code.includes('CLEAN') || name.includes('clean')) return true;
  const stages = opts.stages ?? [];
  if (stages.some((s) => s.toLowerCase().includes('clean'))) return true;
  return false;
}
