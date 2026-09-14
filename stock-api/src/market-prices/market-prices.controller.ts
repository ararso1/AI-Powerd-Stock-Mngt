import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { MarketPricesService } from './market-prices.service';

@Controller('market-prices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarketPricesController {
  constructor(private readonly service: MarketPricesService) {}

  @Get('current')
  @RequirePermissions('market_prices.read', 'dashboard.read', 'insights.read')
  current() {
    return this.service.getCurrent();
  }

  @Get('history')
  @RequirePermissions('market_prices.read', 'dashboard.read', 'insights.read')
  history(
    @Query('symbol') symbol = 'KC',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getHistory(symbol, from, to);
  }

  @Get('grades')
  @RequirePermissions('market_prices.read', 'dashboard.read', 'insights.read')
  grades() {
    return this.service.listGradeBasis();
  }

  @Get('grade-price')
  @RequirePermissions('market_prices.read', 'export.read', 'insights.read')
  gradePrice(
    @Query('grade') grade = 'G1',
    @Query('coffeeType') coffeeType = 'ARABICA',
  ) {
    return this.service.pricedGrade(grade, coffeeType);
  }

  @Get('valuation')
  @RequirePermissions('market_prices.read', 'inventory.read', 'insights.read')
  valuation() {
    return this.service.inventoryValuation();
  }

  @Get('export-guidance')
  @RequirePermissions('market_prices.read', 'export.read', 'insights.read')
  exportGuidance() {
    return this.service.exportGuidance();
  }

  @Get('dashboard')
  @RequirePermissions('market_prices.read', 'dashboard.read', 'insights.read')
  dashboard() {
    return this.service.getDashboardMarket();
  }

  @Post('sync')
  @RequirePermissions('market_prices.write')
  sync() {
    return this.service.syncPrices();
  }
}
