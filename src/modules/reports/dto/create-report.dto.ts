import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IsAfterOrEqualDate } from '../../../common/decorators/is-after-or-equal-date.decorator';
import {
  REPORT_SECTIONS,
  type ReportSection,
} from '../constants/report-sections.constant';

export class CreateReportDto {
  @ApiProperty({ example: '2026-07-01', description: 'Início do período' })
  @IsDateString({}, { message: 'O período é obrigatório.' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31', description: 'Fim do período' })
  @IsDateString({}, { message: 'O período é obrigatório.' })
  @IsAfterOrEqualDate('dateFrom', {
    message: 'dateTo não pode ser anterior a dateFrom.',
  })
  dateTo!: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Filtro global — restringe o relatório inteiro a essas categorias',
    example: [],
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
  @IsArray({ message: 'categoryIds deve ser uma lista de uuids.' })
  @IsUUID('4', {
    each: true,
    message: 'categoryIds deve conter uuids válidos.',
  })
  categoryIds?: string[];

  @ApiProperty({
    enum: REPORT_SECTIONS,
    isArray: true,
    description: 'Chaves dos blocos a renderizar (pelo menos uma)',
    example: ['expenseByMinistry', 'transactionList'],
  })
  @IsArray({ message: 'Selecione ao menos um bloco para o relatório.' })
  @ArrayNotEmpty({ message: 'Selecione ao menos um bloco para o relatório.' })
  @IsIn(REPORT_SECTIONS, {
    each: true,
    message: 'sections contém um bloco inválido.',
  })
  sections!: ReportSection[];

  @ApiPropertyOptional({
    default: false,
    description:
      'Inclui o nome do membro em cada linha da lista de transações (exige transactionList + senha)',
  })
  @IsOptional()
  @IsBoolean({ message: 'includeMember deve ser um booleano.' })
  includeMember?: boolean = false;

  @ApiPropertyOptional({
    description: 'Senha atual — obrigatória apenas quando includeMember é true',
  })
  @IsOptional()
  @IsString({ message: 'currentPassword deve ser um texto.' })
  currentPassword?: string;
}
