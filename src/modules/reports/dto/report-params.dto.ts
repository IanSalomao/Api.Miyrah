import { ApiProperty } from '@nestjs/swagger';
import { REPORT_SECTIONS } from '../constants/report-sections.constant';

/**
 * Snapshot da configuração usada na geração (coluna `params`). Nunca guarda a
 * senha do "Incluir Membro" — ela só trafega no POST e não é armazenada.
 */
export class ReportParamsDto {
  @ApiProperty({ example: '2026-07-01' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-07-31' })
  dateTo!: string;

  @ApiProperty({ type: [String], example: [] })
  categoryIds!: string[];

  @ApiProperty({ enum: REPORT_SECTIONS, isArray: true })
  sections!: string[];

  @ApiProperty({ example: true })
  includeMember!: boolean;
}
