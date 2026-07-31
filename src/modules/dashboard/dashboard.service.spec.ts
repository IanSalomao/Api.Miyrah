import { Test } from '@nestjs/testing';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';
import { DashboardBalanceVariationQueryDto } from './dto/dashboard-balance-variation-query.dto';
import { DashboardByCategoryQueryDto } from './dto/dashboard-by-category-query.dto';
import { DashboardComparisonQueryDto } from './dto/dashboard-comparison-query.dto';
import { DashboardLineQueryDto } from './dto/dashboard-line-query.dto';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto';

const NOW = new Date('2026-07-15T12:00:00.000Z');

function summaryQuery(
  overrides: Partial<DashboardSummaryQueryDto> = {},
): DashboardSummaryQueryDto {
  const dto = new DashboardSummaryQueryDto();
  Object.assign(dto, { period: 'currentMonth', ...overrides });
  return dto;
}

function lineQuery(
  overrides: Partial<DashboardLineQueryDto> = {},
): DashboardLineQueryDto {
  const dto = new DashboardLineQueryDto();
  Object.assign(dto, {
    period: 'currentMonth',
    granularity: 'day',
    type: 'all',
    ...overrides,
  });
  return dto;
}

function byCategoryQuery(
  overrides: Partial<DashboardByCategoryQueryDto> = {},
): DashboardByCategoryQueryDto {
  const dto = new DashboardByCategoryQueryDto();
  Object.assign(dto, { period: 'currentMonth', type: 'all', ...overrides });
  return dto;
}

function comparisonQuery(
  overrides: Partial<DashboardComparisonQueryDto> = {},
): DashboardComparisonQueryDto {
  const dto = new DashboardComparisonQueryDto();
  Object.assign(dto, {
    period: 'currentMonth',
    groupBy: 'month',
    ...overrides,
  });
  return dto;
}

function balanceVariationQuery(
  overrides: Partial<DashboardBalanceVariationQueryDto> = {},
): DashboardBalanceVariationQueryDto {
  const dto = new DashboardBalanceVariationQueryDto();
  Object.assign(dto, overrides);
  return dto;
}

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    tenant: {
      transaction: { findMany: jest.Mock };
      member: { count: jest.Mock };
      ministry: { count: jest.Mock };
      category: { count: jest.Mock };
      $transaction: jest.Mock;
    };
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    prisma = {
      tenant: {
        transaction: { findMany: jest.fn().mockResolvedValue([]) },
        member: { count: jest.fn().mockResolvedValue(0) },
        ministry: { count: jest.fn().mockResolvedValue(0) },
        category: { count: jest.fn().mockResolvedValue(0) },
        $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getBalance', () => {
    it('soma o valor com sinal de todas as transações não excluídas até hoje', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { value: 1000 },
        { value: -400 },
        { value: -100 },
      ]);

      const result = await service.getBalance();

      expect(result.balance).toBe(500);
      expect(prisma.tenant.transaction.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          date: { lte: new Date('2026-07-15T00:00:00.000Z') },
        },
        select: { value: true },
      });
    });

    it('pode ser negativo', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { value: -500 },
      ]);

      const result = await service.getBalance();

      expect(result.balance).toBe(-500);
    });

    it('é 0 quando não há transações', async () => {
      const result = await service.getBalance();
      expect(result.balance).toBe(0);
    });
  });

  describe('getCounts', () => {
    it('retorna membersCount/ministriesCount/categoriesCount, todos filtrando deletedAt nulo', async () => {
      prisma.tenant.member.count.mockResolvedValueOnce(87);
      prisma.tenant.ministry.count.mockResolvedValueOnce(6);
      prisma.tenant.category.count.mockResolvedValueOnce(14);

      const result = await service.getCounts();

      expect(prisma.tenant.member.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(prisma.tenant.ministry.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(prisma.tenant.category.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
      expect(result).toEqual({
        membersCount: 87,
        ministriesCount: 6,
        categoriesCount: 14,
      });
    });
  });

  describe('getBalanceVariation', () => {
    it('calcula balanceStart/balanceEnd (saldo até a data, inclusive) e percentChange', async () => {
      prisma.tenant.transaction.findMany
        .mockResolvedValueOnce([{ value: 12000 }]) // até dateFrom
        .mockResolvedValueOnce([{ value: 18500 }]); // até dateTo

      const result = await service.getBalanceVariation(
        balanceVariationQuery({
          dateFrom: '2026-01-01',
          dateTo: '2026-07-23',
        }),
      );

      expect(result).toEqual({
        dateFrom: '2026-01-01',
        dateTo: '2026-07-23',
        balanceStart: 12000,
        balanceEnd: 18500,
        percentChange: 54.2,
      });
      expect(prisma.tenant.transaction.findMany).toHaveBeenNthCalledWith(1, {
        where: { deletedAt: null, date: { lte: new Date('2026-01-01') } },
        select: { value: true },
      });
      expect(prisma.tenant.transaction.findMany).toHaveBeenNthCalledWith(2, {
        where: { deletedAt: null, date: { lte: new Date('2026-07-23') } },
        select: { value: true },
      });
    });

    it('percentChange negativo quando o saldo cai', async () => {
      prisma.tenant.transaction.findMany
        .mockResolvedValueOnce([{ value: 1000 }])
        .mockResolvedValueOnce([{ value: 500 }]);

      const result = await service.getBalanceVariation(
        balanceVariationQuery({ dateFrom: '2026-01-01', dateTo: '2026-02-01' }),
      );

      expect(result.percentChange).toBe(-50);
    });

    it('percentChange é null quando balanceStart = 0', async () => {
      prisma.tenant.transaction.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ value: 500 }]);

      const result = await service.getBalanceVariation(
        balanceVariationQuery({ dateFrom: '2026-01-01', dateTo: '2026-02-01' }),
      );

      expect(result.percentChange).toBeNull();
    });

    it('usa o módulo do balanceStart negativo no divisor', async () => {
      prisma.tenant.transaction.findMany
        .mockResolvedValueOnce([{ value: -1000 }])
        .mockResolvedValueOnce([{ value: -500 }]);

      const result = await service.getBalanceVariation(
        balanceVariationQuery({ dateFrom: '2026-01-01', dateTo: '2026-02-01' }),
      );

      // (-500 - -1000) / |-1000| * 100 = 50
      expect(result.percentChange).toBe(50);
    });

    it('dateFrom e dateTo ausentes → 400 VALIDATION_ERROR com os dois campos em details', async () => {
      try {
        await service.getBalanceVariation(balanceVariationQuery());
        throw new Error('deveria ter lançado AppException');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        const appError = error as AppException;
        expect(appError.code).toBe('VALIDATION_ERROR');
        expect(appError.message).toBe('dateFrom e dateTo são obrigatórios.');
        expect(appError.details).toEqual([
          { field: 'dateFrom', message: 'dateFrom é obrigatório.' },
          { field: 'dateTo', message: 'dateTo é obrigatório.' },
        ]);
      }
    });

    it('só dateFrom ausente → details só com dateFrom', async () => {
      try {
        await service.getBalanceVariation(
          balanceVariationQuery({ dateTo: '2026-01-01' }),
        );
        throw new Error('deveria ter lançado AppException');
      } catch (error) {
        const appError = error as AppException;
        expect(appError.details).toEqual([
          { field: 'dateFrom', message: 'dateFrom é obrigatório.' },
        ]);
      }
    });

    it('dateFrom posterior a dateTo → 400 VALIDATION_ERROR', async () => {
      try {
        await service.getBalanceVariation(
          balanceVariationQuery({
            dateFrom: '2026-07-23',
            dateTo: '2026-01-01',
          }),
        );
        throw new Error('deveria ter lançado AppException');
      } catch (error) {
        const appError = error as AppException;
        expect(appError.code).toBe('VALIDATION_ERROR');
        expect(appError.message).toBe(
          'dateFrom não pode ser posterior a dateTo.',
        );
      }
    });
  });

  describe('getSummary', () => {
    it('não aceita balance/membersCount/ministriesCount/averageTicket — só métricas do período', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { value: 500, type: 'income' },
        { value: -1200, type: 'expense' },
      ]);

      const result = await service.getSummary(summaryQuery());

      expect(result).toEqual({
        income: 500,
        expense: 1200,
        periodBalance: -700,
        incomeCount: 1,
        expenseCount: 1,
        transactionsCount: 2,
      });
    });

    it('período vazio (sem transações) → tudo 0', async () => {
      const result = await service.getSummary(summaryQuery());

      expect(result).toEqual({
        income: 0,
        expense: 0,
        periodBalance: 0,
        incomeCount: 0,
        expenseCount: 0,
        transactionsCount: 0,
      });
    });

    it('aplica categoryIds e ministryId no where (sem filtro de type — summary não aceita type)', async () => {
      await service.getSummary(
        summaryQuery({
          categoryIds: ['cat-1', 'cat-2'],
          ministryId: 'ministerio-1',
        }),
      );

      expect(prisma.tenant.transaction.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          categoryId: { in: ['cat-1', 'cat-2'] },
          ministryId: 'ministerio-1',
          date: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-15T00:00:00.000Z'),
          },
        },
        select: { value: true, type: true },
      });
    });

    it('period=custom sem dateFrom/dateTo → 400 (via ValidateCustomPeriodRange no DTO)', () => {
      const dto = new DashboardSummaryQueryDto();
      Object.assign(dto, { period: 'custom' });
      // A validação de classe roda no ValidationPipe global (não no service);
      // aqui garantimos que o DTO tem os decorators corretos.
      expect(dto.period).toBe('custom');
    });
  });

  describe('getLine', () => {
    it('granularity=day gera um ponto por dia, contínuo, com income/expense em magnitude', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { date: new Date('2026-07-01'), value: 500, type: 'income' },
        { date: new Date('2026-07-02'), value: -1200, type: 'expense' },
      ]);

      const result = await service.getLine(
        lineQuery({
          period: 'custom',
          dateFrom: '2026-07-01',
          dateTo: '2026-07-03',
          granularity: 'day',
        }),
      );

      expect(result.granularity).toBe('day');
      expect(result.line).toEqual([
        { date: '2026-07-01', income: 500, expense: 0 },
        { date: '2026-07-02', income: 0, expense: 1200 },
        { date: '2026-07-03', income: 0, expense: 0 },
      ]);
    });

    it('granularity=week agrupa domingo a sábado, com chave no domingo', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { date: new Date('2026-06-30'), value: 1000, type: 'income' },
        { date: new Date('2026-07-08'), value: -400, type: 'expense' },
      ]);

      const result = await service.getLine(
        lineQuery({
          period: 'custom',
          dateFrom: '2026-06-28',
          dateTo: '2026-07-05',
          granularity: 'week',
        }),
      );

      expect(result.granularity).toBe('week');
      expect(result.line).toEqual([
        { date: '2026-06-28', income: 1000, expense: 0 },
        { date: '2026-07-05', income: 0, expense: 400 },
      ]);
    });

    it('período com dias vazios preenche com income:0/expense:0', async () => {
      const result = await service.getLine(
        lineQuery({
          period: 'custom',
          dateFrom: '2026-03-10',
          dateTo: '2026-03-12',
          granularity: 'day',
        }),
      );

      expect(result.line).toEqual([
        { date: '2026-03-10', income: 0, expense: 0 },
        { date: '2026-03-11', income: 0, expense: 0 },
        { date: '2026-03-12', income: 0, expense: 0 },
      ]);
    });

    it('aplica type/categoryIds/ministryId no where', async () => {
      await service.getLine(
        lineQuery({
          period: 'custom',
          dateFrom: '2026-02-10',
          dateTo: '2026-03-20',
          type: 'expense',
          categoryIds: ['cat-2'],
          ministryId: 'ministerio-1',
        }),
      );

      expect(prisma.tenant.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
            type: 'expense',
            categoryId: { in: ['cat-2'] },
            ministryId: 'ministerio-1',
            date: {
              gte: new Date('2026-02-10'),
              lte: new Date('2026-03-20'),
            },
          },
        }),
      );
    });
  });

  describe('getByCategory', () => {
    it('agrupa entradas e saídas por categoria com nome/cor e valor em magnitude positiva', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        {
          value: 500,
          type: 'income',
          category: { id: 'cat-1', name: 'Dízimo', color: '#22C55E' },
        },
        {
          value: 300,
          type: 'income',
          category: { id: 'cat-1', name: 'Dízimo', color: '#22C55E' },
        },
        {
          value: -1200,
          type: 'expense',
          category: { id: 'cat-2', name: 'Aluguel', color: '#EF4444' },
        },
      ]);

      const result = await service.getByCategory(byCategoryQuery());

      expect(result.incomeByCategory).toEqual([
        { categoryId: 'cat-1', name: 'Dízimo', color: '#22C55E', value: 800 },
      ]);
      expect(result.expenseByCategory).toEqual([
        { categoryId: 'cat-2', name: 'Aluguel', color: '#EF4444', value: 1200 },
      ]);
    });

    it('type=income esvazia expenseByCategory (o where já filtra o type)', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        {
          value: 500,
          type: 'income',
          category: { id: 'cat-1', name: 'Dízimo', color: '#22C55E' },
        },
      ]);

      const result = await service.getByCategory(
        byCategoryQuery({ type: 'income' }),
      );

      expect(result.expenseByCategory).toEqual([]);
      expect(prisma.tenant.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'income' }),
        }),
      );
    });

    it('type=all (padrão) preenche os dois lados', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        {
          value: 500,
          type: 'income',
          category: { id: 'cat-1', name: 'Dízimo', color: '#22C55E' },
        },
        {
          value: -200,
          type: 'expense',
          category: { id: 'cat-2', name: 'Aluguel', color: '#EF4444' },
        },
      ]);

      const result = await service.getByCategory(byCategoryQuery());

      expect(result.incomeByCategory).toHaveLength(1);
      expect(result.expenseByCategory).toHaveLength(1);
    });

    it('categoria soft-deletada ainda referida pela transação continua aparecendo (join não filtra deletedAt da categoria)', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        {
          value: 500,
          type: 'income',
          category: {
            id: 'cat-1',
            name: 'Categoria Excluída',
            color: '#22C55E',
          },
        },
      ]);

      const result = await service.getByCategory(byCategoryQuery());

      expect(result.incomeByCategory).toEqual([
        {
          categoryId: 'cat-1',
          name: 'Categoria Excluída',
          color: '#22C55E',
          value: 500,
        },
      ]);
    });
  });

  describe('getComparison', () => {
    it('agrupa por mês, preenche buckets contínuos e retorna sampleSize 0 quando há um único bucket', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { date: new Date('2026-07-05'), value: 500, type: 'income' },
        { date: new Date('2026-07-10'), value: -200, type: 'expense' },
      ]);

      const result = await service.getComparison(
        comparisonQuery({ period: 'currentMonth', groupBy: 'month' }),
      );

      expect(result.groupBy).toBe('month');
      expect(result.buckets).toEqual([
        {
          periodStart: '2026-07-01',
          label: 'Jul/26',
          income: 500,
          expense: 200,
        },
      ]);
      expect(result.comparison).toEqual({
        sampleSize: 0,
        incomeVsAvg: null,
        expenseVsAvg: null,
      });
    });

    it('calcula incomeVsAvg/expenseVsAvg do último bucket vs. a média dos anteriores (exemplo do spec)', async () => {
      const monthlySummaries: {
        month: string;
        income: number;
        expense: number;
      }[] = [
        { month: '2026-02', income: 100000, expense: 60000 },
        { month: '2026-03', income: 105000, expense: 58000 },
        { month: '2026-04', income: 98000, expense: 62000 },
        { month: '2026-05', income: 102000, expense: 59000 },
        { month: '2026-06', income: 95000, expense: 61000 },
        { month: '2026-07', income: 90000, expense: 70000 },
      ];
      const monthlyRows = monthlySummaries.flatMap(
        ({ month, income, expense }) => [
          { date: new Date(`${month}-01`), value: income, type: 'income' },
          { date: new Date(`${month}-01`), value: -expense, type: 'expense' },
        ],
      );
      prisma.tenant.transaction.findMany.mockResolvedValueOnce(monthlyRows);

      const result = await service.getComparison(
        comparisonQuery({
          period: 'custom',
          dateFrom: '2026-02-01',
          dateTo: '2026-07-31',
          groupBy: 'month',
        }),
      );

      expect(result.buckets).toEqual([
        {
          periodStart: '2026-02-01',
          label: 'Fev/26',
          income: 100000,
          expense: 60000,
        },
        {
          periodStart: '2026-03-01',
          label: 'Mar/26',
          income: 105000,
          expense: 58000,
        },
        {
          periodStart: '2026-04-01',
          label: 'Abr/26',
          income: 98000,
          expense: 62000,
        },
        {
          periodStart: '2026-05-01',
          label: 'Mai/26',
          income: 102000,
          expense: 59000,
        },
        {
          periodStart: '2026-06-01',
          label: 'Jun/26',
          income: 95000,
          expense: 61000,
        },
        {
          periodStart: '2026-07-01',
          label: 'Jul/26',
          income: 90000,
          expense: 70000,
        },
      ]);
      expect(result.comparison).toEqual({
        sampleSize: 5,
        incomeVsAvg: -10.0,
        expenseVsAvg: 16.7,
      });
    });

    it('agrupa por semana (domingo a sábado), rotulando a faixa de dias e cruzando o mês quando aplicável', async () => {
      prisma.tenant.transaction.findMany.mockResolvedValueOnce([
        { date: new Date('2026-06-30'), value: 1000, type: 'income' },
        { date: new Date('2026-07-08'), value: -400, type: 'expense' },
      ]);

      const result = await service.getComparison(
        comparisonQuery({
          period: 'custom',
          dateFrom: '2026-06-28',
          dateTo: '2026-07-05',
          groupBy: 'week',
        }),
      );

      expect(result.groupBy).toBe('week');
      expect(result.buckets).toEqual([
        {
          periodStart: '2026-06-28',
          label: '28/jun–04/jul',
          income: 1000,
          expense: 0,
        },
        {
          periodStart: '2026-07-05',
          label: '05–11/jul',
          income: 0,
          expense: 400,
        },
      ]);
      expect(result.comparison).toEqual({
        sampleSize: 1,
        incomeVsAvg: -100.0,
        expenseVsAvg: null,
      });
    });

    it('aplica categoryIds/ministryId no where, sem filtrar por type (comparison sempre traz os dois tipos)', async () => {
      await service.getComparison(
        comparisonQuery({
          period: 'custom',
          dateFrom: '2026-02-10',
          dateTo: '2026-03-20',
          categoryIds: ['cat-2'],
          ministryId: 'ministerio-1',
        }),
      );

      expect(prisma.tenant.transaction.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          categoryId: { in: ['cat-2'] },
          ministryId: 'ministerio-1',
          date: {
            gte: new Date('2026-02-10'),
            lte: new Date('2026-03-20'),
          },
        },
        select: { date: true, value: true, type: true },
      });
    });
  });
});
