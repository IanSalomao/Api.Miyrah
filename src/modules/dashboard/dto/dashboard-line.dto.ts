import { ApiProperty } from '@nestjs/swagger';
import { DASHBOARD_LINE_GRANULARITY_OPTIONS } from './dashboard-query.constants';
import { DashboardLinePointDto } from './dashboard-line-point.dto';

export class DashboardLineDto {
  @ApiProperty({ enum: DASHBOARD_LINE_GRANULARITY_OPTIONS })
  granularity!: 'day' | 'week';

  @ApiProperty({
    description: 'Série contínua de pontos (sem lacunas) do intervalo filtrado',
    type: () => DashboardLinePointDto,
    isArray: true,
  })
  line!: DashboardLinePointDto[];
}
