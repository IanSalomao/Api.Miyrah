import { ApiProperty } from '@nestjs/swagger';

export class DashboardBalanceVariationDto {
  @ApiProperty({ example: '2026-01-01' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-23' })
  dateTo!: string;

  @ApiProperty({
    description: 'Saldo acumulado até dateFrom, inclusive',
    example: 12000.0,
  })
  balanceStart!: number;

  @ApiProperty({
    description: 'Saldo acumulado até dateTo, inclusive',
    example: 18500.0,
  })
  balanceEnd!: number;

  @ApiProperty({
    description:
      'Variação percentual entre balanceStart e balanceEnd, arredondada a 1 casa decimal (null quando balanceStart = 0)',
    example: 54.2,
    nullable: true,
  })
  percentChange!: number | null;
}
