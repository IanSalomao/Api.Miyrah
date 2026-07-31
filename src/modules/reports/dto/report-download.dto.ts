import { ApiProperty } from '@nestjs/swagger';

export class ReportDownloadDto {
  @ApiProperty({
    description: 'Link temporário assinado para baixar o PDF',
    example: 'https://storage.miyrah.com/reports/f6d1a4f5.../signed?...',
  })
  downloadUrl!: string;

  @ApiProperty({ example: '2026-07-10T15:00:00.000Z' })
  expiresAt!: string;
}
