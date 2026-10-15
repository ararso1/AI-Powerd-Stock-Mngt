import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalRequest } from '../database/entities/approval-request.entity';
import { ApprovalStep } from '../database/entities/approval-step.entity';
import { UserLocation } from '../database/entities/user-location.entity';
import { User } from '../database/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProcessRunsModule } from '../process-runs/process-runs.module';
import { PurchasesModule } from '../purchases/purchases.module';
import { SalesModule } from '../sales/sales.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { UserLocationAccessService } from './user-location-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalRequest,
      ApprovalStep,
      UserLocation,
      User,
    ]),
    NotificationsModule,
    forwardRef(() => PurchasesModule),
    forwardRef(() => SalesModule),
    forwardRef(() => ProcessRunsModule),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, UserLocationAccessService],
  exports: [ApprovalsService, UserLocationAccessService],
})
export class ApprovalsModule {}
