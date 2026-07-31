import { ApiProperty } from '@nestjs/swagger';

export class DashboardLinePointDto {
  @ApiProperty({
    description:
      'Início do ponto: o próprio dia ("YYYY-MM-DD") para granularity=day, ou o domingo que abre a semana para granularity=week',
    example: '2026-07-01',
  })
  date!: string;

  @ApiProperty({ example: 1500 })
  income!: number;

  @ApiProperty({ example: 620 })
  expense!: number;
}
