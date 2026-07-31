import { ApiProperty } from '@nestjs/swagger';
import { ReportParamsDto } from './report-params.dto';

export class ReportListItemDto {
  @ApiProperty({ example: 'f6d1a4f5-3e7f-4081-9c4f-6d7e8f9a0b1c' })
  id!: string;

  @ApiProperty({ example: '2026-07-10T14:30:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ type: () => ReportParamsDto })
  params!: ReportParamsDto;
}
