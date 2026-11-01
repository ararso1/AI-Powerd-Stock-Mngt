import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ProfitLossService } from '../profit-loss/profit-loss.service';
import {
  findReport,
  REPORT_CATALOG,
  REPORT_IDS,
} from './report-catalog';
import { ReportExportService } from './report-export.service';
import { ReportQueryDto } from './report-query.dto';
import { tableFromReportPayload } from './report-table.util';
import { ReportsOpsService } from './reports-ops.service';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly ops: ReportsOpsService,
    private readonly exportService: ReportExportService,
    private readonly profitLoss: ProfitLossService,
  ) {}

  @Get('catalog')
  @RequirePermissions('reports.read')
  catalog() {
    return { reports: REPORT_CATALOG };
  }

  @Get('summary')
  @RequirePermissions('reports.read')
  summary(@Query() query: ReportQueryDto) {
    return this.reportsService.summary(query);
  }

  /** @deprecated use GET /reports/summary */
  @Get('financial-summary')
  @RequirePermissions('reports.read')
  financialSummary(@Query() query: ReportQueryDto) {
    return this.reportsService.summary(query);
  }

  @Get('sales')
  @RequirePermissions('reports.read')
  sales(@Query() query: ReportQueryDto) {
    return this.reportsService.sales(query);
  }

  @Get('purchases')
  @RequirePermissions('reports.read')
  purchases(@Query() query: ReportQueryDto) {
    return this.reportsService.purchases(query);
  }

  @Get('expenses')
  @RequirePermissions('reports.read')
  expenses(@Query() query: ReportQueryDto) {
    return this.reportsService.expenses(query);
  }

  @Get('sales-by-item')
  @RequirePermissions('reports.read')
  salesByItem(@Query() query: ReportQueryDto) {
    return this.reportsService.salesByItem(query);
  }

  @Get('purchases-by-item')
  @RequirePermissions('reports.read')
  purchasesByItem(@Query() query: ReportQueryDto) {
    return this.reportsService.purchasesByItem(query);
  }

  @Get('inventory-aging')
  @RequirePermissions('reports.read')
  inventoryAging(@Query() query: ReportQueryDto) {
    return this.reportsService.inventoryAging(query);
  }

  @Get('inventory-on-hand')
  @RequirePermissions('reports.read')
  inventoryOnHand(@Query() query: ReportQueryDto) {
    return this.ops.inventoryOnHand(query);
  }

  @Get('inventory-adjustments')
  @RequirePermissions('reports.read')
  inventoryAdjustments(@Query() query: ReportQueryDto) {
    return this.ops.inventoryAdjustments(query);
  }

  @Get('transfers')
  @RequirePermissions('reports.read')
  transfers(@Query() query: ReportQueryDto) {
    return this.ops.transfers(query);
  }

  @Get('lots')
  @RequirePermissions('reports.read')
  lots(@Query() query: ReportQueryDto) {
    return this.ops.lots(query);
  }

  @Get('collections')
  @RequirePermissions('reports.read')
  collections(@Query() query: ReportQueryDto) {
    return this.ops.collections(query);
  }

  @Get('process-yield')
  @RequirePermissions('reports.read')
  processYield(@Query() query: ReportQueryDto) {
    return this.ops.processYield(query);
  }

  @Get('exports-pipeline')
  @RequirePermissions('reports.read')
  exportsPipeline(@Query() query: ReportQueryDto) {
    return this.ops.exportsPipeline(query);
  }

  @Get('banks')
  @RequirePermissions('reports.read')
  banks(@Query() query: ReportQueryDto) {
    return this.ops.banks(query);
  }

  @Get('approvals')
  @RequirePermissions('reports.read')
  approvals(@Query() query: ReportQueryDto) {
    return this.ops.approvals(query);
  }

  @Get('hr-headcount')
  @RequirePermissions('reports.read')
  hrHeadcount(@Query() query: ReportQueryDto) {
    return this.ops.hrHeadcount(query);
  }

  @Get('market-snapshot')
  @RequirePermissions('reports.read')
  marketSnapshot(@Query() query: ReportQueryDto) {
    return this.ops.marketSnapshot(query);
  }

  @Get('customer-activity')
  @RequirePermissions('reports.read')
  customerActivity(@Query() query: ReportQueryDto) {
    return this.reportsService.customerActivity(query);
  }

  @Get('supplier-activity')
  @RequirePermissions('reports.read')
  supplierActivity(@Query() query: ReportQueryDto) {
    return this.reportsService.supplierActivity(query);
  }

  @Get('commissions')
  @RequirePermissions('reports.read')
  commissions(@Query() query: ReportQueryDto) {
    return this.reportsService.commissions(query);
  }

  @Get('credits')
  @RequirePermissions('reports.read')
  credits(@Query() query: ReportQueryDto) {
    return this.reportsService.credits(query);
  }

  @Get('cash-flow')
  @RequirePermissions('reports.read')
  cashFlow(@Query() query: ReportQueryDto) {
    return this.reportsService.cashFlow(query);
  }

  @Get(':reportId/export.csv')
  @RequirePermissions('reports.read')
  async exportCsv(
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const { meta, payload } = await this.resolveReport(reportId, query);
    const table = tableFromReportPayload(
      reportId,
      meta.title,
      payload as Record<string, unknown>,
      (payload as { period?: { from?: string | null; to?: string | null } })
        .period,
    );
    const body = this.exportService.toCsv(table);
    const filename = this.exportService.filename(
      reportId,
      'csv',
      query.from,
      query.to,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Get(':reportId/export.pdf')
  @RequirePermissions('reports.read')
  async exportPdf(
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const { meta, payload } = await this.resolveReport(reportId, query);
    const table = tableFromReportPayload(
      reportId,
      meta.title,
      payload as Record<string, unknown>,
      (payload as { period?: { from?: string | null; to?: string | null } })
        .period,
    );
    const body = await this.exportService.toPdf(table);
    const filename = this.exportService.filename(
      reportId,
      'pdf',
      query.from,
      query.to,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  }

  @Get(':reportId')
  @RequirePermissions('reports.read')
  async byId(
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
  ) {
    const { meta, payload } = await this.resolveReport(reportId, query);
    return { report: meta, data: payload };
  }

  private async resolveReport(reportId: string, query: ReportQueryDto) {
    if (!REPORT_IDS.includes(reportId)) {
      throw new NotFoundException(`Unknown report: ${reportId}`);
    }
    const meta = findReport(reportId)!;
    let payload: unknown;
    switch (reportId) {
      case 'summary':
        payload = await this.reportsService.summary(query);
        break;
      case 'profit-loss':
        payload = {
          ...(await this.profitLoss.summary(query.from, query.to)),
          period: { from: query.from ?? null, to: query.to ?? null },
          items: await this.profitLoss.byItem(query.from, query.to),
        };
        break;
      case 'sales':
        payload = await this.reportsService.sales(query);
        break;
      case 'purchases':
        payload = await this.reportsService.purchases(query);
        break;
      case 'expenses':
        payload = await this.reportsService.expenses(query);
        break;
      case 'sales-by-item':
        payload = await this.reportsService.salesByItem(query);
        break;
      case 'purchases-by-item':
        payload = await this.reportsService.purchasesByItem(query);
        break;
      case 'inventory-aging':
        payload = await this.reportsService.inventoryAging(query);
        break;
      case 'inventory-on-hand':
        payload = await this.ops.inventoryOnHand(query);
        break;
      case 'inventory-adjustments':
        payload = await this.ops.inventoryAdjustments(query);
        break;
      case 'transfers':
        payload = await this.ops.transfers(query);
        break;
      case 'lots':
        payload = await this.ops.lots(query);
        break;
      case 'collections':
        payload = await this.ops.collections(query);
        break;
      case 'process-yield':
        payload = await this.ops.processYield(query);
        break;
      case 'exports-pipeline':
        payload = await this.ops.exportsPipeline(query);
        break;
      case 'banks':
        payload = await this.ops.banks(query);
        break;
      case 'approvals':
        payload = await this.ops.approvals(query);
        break;
      case 'hr-headcount':
        payload = await this.ops.hrHeadcount(query);
        break;
      case 'market-snapshot':
        payload = await this.ops.marketSnapshot(query);
        break;
      case 'customer-activity':
        payload = await this.reportsService.customerActivity(query);
        break;
      case 'supplier-activity':
        payload = await this.reportsService.supplierActivity(query);
        break;
      case 'commissions':
        payload = await this.reportsService.commissions(query);
        break;
      case 'credits':
        payload = await this.reportsService.credits(query);
        break;
      case 'cash-flow':
        payload = await this.reportsService.cashFlow(query);
        break;
      default:
        throw new BadRequestException(`Report not implemented: ${reportId}`);
    }
    return { meta, payload };
  }
}
