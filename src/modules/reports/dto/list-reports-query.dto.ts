import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListReportsQueryDto {
  @ApiPropertyOptional({ description: 'Página (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page deve ser um número inteiro.' })
  @Min(1, { message: 'page deve ser maior ou igual a 1.' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Itens por página',
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit deve ser um número inteiro.' })
  @Min(1, { message: 'limit deve ser maior ou igual a 1.' })
  @Max(100, { message: 'limit não pode ser maior que 100.' })
  limit: number = 20;
}
