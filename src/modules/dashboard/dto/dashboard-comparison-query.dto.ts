import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DashboardPeriodFilterQueryDto } from './dashboard-period-filter-query.dto';
import { DASHBOARD_COMPARISON_GROUP_BY_OPTIONS } from './dashboard-query.constants';
import type { DashboardComparisonGroupBy } from './dashboard-query.constants';

export class DashboardComparisonQueryDto extends DashboardPeriodFilterQueryDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_COMPARISON_GROUP_BY_OPTIONS,
    default: 'month',
  })
  @IsOptional()
  @IsIn(DASHBOARD_COMPARISON_GROUP_BY_OPTIONS, {
    message: 'groupBy deve ser "month" ou "week".',
  })
  groupBy: DashboardComparisonGroupBy = 'month';
}
