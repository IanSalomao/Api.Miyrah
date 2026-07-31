import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../../generated/prisma/client';
import {
  AppException,
  ErrorDetail,
} from '../../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  REPORT_RENDERER,
  type ReportRenderer,
} from './clients/report-renderer';
import { REPORT_STORAGE, type ReportStorage } from './clients/report-storage';
import type { ReportSection } from './constants/report-sections.constant';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReportPayloadBuilder } from './report-payload.builder';

interface ReportParamsSnapshot {
  dateFrom: string;
  dateTo: string;
  categoryIds: string[];
  sections: ReportSection[];
  includeMember: boolean;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payloadBuilder: ReportPayloadBuilder,
    @Inject(REPORT_RENDERER) private readonly renderer: ReportRenderer,
    @Inject(REPORT_STORAGE) private readonly storage: ReportStorage,
  ) {}

  async create(churchId: string, dto: CreateReportDto) {
    const includeMember = dto.includeMember ?? false;

    // 1. Regra do "Incluir Membro" (400) — antes de qualquer trabalho.
    this.assertIncludeMemberRules(dto, includeMember);

    // 2. Reautenticação do dado sensível (401) — antes de invocar a Lambda.
    if (includeMember) {
      await this.assertCurrentPassword(churchId, dto.currentPassword as string);
    }

    const church = await this.prisma.unscoped.church.findFirst({
      where: { id: churchId, deletedAt: null },
      select: { name: true },
    });

    // 3. Monta o payload agregado (só os blocos pedidos).
    const payload = await this.payloadBuilder.build({
      churchId,
      churchName: church!.name,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      categoryIds: dto.categoryIds,
      sections: dto.sections,
      includeMember,
    });

    // 4. Renderiza ANTES de gravar: falha da Lambda → 5xx e nenhum registro órfão.
    const { key } = await this.renderer.render(payload);

    // 5. Só agora persiste o histórico (com o snapshot da config).
    const snapshot: ReportParamsSnapshot = {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      categoryIds: dto.categoryIds ?? [],
      sections: dto.sections,
      includeMember,
    };
    const report = await this.prisma.tenant.report.create({
      // churchId é exigido pelo tipo, mas a tenant extension o descarta e
      // reinjeta o valor do contexto (o mesmo churchId) — é seguro passá-lo.
      data: {
        churchId,
        filePath: key,
        params: snapshot as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, generatedAt: true },
    });

    // 6. Link de download inicial.
    const download = await this.storage.getSignedDownloadUrl(key);

    return {
      id: report.id,
      generatedAt: report.generatedAt.toISOString(),
      downloadUrl: download.downloadUrl,
      expiresAt: download.expiresAt,
    };
  }

  async findAll(query: ListReportsQueryDto) {
    const { page, limit } = query;
    const [data, total] = await this.prisma.tenant.$transaction([
      this.prisma.tenant.report.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        select: { id: true, generatedAt: true, params: true },
      }),
      this.prisma.tenant.report.count(),
    ]);

    return {
      items: data.map((report) => ({
        id: report.id,
        generatedAt: report.generatedAt.toISOString(),
        params: report.params,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDownload(id: string) {
    // Escopo por tenant: relatório de outra igreja simplesmente não é encontrado
    // (404, nunca 403) — o filePath interno nunca é exposto.
    const report = await this.prisma.tenant.report.findFirst({
      where: { id },
      select: { filePath: true },
    });
    if (!report) {
      throw new AppException(
        'RESOURCE_NOT_FOUND',
        'Relatório não encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.storage.getSignedDownloadUrl(report.filePath);
  }

  private assertIncludeMemberRules(
    dto: CreateReportDto,
    includeMember: boolean,
  ): void {
    if (!includeMember) return;

    const details: ErrorDetail[] = [];
    if (!dto.sections.includes('transactionList')) {
      details.push({
        field: 'includeMember',
        message: 'Só é permitido quando "transactionList" está em sections.',
      });
    }
    if (!dto.currentPassword) {
      details.push({
        field: 'currentPassword',
        message: 'A senha atual é obrigatória para incluir o membro.',
      });
    }
    if (details.length > 0) {
      throw new AppException(
        'VALIDATION_ERROR',
        'includeMember exige o bloco "transactionList" selecionado e a senha atual.',
        HttpStatus.BAD_REQUEST,
        details,
      );
    }
  }

  private async assertCurrentPassword(
    churchId: string,
    currentPassword: string,
  ): Promise<void> {
    const church = await this.prisma.unscoped.church.findFirst({
      where: { id: churchId, deletedAt: null },
      select: { password: true },
    });
    const matches =
      church && (await bcrypt.compare(currentPassword, church.password));
    if (!matches) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        'Senha atual incorreta.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
