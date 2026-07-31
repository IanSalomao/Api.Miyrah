import { Injectable } from '@nestjs/common';
import { TransactionType } from '../../../generated/prisma/enums';
import {
  REPORT_SECTION_ORDER,
  type ReportSection,
} from './constants/report-sections.constant';
import {
  ReportAggregationService,
  type PeriodRange,
} from './report-aggregation.service';
import { toIsoDate } from './report-aggregation.helpers';
import type { ReportBlock, ReportMeta, ReportPayload } from './report-payload';

export interface BuildPayloadParams {
  churchId: string;
  churchName: string;
  dateFrom: string;
  dateTo: string;
  categoryIds?: string[];
  sections: ReportSection[];
  includeMember: boolean;
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA' (para os rótulos de capa/rodapé). */
function formatDateBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Monta o ReportPayload: ordena os blocos pedidos na ordem canônica (a Lambda
 * só itera) e **só computa o que foi marcado** — bloco desmarcado não dispara
 * query. A capa é implícita (a Lambda a renderiza de `meta`).
 */
@Injectable()
export class ReportPayloadBuilder {
  constructor(private readonly aggregation: ReportAggregationService) {}

  async build(params: BuildPayloadParams): Promise<ReportPayload> {
    const range: PeriodRange = {
      from: new Date(params.dateFrom),
      to: new Date(params.dateTo),
    };
    const requested = new Set(params.sections);

    const blocks: ReportBlock[] = [];
    for (const section of REPORT_SECTION_ORDER) {
      if (!requested.has(section)) continue;
      blocks.push(await this.buildBlock(section, range, params));
    }

    return { meta: this.buildMeta(params), blocks };
  }

  private async buildBlock(
    section: ReportSection,
    range: PeriodRange,
    params: BuildPayloadParams,
  ): Promise<ReportBlock> {
    const { categoryIds, includeMember } = params;
    const { income, expense } = TransactionType;

    switch (section) {
      case 'incomeByCategory':
        return {
          type: section,
          data: await this.aggregation.byCategory(income, range, categoryIds),
        };
      case 'incomeCategoryChart':
        return {
          type: section,
          data: await this.aggregation.byCategory(income, range, categoryIds),
        };
      case 'incomeByMinistry':
        return {
          type: section,
          data: await this.aggregation.byMinistry(income, range, categoryIds),
        };
      case 'incomeMonthlyChart':
        return {
          type: section,
          data: await this.aggregation.monthlyChart(income, range, categoryIds),
        };
      case 'expenseByCategory':
        return {
          type: section,
          data: await this.aggregation.byCategory(expense, range, categoryIds),
        };
      case 'expenseCategoryChart':
        return {
          type: section,
          data: await this.aggregation.byCategory(expense, range, categoryIds),
        };
      case 'expenseByMinistry':
        return {
          type: section,
          data: await this.aggregation.byMinistry(expense, range, categoryIds),
        };
      case 'expenseMonthlyChart':
        return {
          type: section,
          data: await this.aggregation.monthlyChart(
            expense,
            range,
            categoryIds,
          ),
        };
      case 'transactionList':
        return {
          type: section,
          includeMember,
          data: await this.aggregation.transactionList(
            range,
            categoryIds,
            includeMember,
          ),
        };
      case 'summary':
        return {
          type: section,
          data: await this.aggregation.summary(range, categoryIds),
        };
      default: {
        const exhaustive: never = section;
        throw new Error(
          `Seção de relatório não tratada: ${String(exhaustive)}`,
        );
      }
    }
  }

  private buildMeta(params: BuildPayloadParams): ReportMeta {
    return {
      churchId: params.churchId,
      churchName: params.churchName,
      periodLabel: `${formatDateBr(params.dateFrom)} – ${formatDateBr(params.dateTo)}`,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      generatedAtLabel: formatDateBr(toIsoDate(new Date())),
    };
  }
}
