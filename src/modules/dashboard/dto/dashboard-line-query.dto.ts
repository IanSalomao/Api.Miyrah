import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DashboardPeriodFilterQueryDto } from './dashboard-period-filter-query.dto';
import {
  DASHBOARD_LINE_GRANULARITY_OPTIONS,
  DASHBOARD_TRANSACTION_TYPE_FILTERS,
} from './dashboard-query.constants';
import type {
  DashboardLineGranularity,
  DashboardTransactionTypeFilter,
} from './dashboard-query.constants';

export class DashboardLineQueryDto extends DashboardPeriodFilterQueryDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_LINE_GRANULARITY_OPTIONS,
    default: 'day',
  })
  @IsOptional()
  @IsIn(DASHBOARD_LINE_GRANULARITY_OPTIONS, {
    message: 'granularity deve ser "day" ou "week".',
  })
  granularity: DashboardLineGranularity = 'day';

  @ApiPropertyOptional({
    enum: DASHBOARD_TRANSACTION_TYPE_FILTERS,
    default: 'all',
  })
  @IsOptional()
  @IsIn(DASHBOARD_TRANSACTION_TYPE_FILTERS, { message: 'type inválido.' })
  type: DashboardTransactionTypeFilter = 'all';
}
