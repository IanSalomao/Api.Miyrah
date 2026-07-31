import { ApiProperty } from '@nestjs/swagger';
import { DashboardCategoryBreakdownDto } from './dashboard-category-breakdown.dto';

export class DashboardByCategoryDto {
  @ApiProperty({
    description: 'Entradas do período, agrupadas por categoria',
    type: () => DashboardCategoryBreakdownDto,
    isArray: true,
  })
  incomeByCategory!: DashboardCategoryBreakdownDto[];

  @ApiProperty({
    description: 'Saídas do período, agrupadas por categoria',
    type: () => DashboardCategoryBreakdownDto,
    isArray: true,
  })
  expenseByCategory!: DashboardCategoryBreakdownDto[];
}
