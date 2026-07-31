import { Module } from '@nestjs/common';
import {
  LambdaReportRenderer,
  REPORT_RENDERER,
} from './clients/report-renderer';
import { REPORT_STORAGE, S3ReportStorage } from './clients/report-storage';
import { ReportAggregationService } from './report-aggregation.service';
import { ReportPayloadBuilder } from './report-payload.builder';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportAggregationService,
    ReportPayloadBuilder,
    // Renderer (Lambda) e Storage (S3) por trás de tokens → mockáveis no e2e.
    { provide: REPORT_RENDERER, useClass: LambdaReportRenderer },
    { provide: REPORT_STORAGE, useClass: S3ReportStorage },
  ],
})
export class ReportsModule {}
