import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { IsAfterOrEqualDate } from '../../../common/decorators/is-after-or-equal-date.decorator';
import { DASHBOARD_PERIODS } from './dashboard-query.constants';
import type { DashboardPeriod } from './dashboard-query.constants';
import { ValidateCustomPeriodRange } from './validate-custom-period-range.decorator';

/**
 * Base comum a todo endpoint de dashboard filtrado por período: period,
 * dateFrom/dateTo (obrigatórios só quando period=custom), categoryIds e
 * ministryId. Reaproveitada por summary, line, by-category e comparison.
 */
export abstract class DashboardPeriodFilterQueryDto {
  @ApiPropertyOptional({
    enum: DASHBOARD_PERIODS,
    default: 'currentMonth',
  })
  @IsOptional()
  @IsIn(DASHBOARD_PERIODS, { message: 'period inválido.' })
  @ValidateCustomPeriodRange()
  period: DashboardPeriod = 'currentMonth';

  @ApiPropertyOptional({
    description: 'Início do intervalo (obrigatório se period=custom)',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateFrom deve ser uma data válida.' })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Fim do intervalo (obrigatório se period=custom)',
    example: '2026-07-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateTo deve ser uma data válida.' })
  @IsAfterOrEqualDate('dateFrom', {
    message: 'dateTo não pode ser anterior a dateFrom.',
  })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'uuids de categorias separados por vírgula',
    example: 'd3a8e1d2-0b4c-4d5f-9e1c-3a4b5c6d7e8f',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray({
    message: 'categoryIds deve ser uma lista de uuids separada por vírgula.',
  })
  @IsUUID('4', {
    each: true,
    message: 'categoryIds deve conter uuids válidos.',
  })
  categoryIds?: string[];

  @ApiPropertyOptional({
    description: 'Filtra por um ministério (oculta transações sem vínculo)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ministryId deve ser um uuid válido.' })
  ministryId?: string;
}
