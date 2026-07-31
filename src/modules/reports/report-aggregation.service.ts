import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { TransactionType } from '../../../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildMonthlyBuckets,
  categoryBreakdown,
  monthKey,
  round2,
  toIsoDate,
} from './report-aggregation.helpers';
import type {
  CategoryValue,
  MinistryGroup,
  MonthlyPoint,
  SummaryData,
  TransactionRow,
} from './report-payload';

export interface PeriodRange {
  from: Date;
  to: Date;
}

const NO_MINISTRY_LABEL = 'Sem ministério';

/**
 * Agregadores dos blocos do relatório. Todas as leituras usam `prisma.tenant`
 * (escopo por churchId automático) e aceitam o filtro global `categoryIds`.
 * Espelha os agregadores do Dashboard e adiciona o agrupamento por ministério
 * (genuinamente novo — o Dashboard não agrupa por ministério).
 */
@Injectable()
export class ReportAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(
    range: PeriodRange,
    categoryIds?: string[],
  ): Prisma.TransactionWhereInput {
    return {
      deletedAt: null,
      date: { gte: range.from, lte: range.to },
      ...(categoryIds?.length && { categoryId: { in: categoryIds } }),
    };
  }

  /** Entradas/Saídas por categoria (tabela + pizza usam o mesmo dado). */
  async byCategory(
    type: TransactionType,
    range: PeriodRange,
    categoryIds?: string[],
  ): Promise<CategoryValue[]> {
    const rows = await this.prisma.tenant.transaction.findMany({
      where: { ...this.baseWhere(range, categoryIds), type },
      select: {
        value: true,
        category: { select: { id: true, name: true, color: true } },
      },
    });
    return categoryBreakdown(
      rows.map((row) => ({ value: Number(row.value), category: row.category })),
    );
  }

  /** Saídas/Entradas por ministério, sub-agrupadas por categoria (+ subtotal). */
  async byMinistry(
    type: TransactionType,
    range: PeriodRange,
    categoryIds?: string[],
  ): Promise<MinistryGroup[]> {
    const rows = await this.prisma.tenant.transaction.findMany({
      where: { ...this.baseWhere(range, categoryIds), type },
      select: {
        value: true,
        ministry: { select: { name: true } },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    interface Group {
      ministry: string;
      subtotal: number;
      categories: Map<string, CategoryValue>;
    }
    const groups = new Map<string, Group>();

    for (const row of rows) {
      const ministryName = row.ministry?.name ?? NO_MINISTRY_LABEL;
      const group = groups.get(ministryName) ?? {
        ministry: ministryName,
        subtotal: 0,
        categories: new Map<string, CategoryValue>(),
      };
      const magnitude = Math.abs(Number(row.value));
      group.subtotal += magnitude;
      const category = group.categories.get(row.category.id) ?? {
        name: row.category.name,
        color: row.category.color,
        value: 0,
      };
      category.value += magnitude;
      group.categories.set(row.category.id, category);
      groups.set(ministryName, group);
    }

    return [...groups.values()]
      .map((group) => ({
        ministry: group.ministry,
        subtotal: round2(group.subtotal),
        byCategory: [...group.categories.values()]
          .sort((a, b) => b.value - a.value)
          .map((category) => ({ ...category, value: round2(category.value) })),
      }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }

  /** Histórico mensal (barras): magnitude por mês, buckets contínuos do período. */
  async monthlyChart(
    type: TransactionType,
    range: PeriodRange,
    categoryIds?: string[],
  ): Promise<MonthlyPoint[]> {
    const rows = await this.prisma.tenant.transaction.findMany({
      where: { ...this.baseWhere(range, categoryIds), type },
      select: { date: true, value: true },
    });

    const totals = new Map<string, number>();
    for (const row of rows) {
      const key = monthKey(row.date);
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(Number(row.value)));
    }

    return buildMonthlyBuckets(range.from, range.to).map((bucket) => ({
      label: bucket.label,
      value: round2(totals.get(bucket.key) ?? 0),
    }));
  }

  /** Balanço: saldo anterior (com sinal) + entradas − saídas = saldo final. */
  async summary(
    range: PeriodRange,
    categoryIds?: string[],
  ): Promise<SummaryData> {
    const categoryFilter = categoryIds?.length
      ? { categoryId: { in: categoryIds } }
      : {};

    const [previousRows, periodRows] = await Promise.all([
      this.prisma.tenant.transaction.findMany({
        where: { deletedAt: null, date: { lt: range.from }, ...categoryFilter },
        select: { value: true },
      }),
      this.prisma.tenant.transaction.findMany({
        where: this.baseWhere(range, categoryIds),
        select: { value: true, type: true },
      }),
    ]);

    const previousBalance = previousRows.reduce(
      (sum, row) => sum + Number(row.value),
      0,
    );

    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of periodRows) {
      if (row.type === TransactionType.income) {
        totalIncome += Number(row.value);
      } else {
        totalExpense += Math.abs(Number(row.value));
      }
    }

    return {
      previousBalance: round2(previousBalance),
      totalIncome: round2(totalIncome),
      totalExpense: round2(totalExpense),
      finalBalance: round2(previousBalance + totalIncome - totalExpense),
    };
  }

  /** Todas as linhas do período (não paginada). `member` só quando autorizado. */
  async transactionList(
    range: PeriodRange,
    categoryIds: string[] | undefined,
    includeMember: boolean,
  ): Promise<TransactionRow[]> {
    const rows = await this.prisma.tenant.transaction.findMany({
      where: this.baseWhere(range, categoryIds),
      orderBy: { date: 'asc' },
      select: {
        date: true,
        description: true,
        value: true,
        category: { select: { name: true } },
        member: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      date: toIsoDate(row.date),
      description: row.description,
      category: row.category.name,
      // Privacidade: o nome do membro só entra no payload/PDF com senha confirmada.
      ...(includeMember && { member: row.member?.name ?? null }),
      value: round2(Number(row.value)),
    }));
  }
}
