import { ApiProperty } from '@nestjs/swagger';

export class DashboardCountsDto {
  @ApiProperty({
    description: 'Quantidade de membros ativos (deletedAt nulo)',
    example: 87,
  })
  membersCount!: number;

  @ApiProperty({
    description: 'Quantidade de ministérios ativos (deletedAt nulo)',
    example: 6,
  })
  ministriesCount!: number;

  @ApiProperty({
    description: 'Quantidade de categorias ativas (deletedAt nulo)',
    example: 14,
  })
  categoriesCount!: number;
}
