import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

/**
 * dateFrom/dateTo são semanticamente obrigatórios e sua presença/ordem é
 * validada no service (DashboardService.getBalanceVariation), para poder
 * produzir a mensagem combinada exigida pelo contrato — aqui só se valida
 * o formato, quando presentes.
 */
export class DashboardBalanceVariationQueryDto {
  @ApiPropertyOptional({
    description: 'Data inicial da comparação',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom deve ser uma data válida.' })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Data final da comparação',
    example: '2026-07-23',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateTo deve ser uma data válida.' })
  dateTo?: string;
}
