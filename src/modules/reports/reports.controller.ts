import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { ApiSuccessResponse } from '../../common/decorators/api-success-response.decorator';
import { CurrentChurch } from '../../common/decorators/current-church.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReportCreatedDto } from './dto/report-created.dto';
import { ReportDownloadDto } from './dto/report-download.dto';
import { ReportListItemDto } from './dto/report-list-item.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({
    summary:
      'Gera um novo relatório em PDF a partir dos blocos selecionados (síncrono)',
  })
  @ApiSuccessResponse(ReportCreatedDto, {
    status: 201,
    description: 'Relatório gerado; inclui um link de download inicial.',
  })
  create(@CurrentChurch() churchId: string, @Body() dto: CreateReportDto) {
    return this.reportsService.create(churchId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista o histórico de relatórios já gerados (paginado)',
  })
  @ApiPaginatedResponse(ReportListItemDto, {
    description: 'Histórico de relatórios da igreja autenticada.',
  })
  findAll(@Query() query: ListReportsQueryDto) {
    return this.reportsService.findAll(query);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Gera, sob demanda, um novo link de download temporário do PDF',
  })
  @ApiSuccessResponse(ReportDownloadDto, {
    description: 'Novo link de download assinado.',
  })
  getDownload(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.getDownload(id);
  }
}
