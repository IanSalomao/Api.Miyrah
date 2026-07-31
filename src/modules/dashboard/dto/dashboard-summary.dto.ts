import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({
    description: 'Entradas no período filtrado (magnitude, sempre positivo)',
    example: 5000.0,
  })
  income!: number;

  @ApiProperty({
    description: 'Saídas no período filtrado (magnitude, sempre positivo)',
    example: 3200.0,
  })
  expense!: number;

  @ApiProperty({
    description: 'income − expense do período filtrado',
    example: 1800.0,
  })
  periodBalance!: number;

  @ApiProperty({
    description: 'Quantidade de transações de entrada no período',
    example: 42,
  })
  incomeCount!: number;

  @ApiProperty({
    description: 'Quantidade de transações de saída no período',
    example: 30,
  })
  expenseCount!: number;

  @ApiProperty({
    description: 'Total de transações do período (incomeCount + expenseCount)',
    example: 72,
  })
  transactionsCount!: number;
}
