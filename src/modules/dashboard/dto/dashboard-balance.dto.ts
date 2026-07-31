import { ApiProperty } from '@nestjs/swagger';

export class DashboardBalanceDto {
  @ApiProperty({
    description:
      'Saldo líquido acumulado de todo o histórico de transações da igreja, até agora',
    example: 18500.0,
  })
  balance!: number;
}
