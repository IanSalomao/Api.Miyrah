import { DashboardPeriodFilterQueryDto } from './dashboard-period-filter-query.dto';

/**
 * Não aceita `type`: o summary sempre reporta entradas e saídas juntas.
 */
export class DashboardSummaryQueryDto extends DashboardPeriodFilterQueryDto {}
