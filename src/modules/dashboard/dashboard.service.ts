import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, TransactionType } from '../../../generated/prisma/client';
import {
  AppException,
  ErrorDetail,
} from '../../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardBalanceVariationQueryDto } from './dto/dashboard-balance-variation-query.dto';
import { DashboardByCategoryQueryDto } from './dto/dashboard-by-category-query.dto';
import { DashboardComparisonQueryDto } from './dto/dashboard-comparison-query.dto';
import { DashboardLineQueryDto } from './dto/dashboard-line-query.dto';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';
import {
  DashboardComparisonGroupBy,
  DashboardPeriod,
  DashboardTransactionTypeFilter,
} from './dto/dashboard-query.constants';

const MONTHS_BACK_BY_PERIOD: Partial<Record<DashboardPeriod, number>> = {
  currentMonth: 0,
  last3Months: 2,
  last6Months: 5,
  last12Months: 11,
};

const MONTH_ABBREVIATIONS_PT_BR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

type PeriodRange = { from: Date; to: Date };

type PeriodFilterQuery = {
  period: DashboardPeriod;
  dateFrom?: string;
  dateTo?: string;
};

type TransactionFilters = {
  type?: DashboardTransactionTypeFilter;
  categoryIds?: string[];
  ministryId?: string;
};

type BucketStep = 'day' | 'week' | 'month';

type BucketDef = { key: string; periodStart: Date };

type SeriesRow = {
  date: Date;
  value: Prisma.Decimal | number;
  type: TransactionType;
};

type CategoryRow = {
  value: Prisma.Decimal | number;
  type: TransactionType;
  category: { id: string; name: string; color: string };
};

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance() {
    const balance = await this.saldoAte(this.today());
    return { balance: round2(balance) };
  }

  async getCounts() {
    const [membersCount, ministriesCount, categoriesCount] =
      await this.prisma.tenant.$transaction([
        this.prisma.tenant.member.count({ where: { deletedAt: null } }),
        this.prisma.tenant.ministry.count({ where: { deletedAt: null } }),
        this.prisma.tenant.category.count({ where: { deletedAt: null } }),
      ]);

    return { membersCount, ministriesCount, categoriesCount };
  }

  async getBalanceVariation(query: DashboardBalanceVariationQueryDto) {
    this.assertBalanceVariationDates(query);
    const dateFrom = new Date(query.dateFrom as string);
    const dateTo = new Date(query.dateTo as string);

    const [balanceStart, balanceEnd] = await Promise.all([
      this.saldoAte(dateFrom),
      this.saldoAte(dateTo),
    ]);

    return {
      dateFrom: query.dateFrom as string,
      dateTo: query.dateTo as string,
      balanceStart: round2(balanceStart),
      balanceEnd: round2(balanceEnd),
      percentChange: this.percentChange(balanceStart, balanceEnd),
    };
  }

  async getSummary(query: DashboardSummaryQueryDto) {
    const { from, to } = this.resolvePeriodRange(query);
    const where = this.buildTransactionWhere(query, { from, to });

    const rows = await this.prisma.tenant.transaction.findMany({
      where,
      select: { value: true, type: true },
    });

    const incomeRows = rows.filter(
      (row) => row.type === TransactionType.income,
    );
    const expenseRows = rows.filter(
      (row) => row.type === TransactionType.expense,
    );
    const income = incomeRows.reduce((sum, row) => sum + Number(row.value), 0);
    const expense = Math.abs(
      expenseRows.reduce((sum, row) => sum + Number(row.value), 0),
    );

    return {
      income: round2(income),
      expense: round2(expense),
      periodBalance: round2(income - expense),
      incomeCount: incomeRows.length,
      expenseCount: expenseRows.length,
      transactionsCount: rows.length,
    };
  }

  async getLine(query: DashboardLineQueryDto) {
    const { from, to } = this.resolvePeriodRange(query);
    const where = this.buildTransactionWhere(query, { from, to });

    const rows = await this.prisma.tenant.transaction.findMany({
      where,
      select: { date: true, value: true, type: true },
    });

    const defs = this.buildBucketDefs(from, to, query.granularity);
    const totals = this.aggregateIntoBuckets(rows, query.granularity);

    return {
      granularity: query.granularity,
      line: defs.map((def) => ({
        date: def.key,
        income: round2(totals.get(def.key)?.income ?? 0),
        expense: round2(totals.get(def.key)?.expense ?? 0),
      })),
    };
  }

  async getByCategory(query: DashboardByCategoryQueryDto) {
    const { from, to } = this.resolvePeriodRange(query);
    const where = this.buildTransactionWhere(query, { from, to });

    const rows = await this.prisma.tenant.transaction.findMany({
      where,
      select: {
        value: true,
        type: true,
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return {
      incomeByCategory: this.buildCategoryBreakdown(
        rows,
        TransactionType.income,
      ),
      expenseByCategory: this.buildCategoryBreakdown(
        rows,
        TransactionType.expense,
      ),
    };
  }

  async getComparison(query: DashboardComparisonQueryDto) {
    const { from, to } = this.resolvePeriodRange(query);
    const where = this.buildTransactionWhere(query, { from, to });

    const rows = await this.prisma.tenant.transaction.findMany({
      where,
      select: { date: true, value: true, type: true },
    });

    const defs = this.buildBucketDefs(from, to, query.groupBy);
    const totals = this.aggregateIntoBuckets(rows, query.groupBy);

    const buckets = defs.map((def) => ({
      periodStart: def.key,
      label: this.buildComparisonLabel(def.periodStart, query.groupBy),
      income: round2(totals.get(def.key)?.income ?? 0),
      expense: round2(totals.get(def.key)?.expense ?? 0),
    }));

    return {
      groupBy: query.groupBy,
      buckets,
      comparison: this.buildComparisonStats(buckets),
    };
  }

  /** Helper 4 — saldo acumulado (com sinal) de tudo que não excluído até `date`, inclusive. */
  private async saldoAte(date: Date): Promise<number> {
    const rows = await this.prisma.tenant.transaction.findMany({
      where: { deletedAt: null, date: { lte: date } },
      select: { value: true },
    });
    return rows.reduce((sum, row) => sum + Number(row.value), 0);
  }

  private percentChange(start: number, end: number): number | null {
    if (start === 0) return null;
    const raw = ((end - start) / Math.abs(start)) * 100;
    return Math.round(raw * 10) / 10;
  }

  private assertBalanceVariationDates(
    query: DashboardBalanceVariationQueryDto,
  ): void {
    const missing: ErrorDetail[] = [];
    if (!query.dateFrom) {
      missing.push({ field: 'dateFrom', message: 'dateFrom é obrigatório.' });
    }
    if (!query.dateTo) {
      missing.push({ field: 'dateTo', message: 'dateTo é obrigatório.' });
    }
    if (missing.length > 0) {
      throw new AppException(
        'VALIDATION_ERROR',
        'dateFrom e dateTo são obrigatórios.',
        HttpStatus.BAD_REQUEST,
        missing,
      );
    }

    if (new Date(query.dateFrom as string) > new Date(query.dateTo as string)) {
      throw new AppException(
        'VALIDATION_ERROR',
        'dateFrom não pode ser posterior a dateTo.',
        HttpStatus.BAD_REQUEST,
        [
          {
            field: 'dateFrom',
            message: 'dateFrom não pode ser posterior a dateTo.',
          },
        ],
      );
    }
  }

  /** Helpers 2 e 3 — categoryIds (já parseado pelo DTO) e ministryId, mais período/tipo opcionais. */
  private buildTransactionWhere(
    filters: TransactionFilters,
    range: PeriodRange,
  ): Prisma.TransactionWhereInput {
    return {
      deletedAt: null,
      ...(filters.type && filters.type !== 'all' && { type: filters.type }),
      ...(filters.categoryIds?.length && {
        categoryId: { in: filters.categoryIds },
      }),
      ...(filters.ministryId && { ministryId: filters.ministryId }),
      date: { gte: range.from, lte: range.to },
    };
  }

  /** Helper 1 — resolve o intervalo `[from, to]` efetivo a partir de period/dateFrom/dateTo. */
  private resolvePeriodRange(query: PeriodFilterQuery): PeriodRange {
    if (query.period === 'custom') {
      return {
        from: new Date(query.dateFrom as string),
        to: new Date(query.dateTo as string),
      };
    }

    const today = this.today();

    if (query.period === 'currentYear') {
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
        to: today,
      };
    }

    const monthsBack = MONTHS_BACK_BY_PERIOD[query.period] ?? 0;
    return {
      from: new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1),
      ),
      to: today,
    };
  }

  private today(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  /** Helper 5 — bucketização contínua (day/week/month), incluindo buckets vazios. */
  private buildBucketDefs(from: Date, to: Date, step: BucketStep): BucketDef[] {
    const defs: BucketDef[] = [];

    if (step === 'month') {
      const cursor = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
      );
      const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
      while (cursor.getTime() <= end.getTime()) {
        defs.push({
          key: cursor.toISOString().slice(0, 10),
          periodStart: new Date(cursor),
        });
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
      return defs;
    }

    if (step === 'week') {
      const cursor = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
      );
      cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay());
      while (cursor.getTime() <= to.getTime()) {
        defs.push({
          key: cursor.toISOString().slice(0, 10),
          periodStart: new Date(cursor),
        });
        cursor.setUTCDate(cursor.getUTCDate() + 7);
      }
      return defs;
    }

    const cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
    );
    while (cursor.getTime() <= to.getTime()) {
      defs.push({
        key: cursor.toISOString().slice(0, 10),
        periodStart: new Date(cursor),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return defs;
  }

  private bucketKeyForDate(date: Date, step: BucketStep): string {
    if (step === 'month') {
      return `${date.toISOString().slice(0, 7)}-01`;
    }
    if (step === 'week') {
      const weekStart = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
      );
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      return weekStart.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  /** Helper 6 — agrega income/expense (magnitudes positivas) por bucket, a partir do `type`. */
  private aggregateIntoBuckets(
    rows: SeriesRow[],
    step: BucketStep,
  ): Map<string, { income: number; expense: number }> {
    const buckets = new Map<string, { income: number; expense: number }>();

    for (const row of rows) {
      const key = this.bucketKeyForDate(row.date, step);
      const bucket = buckets.get(key) ?? { income: 0, expense: 0 };
      const value = Number(row.value);
      if (row.type === TransactionType.income) {
        bucket.income += value;
      } else {
        bucket.expense += Math.abs(value);
      }
      buckets.set(key, bucket);
    }

    return buckets;
  }

  private buildComparisonLabel(
    periodStart: Date,
    groupBy: DashboardComparisonGroupBy,
  ): string {
    if (groupBy === 'month') {
      const yy = String(periodStart.getUTCFullYear()).slice(-2);
      return `${MONTH_ABBREVIATIONS_PT_BR[periodStart.getUTCMonth()]}/${yy}`;
    }

    const weekEnd = new Date(periodStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const startDay = pad2(periodStart.getUTCDate());
    const endDay = pad2(weekEnd.getUTCDate());
    const startMonth =
      MONTH_ABBREVIATIONS_PT_BR[periodStart.getUTCMonth()].toLowerCase();
    const endMonth =
      MONTH_ABBREVIATIONS_PT_BR[weekEnd.getUTCMonth()].toLowerCase();

    if (
      periodStart.getUTCMonth() === weekEnd.getUTCMonth() &&
      periodStart.getUTCFullYear() === weekEnd.getUTCFullYear()
    ) {
      return `${startDay}–${endDay}/${endMonth}`;
    }
    return `${startDay}/${startMonth}–${endDay}/${endMonth}`;
  }

  private buildComparisonStats(buckets: { income: number; expense: number }[]) {
    const last = buckets[buckets.length - 1];
    const previous = buckets.slice(0, -1);
    const sampleSize = previous.length;

    const vsAvg = (
      pick: (b: { income: number; expense: number }) => number,
    ) => {
      if (sampleSize === 0) return null;
      const avg =
        previous.reduce((sum, bucket) => sum + pick(bucket), 0) / sampleSize;
      if (avg === 0) return null;
      return Math.round(((pick(last) - avg) / avg) * 1000) / 10;
    };

    return {
      sampleSize,
      incomeVsAvg: vsAvg((b) => b.income),
      expenseVsAvg: vsAvg((b) => b.expense),
    };
  }

  private buildCategoryBreakdown(rows: CategoryRow[], type: TransactionType) {
    const buckets = new Map<
      string,
      { categoryId: string; name: string; color: string; value: number }
    >();

    for (const row of rows) {
      if (row.type !== type) continue;
      const bucket = buckets.get(row.category.id) ?? {
        categoryId: row.category.id,
        name: row.category.name,
        color: row.category.color,
        value: 0,
      };
      bucket.value += Math.abs(Number(row.value));
      buckets.set(row.category.id, bucket);
    }

    return [...buckets.values()]
      .sort((a, b) => b.value - a.value)
      .map((bucket) => ({ ...bucket, value: round2(bucket.value) }));
  }
}
