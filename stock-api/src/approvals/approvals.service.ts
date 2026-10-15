import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApprovalEntityType,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  NotificationType,
} from '../common/enums';
import { ROLE_NAMES } from '../database/constants/permissions';
import { ApprovalRequest } from '../database/entities/approval-request.entity';
import { ApprovalStep } from '../database/entities/approval-step.entity';
import { User } from '../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ProcessRunsService } from '../process-runs/process-runs.service';
import { PurchasesService } from '../purchases/purchases.service';
import { SalesService } from '../sales/sales.service';
import { ApprovalStepDef } from './approval-policies';
import { DecideApprovalDto } from './dto/approval.dto';
import { UserLocationAccessService } from './user-location-access.service';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalRequest)
    private readonly requestRepo: Repository<ApprovalRequest>,
    @InjectRepository(ApprovalStep)
    private readonly stepRepo: Repository<ApprovalStep>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly locationAccess: UserLocationAccessService,
    @Inject(forwardRef(() => PurchasesService))
    private readonly purchases: PurchasesService,
    @Inject(forwardRef(() => SalesService))
    private readonly sales: SalesService,
    @Inject(forwardRef(() => ProcessRunsService))
    private readonly processRuns: ProcessRunsService,
  ) {}

  async createRequest(input: {
    entityType: ApprovalEntityType;
    entityId: string;
    initiatedById?: string | null;
    steps: ApprovalStepDef[];
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    if (!input.steps.length) return null;

    const existing = await this.requestRepo.findOne({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
        status: ApprovalRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'An approval request is already pending for this document',
      );
    }

    const request = await this.requestRepo.save(
      this.requestRepo.create({
        entityType: input.entityType,
        entityId: input.entityId,
        status: ApprovalRequestStatus.PENDING,
        initiatedById: input.initiatedById ?? null,
        notes: input.notes ?? null,
        metadata: input.metadata ?? null,
        steps: input.steps.map((s) =>
          this.stepRepo.create({
            requiredRoleName: s.requiredRoleName,
            requiredPermission: s.requiredPermission,
            stepOrder: s.stepOrder,
            status: ApprovalStepStatus.PENDING,
          }),
        ),
      }),
    );

    await this.notifyPendingApprovers(request.id);
    return this.findOne(request.id);
  }

  async findOne(id: string) {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: {
        steps: { decidedBy: true },
        initiatedBy: true,
      },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    return this.serialize(request);
  }

  async findByEntity(entityType: ApprovalEntityType, entityId: string) {
    const request = await this.requestRepo.findOne({
      where: { entityType, entityId },
      relations: {
        steps: { decidedBy: true },
        initiatedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
    return request ? this.serialize(request) : null;
  }

  async listPendingForUser(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: { permissions: true } },
    });
    if (!user?.role) return { data: [] };

    const isAdmin = user.role.name === ROLE_NAMES.ADMIN;
    const roleName = user.role.name;
    const permCodes = new Set(
      (user.role.permissions ?? []).map((p) => p.code),
    );
    const canDecide =
      isAdmin ||
      permCodes.has('approvals.decide') ||
      permCodes.has('purchase.approve') ||
      permCodes.has('sales.approve') ||
      permCodes.has('process.approve');

    if (!canDecide) return { data: [] };

    const qb = this.requestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.steps', 'step')
      .leftJoinAndSelect('req.initiatedBy', 'initiator')
      .leftJoinAndSelect('step.decidedBy', 'decidedBy')
      .where('req.status = :status', { status: ApprovalRequestStatus.PENDING })
      .andWhere('step.status = :stepStatus', {
        stepStatus: ApprovalStepStatus.PENDING,
      });

    if (!isAdmin) {
      qb.andWhere('step.required_role_name = :roleName', { roleName });
    }

    const rows = await qb
      .orderBy('req.created_at', 'DESC')
      .addOrderBy('step.step_order', 'ASC')
      .getMany();

    // Deduplicate by request id (joins can duplicate)
    const seen = new Set<string>();
    const data: ReturnType<ApprovalsService['serialize']>[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      data.push(this.serialize(row));
    }
    return { data };
  }

  async listMine(userId: string) {
    const rows = await this.requestRepo.find({
      where: { initiatedById: userId },
      relations: {
        steps: { decidedBy: true },
        initiatedBy: true,
      },
      order: { createdAt: 'DESC' },
    });
    return { data: rows.map((r) => this.serialize(r)) };
  }

  async decide(requestId: string, userId: string, dto: DecideApprovalDto) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: {
        steps: true,
        initiatedBy: true,
      },
    });
    if (!request) throw new NotFoundException('Approval request not found');
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new BadRequestException('This approval request is already decided');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: { permissions: true } },
    });
    if (!user?.role) throw new ForbiddenException('No role assigned');

    const isAdmin = user.role.name === ROLE_NAMES.ADMIN;
    const permCodes = new Set(
      (user.role.permissions ?? []).map((p) => p.code),
    );

    const pendingSteps = (request.steps ?? [])
      .filter((s) => s.status === ApprovalStepStatus.PENDING)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    if (pendingSteps.length === 0) {
      throw new BadRequestException('No pending approval steps');
    }

    // Parallel approvals: decide all pending steps matching this user's role (or any if Admin)
    const actionable = pendingSteps.filter((step) => {
      if (isAdmin) return true;
      if (step.requiredRoleName !== user.role!.name) return false;
      if (
        step.requiredPermission &&
        !permCodes.has(step.requiredPermission) &&
        !permCodes.has('approvals.decide')
      ) {
        return false;
      }
      return true;
    });

    if (actionable.length === 0) {
      throw new ForbiddenException(
        'You are not authorized to decide any pending step on this request',
      );
    }

    // Prevent self-approval of remaining chain as initiator unless Admin
    if (
      !isAdmin &&
      request.initiatedById === userId &&
      dto.decision === 'approve'
    ) {
      throw new ForbiddenException(
        'Initiators cannot approve their own transaction',
      );
    }

    const now = new Date();
    if (dto.decision === 'reject') {
      for (const step of actionable) {
        step.status = ApprovalStepStatus.REJECTED;
        step.decidedById = userId;
        step.comment = dto.comment ?? null;
        step.decidedAt = now;
        await this.stepRepo.save(step);
      }
      for (const step of pendingSteps) {
        if (step.status === ApprovalStepStatus.PENDING) {
          step.status = ApprovalStepStatus.SKIPPED;
          await this.stepRepo.save(step);
        }
      }
      request.status = ApprovalRequestStatus.REJECTED;
      request.decidedAt = now;
      await this.requestRepo.save(request);

      await this.applyDomainOutcome(request, 'reject', userId);
      await this.notifyInitiator(request, 'rejected', user);
      return this.findOne(request.id);
    }

    // approve matching steps
    for (const step of actionable) {
      if (step.status !== ApprovalStepStatus.PENDING) {
        throw new BadRequestException('Step already decided');
      }
      step.status = ApprovalStepStatus.APPROVED;
      step.decidedById = userId;
      step.comment = dto.comment ?? null;
      step.decidedAt = now;
      await this.stepRepo.save(step);
    }

    const refreshed = await this.requestRepo.findOne({
      where: { id: request.id },
      relations: { steps: true, initiatedBy: true },
    });
    if (!refreshed) throw new NotFoundException('Approval request not found');

    const stillPending = (refreshed.steps ?? []).some(
      (s) => s.status === ApprovalStepStatus.PENDING,
    );

    if (stillPending) {
      await this.notifyPendingApprovers(refreshed.id);
      await this.notifyInitiator(refreshed, 'step_approved', user);
      return this.findOne(refreshed.id);
    }

    refreshed.status = ApprovalRequestStatus.APPROVED;
    refreshed.decidedAt = now;
    await this.requestRepo.save(refreshed);

    await this.applyDomainOutcome(refreshed, 'approve', userId);
    await this.notifyInitiator(refreshed, 'approved', user);
    return this.findOne(refreshed.id);
  }

  private async applyDomainOutcome(
    request: ApprovalRequest,
    decision: 'approve' | 'reject',
    actorUserId: string,
  ) {
    switch (request.entityType) {
      case ApprovalEntityType.PURCHASE:
        await this.purchases.applyApprovalOutcome(
          request.entityId,
          decision,
          actorUserId,
        );
        break;
      case ApprovalEntityType.SALE:
        await this.sales.applyApprovalOutcome(
          request.entityId,
          decision,
          actorUserId,
        );
        break;
      case ApprovalEntityType.PROCESS_RUN:
        await this.processRuns.applyApprovalOutcome(
          request.entityId,
          decision,
          actorUserId,
        );
        break;
      default:
        break;
    }
  }

  private async notifyPendingApprovers(requestId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: { steps: true, initiatedBy: true },
    });
    if (!request || request.status !== ApprovalRequestStatus.PENDING) return;

    const pendingRoles = [
      ...new Set(
        (request.steps ?? [])
          .filter((s) => s.status === ApprovalStepStatus.PENDING)
          .map((s) => s.requiredRoleName),
      ),
    ];
    if (pendingRoles.length === 0) return;

    const users =
      await this.locationAccess.findActiveUsersByRoleNames(pendingRoles);
    // Always include Admins for visibility
    const admins = await this.locationAccess.findActiveUsersByRoleNames([
      ROLE_NAMES.ADMIN,
    ]);
    const recipientIds = [
      ...new Set([...users, ...admins].map((u) => u.id)),
    ].filter((id) => id !== request.initiatedById);

    const label = this.entityLabel(request);
    await this.notifications.notifyUsers(recipientIds, {
      module: 'approvals',
      type: NotificationType.APPROVAL_PENDING,
      title: 'Approval required',
      message: `${label} is waiting for your approval`,
      entityType: 'approval_request',
      entityId: request.id,
      metadata: {
        entityType: request.entityType,
        documentId: request.entityId,
        roles: pendingRoles,
      },
    });
  }

  private async notifyInitiator(
    request: ApprovalRequest,
    outcome: 'approved' | 'rejected' | 'step_approved',
    actor: User,
  ) {
    if (!request.initiatedById) return;
    const label = this.entityLabel(request);
    const titles = {
      approved: 'Transaction approved',
      rejected: 'Transaction rejected',
      step_approved: 'Approval step completed',
    };
    const messages = {
      approved: `${label} was fully approved by ${actor.fullName}`,
      rejected: `${label} was rejected by ${actor.fullName}`,
      step_approved: `${actor.fullName} approved a step on ${label}. Waiting for remaining approvals.`,
    };
    await this.notifications.notifyUsers([request.initiatedById], {
      module: 'approvals',
      type: NotificationType.APPROVAL_DECIDED,
      title: titles[outcome],
      message: messages[outcome],
      entityType: request.entityType.toLowerCase(),
      entityId: request.entityId,
      metadata: {
        approvalRequestId: request.id,
        outcome,
        decidedBy: actor.fullName,
      },
    });
  }

  private entityLabel(request: ApprovalRequest): string {
    const meta = request.metadata ?? {};
    const ref =
      (meta.reference as string) ||
      (meta.invoiceNumber as string) ||
      (meta.runNumber as string) ||
      request.entityId.slice(0, 8);
    switch (request.entityType) {
      case ApprovalEntityType.PURCHASE:
        return `Purchase ${ref}`;
      case ApprovalEntityType.SALE:
        return `Sale ${ref}`;
      case ApprovalEntityType.PROCESS_RUN:
        return `Process run ${ref}`;
      default:
        return ref;
    }
  }

  private serialize(request: ApprovalRequest) {
    const steps = [...(request.steps ?? [])].sort(
      (a, b) => a.stepOrder - b.stepOrder,
    );
    return {
      id: request.id,
      entityType: request.entityType,
      entityId: request.entityId,
      status: request.status,
      notes: request.notes,
      metadata: request.metadata,
      initiatedById: request.initiatedById,
      initiatedBy: request.initiatedBy
        ? {
            id: request.initiatedBy.id,
            fullName: request.initiatedBy.fullName,
            email: request.initiatedBy.email,
          }
        : null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      decidedAt: request.decidedAt,
      steps: steps.map((s) => ({
        id: s.id,
        requiredRoleName: s.requiredRoleName,
        requiredPermission: s.requiredPermission,
        stepOrder: s.stepOrder,
        status: s.status,
        comment: s.comment,
        decidedAt: s.decidedAt,
        decidedById: s.decidedById,
        decidedBy: s.decidedBy
          ? {
              id: s.decidedBy.id,
              fullName: s.decidedBy.fullName,
              email: s.decidedBy.email,
            }
          : null,
      })),
    };
  }
}
