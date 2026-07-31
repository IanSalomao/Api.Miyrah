import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardBalanceVariationDto } from './dto/dashboard-balance-variation.dto';
import { DashboardBalanceVariationQueryDto } from './dto/dashboard-balance-variation-query.dto';
import { DashboardBalanceDto } from './dto/dashboard-balance.dto';
import { DashboardByCategoryDto } from './dto/dashboard-by-category.dto';
import { DashboardByCategoryQueryDto } from './dto/dashboard-by-category-query.dto';
import { DashboardComparisonDto } from './dto/dashboard-comparison.dto';
import { DashboardComparisonQueryDto } from './dto/dashboard-comparison-query.dto';
import { DashboardCountsDto } from './dto/dashboard-counts.dto';
import { DashboardLineDto } from './dto/dashboard-line.dto';
import { DashboardLineQueryDto } from './dto/dashboard-line-query.dto';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('balance')
  @ApiOperation({
    summary: 'Card Saldo — saldo acumulado de todo o histórico, sem filtros',
  })
  @ApiSuccessResponse(DashboardBalanceDto, {
    description: 'Saldo em conta corrente.',
  })
  getBalance() {
    return this.dashboardService.getBalance();
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Cards Entradas/Saídas/Balanço do período (sem o saldo em conta)',
  })
  @ApiSuccessResponse(DashboardSummaryDto, {
    description: 'Métricas financeiras agregadas do período filtrado.',
  })
  getSummary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query);
  }

  @Get('counts')
  @ApiOperation({
    summary: 'Contagens gerais de cadastro (membros, ministérios, categorias)',
  })
  @ApiSuccessResponse(DashboardCountsDto, {
    description: 'Totais correntes de cadastro da igreja.',
  })
  getCounts() {
    return this.dashboardService.getCounts();
  }

  @Get('balance-variation')
  @ApiOperation({
    summary: 'Variação percentual do saldo em conta entre duas datas',
  })
  @ApiSuccessResponse(DashboardBalanceVariationDto, {
    description: 'Saldo em duas datas e a variação percentual entre elas.',
  })
  getBalanceVariation(@Query() query: DashboardBalanceVariationQueryDto) {
    return this.dashboardService.getBalanceVariation(query);
  }

  @Get('line')
  @ApiOperation({
    summary:
      'Gráfico de linha — série temporal de entradas/saídas (granularidade diária ou semanal)',
  })
  @ApiSuccessResponse(DashboardLineDto, {
    description: 'Série contínua de pontos do período filtrado.',
  })
  getLine(@Query() query: DashboardLineQueryDto) {
    return this.dashboardService.getLine(query);
  }

  @Get('by-category')
  @ApiOperation({
    summary:
      'Gráficos de pizza — entradas e saídas por categoria no período filtrado',
  })
  @ApiSuccessResponse(DashboardByCategoryDto, {
    description: 'Totais agregados por categoria, separados por tipo.',
  })
  getByCategory(@Query() query: DashboardByCategoryQueryDto) {
    return this.dashboardService.getByCategory(query);
  }

  @Get('comparison')
  @ApiOperation({
    summary:
      'Série agregada de entradas/saídas por período (mensal ou semanal) para o gráfico de barras comparativas',
  })
  @ApiSuccessResponse(DashboardComparisonDto, {
    description:
      'Buckets contínuos do período e comparação com a média dos anteriores.',
  })
  getComparison(@Query() query: DashboardComparisonQueryDto) {
    return this.dashboardService.getComparison(query);
  }
}
