import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DashboardPeriodFilterQueryDto } from './dashboard-period-filter-query.dto';
import { DASHBOARD_TRANSACTION_TYPE_FILTERS } from './dashboard-query.constants';
import type { DashboardTransactionTypeFilter } from './dashboard-query.constants';

export class DashboardByCategoryQueryDto extends DashboardPeriodFilterQueryDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_TRANSACTION_TYPE_FILTERS,
    default: 'all',
  })
  @IsOptional()
  @IsIn(DASHBOARD_TRANSACTION_TYPE_FILTERS, { message: 'type inválido.' })
  type: DashboardTransactionTypeFilter = 'all';
}
