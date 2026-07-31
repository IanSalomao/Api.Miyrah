import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DEFAULT_CATEGORIES } from '../src/modules/categories/constants/default-categories.constant';
import { DEFAULT_MINISTRIES } from '../src/modules/ministries/constants/default-ministries.constant';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const EMAIL = 'e2e-dashboard@teste.local';
const OTHER_EMAIL = 'e2e-dashboard-outra-igreja@teste.local';
const PASSWORD = 'senhaSegura123';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let otherAuthToken: string;
  let churchId: string;
  let otherChurchId: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;
  let ministryId: string;

  const cleanup = async () => {
    await prisma.unscoped.transaction.deleteMany({
      where: { church: { email: { in: [EMAIL, OTHER_EMAIL] } } },
    });
    await prisma.unscoped.category.deleteMany({
      where: { church: { email: { in: [EMAIL, OTHER_EMAIL] } } },
    });
    await prisma.unscoped.ministry.deleteMany({
      where: { church: { email: { in: [EMAIL, OTHER_EMAIL] } } },
    });
    await prisma.unscoped.member.deleteMany({
      where: { church: { email: { in: [EMAIL, OTHER_EMAIL] } } },
    });
    await prisma.unscoped.church.deleteMany({
      where: { email: { in: [EMAIL, OTHER_EMAIL] } },
    });
  };

  const login = async (email: string): Promise<string> => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'Igreja E2E Dashboard', email, password: PASSWORD });
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.data.token as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await cleanup();

    authToken = await login(EMAIL);
    otherAuthToken = await login(OTHER_EMAIL);

    const church = await prisma.unscoped.church.findFirstOrThrow({
      where: { email: EMAIL },
    });
    const otherChurch = await prisma.unscoped.church.findFirstOrThrow({
      where: { email: OTHER_EMAIL },
    });
    churchId = church.id;
    otherChurchId = otherChurch.id;

    const ministry = await prisma.unscoped.ministry.create({
      data: { churchId, name: 'Ministério E2E' },
    });
    ministryId = ministry.id;

    const incomeCategory = await prisma.unscoped.category.create({
      data: {
        churchId,
        name: 'Dízimo',
        type: 'income',
        color: '#22C55E',
      },
    });
    incomeCategoryId = incomeCategory.id;

    const expenseCategory = await prisma.unscoped.category.create({
      data: {
        churchId,
        name: 'Aluguel',
        type: 'expense',
        color: '#EF4444',
      },
    });
    expenseCategoryId = expenseCategory.id;

    // T1: income, com ministério, dentro do período custom de teste (jan/fev)
    await prisma.unscoped.transaction.create({
      data: {
        churchId,
        categoryId: incomeCategoryId,
        type: 'income',
        value: 500,
        date: new Date('2026-01-05'),
        ministryId,
      },
    });
    // T2: income, sem ministério, dentro do período custom de teste (jan/fev)
    await prisma.unscoped.transaction.create({
      data: {
        churchId,
        categoryId: incomeCategoryId,
        type: 'income',
        value: 300,
        date: new Date('2026-02-10'),
      },
    });
    // T3: expense, com ministério, dentro do período custom de teste (jan/fev)
    await prisma.unscoped.transaction.create({
      data: {
        churchId,
        categoryId: expenseCategoryId,
        type: 'expense',
        value: -1200,
        date: new Date('2026-01-20'),
        ministryId,
      },
    });
    // T4: expense, fora do período custom de teste (mar) — só entra no "all-time"
    await prisma.unscoped.transaction.create({
      data: {
        churchId,
        categoryId: expenseCategoryId,
        type: 'expense',
        value: -200,
        date: new Date('2026-03-01'),
      },
    });

    // Transação de outra igreja — nunca deve vazar nos totais acima
    const otherCategory = await prisma.unscoped.category.create({
      data: {
        churchId: otherChurchId,
        name: 'Categoria Outra Igreja',
        type: 'income',
        color: '#000000',
      },
    });
    await prisma.unscoped.transaction.create({
      data: {
        churchId: otherChurchId,
        categoryId: otherCategory.id,
        type: 'income',
        value: 99999,
        date: new Date('2026-01-10'),
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const authed = {
    get: (url: string) =>
      request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Bearer ${authToken}`),
  };

  describe('GET /v1/dashboard/balance', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/dashboard/balance')
        .expect(401);
    });

    it('soma o saldo de todo o histórico, sem filtro de período (e sem vazar de outra igreja)', async () => {
      const response = await authed
        .get('/v1/dashboard/balance?period=last12Months') // query string é ignorada
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ balance: -600 });
    });

    it('outra igreja não vê o saldo desta igreja', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/dashboard/balance')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(200);

      expect(response.body.data).toEqual({ balance: 99999 });
    });
  });

  describe('GET /v1/dashboard/summary', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/dashboard/summary')
        .expect(401);
    });

    it('period=custom calcula income/expense/periodBalance/incomeCount/expenseCount/transactionsCount só dentro do intervalo informado', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/summary?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28',
        )
        .expect(200);

      expect(response.body.data).toEqual({
        income: 800,
        expense: 1200,
        periodBalance: -400,
        incomeCount: 2,
        expenseCount: 1,
        transactionsCount: 3,
      });
    });

    it('não retorna balance/membersCount/ministriesCount/averageTicket', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/summary?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28',
        )
        .expect(200);

      expect(response.body.data).not.toHaveProperty('balance');
      expect(response.body.data).not.toHaveProperty('membersCount');
      expect(response.body.data).not.toHaveProperty('ministriesCount');
      expect(response.body.data).not.toHaveProperty('averageTicket');
    });

    it('não aceita o param type (é ignorado por não estar na whitelist do DTO, então gera 400)', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/summary?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28&type=income',
        )
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('filtra por ministryId e oculta transações sem ministério vinculado', async () => {
      const response = await authed
        .get(
          `/v1/dashboard/summary?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28&ministryId=${ministryId}`,
        )
        .expect(200);

      expect(response.body.data).toMatchObject({
        income: 500,
        expense: 1200,
        periodBalance: -700,
      });
    });

    it('filtra por categoryIds', async () => {
      const response = await authed
        .get(
          `/v1/dashboard/summary?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28&categoryIds=${incomeCategoryId}`,
        )
        .expect(200);

      expect(response.body.data).toMatchObject({
        income: 800,
        expense: 0,
        periodBalance: 800,
      });
    });

    it('period=custom sem dateFrom/dateTo → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/summary?period=custom')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('dateTo anterior a dateFrom → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/summary?period=custom&dateFrom=2026-02-01&dateTo=2026-01-01',
        )
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('categoryIds com uuid inválido → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/summary?categoryIds=nao-e-um-uuid')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('outra igreja não vê os dados desta igreja', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/v1/dashboard/summary?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28',
        )
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(200);

      expect(response.body.data.income).toBe(99999);
      expect(response.body.data.expense).toBe(0);
    });
  });

  describe('GET /v1/dashboard/counts', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/dashboard/counts')
        .expect(401);
    });

    it('retorna membersCount/ministriesCount/categoriesCount correntes da igreja autenticada', async () => {
      const response = await authed.get('/v1/dashboard/counts').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        membersCount: 0,
        // +1: o "Ministério E2E" criado manualmente no beforeAll, além dos
        // ministérios padrão que o registro já cria para toda igreja nova.
        ministriesCount: DEFAULT_MINISTRIES.length + 1,
        // +2: "Dízimo"/"Aluguel" criadas manualmente no beforeAll, além das
        // categorias padrão que o registro já cria para toda igreja nova.
        categoriesCount: DEFAULT_CATEGORIES.length + 2,
      });
    });

    it('registros soft-deletados não entram na contagem', async () => {
      const disposableMinistry = await prisma.unscoped.ministry.create({
        data: { churchId, name: 'Ministério Descartável' },
      });

      const before = await authed.get('/v1/dashboard/counts').expect(200);
      expect(before.body.data.ministriesCount).toBe(
        DEFAULT_MINISTRIES.length + 2,
      );

      await prisma.unscoped.ministry.update({
        where: { id: disposableMinistry.id },
        data: { deletedAt: new Date() },
      });

      const after = await authed.get('/v1/dashboard/counts').expect(200);
      expect(after.body.data.ministriesCount).toBe(
        DEFAULT_MINISTRIES.length + 1,
      );
    });
  });

  describe('GET /v1/dashboard/balance-variation', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/dashboard/balance-variation')
        .expect(401);
    });

    it('calcula balanceStart/balanceEnd (saldo até a data, inclusive) e percentChange', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/balance-variation?dateFrom=2026-01-10&dateTo=2026-02-15',
        )
        .expect(200);

      expect(response.body.data).toEqual({
        dateFrom: '2026-01-10',
        dateTo: '2026-02-15',
        balanceStart: 500,
        balanceEnd: -400,
        percentChange: -180.0,
      });
    });

    it('dateFrom e dateTo ausentes → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/balance-variation')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('dateFrom posterior a dateTo → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/balance-variation?dateFrom=2026-02-15&dateTo=2026-01-10',
        )
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('outra igreja vê apenas o próprio saldo (percentChange 0 quando não há movimento entre as datas)', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/v1/dashboard/balance-variation?dateFrom=2026-01-10&dateTo=2026-02-15',
        )
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(200);

      expect(response.body.data).toEqual({
        dateFrom: '2026-01-10',
        dateTo: '2026-02-15',
        balanceStart: 99999,
        balanceEnd: 99999,
        percentChange: 0,
      });
    });
  });

  describe('GET /v1/dashboard/line', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer()).get('/v1/dashboard/line').expect(401);
    });

    it('granularity=day (padrão) gera um ponto por dia, contínuo', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/line?period=custom&dateFrom=2026-01-04&dateTo=2026-01-07',
        )
        .expect(200);

      expect(response.body.data.granularity).toBe('day');
      expect(response.body.data.line).toEqual([
        { date: '2026-01-04', income: 0, expense: 0 },
        { date: '2026-01-05', income: 500, expense: 0 },
        { date: '2026-01-06', income: 0, expense: 0 },
        { date: '2026-01-07', income: 0, expense: 0 },
      ]);
    });

    it('granularity=week agrupa domingo a sábado', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/line?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28&granularity=week',
        )
        .expect(200);

      expect(response.body.data.granularity).toBe('week');
      expect(
        response.body.data.line.reduce(
          (sum: number, point: { income: number }) => sum + point.income,
          0,
        ),
      ).toBe(800);
    });

    it('granularity inválido → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/line?granularity=month')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('period=custom sem dateFrom/dateTo → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/line?period=custom')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /v1/dashboard/by-category', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/dashboard/by-category')
        .expect(401);
    });

    it('retorna entradas e saídas por categoria com nome e cor', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/by-category?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28',
        )
        .expect(200);

      expect(response.body.data.incomeByCategory).toEqual([
        {
          categoryId: incomeCategoryId,
          name: 'Dízimo',
          color: '#22C55E',
          value: 800,
        },
      ]);
      expect(response.body.data.expenseByCategory).toEqual([
        {
          categoryId: expenseCategoryId,
          name: 'Aluguel',
          color: '#EF4444',
          value: 1200,
        },
      ]);
    });

    it('type=income esvazia expenseByCategory', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/by-category?period=custom&dateFrom=2026-01-01&dateTo=2026-02-28&type=income',
        )
        .expect(200);

      expect(response.body.data.expenseByCategory).toEqual([]);
      expect(response.body.data.incomeByCategory).not.toEqual([]);
    });

    it('categoria soft-deletada, mas ainda referida por uma transação, continua aparecendo', async () => {
      const deletedCategory = await prisma.unscoped.category.create({
        data: {
          churchId,
          name: 'Categoria Descontinuada',
          type: 'income',
          color: '#111111',
        },
      });
      await prisma.unscoped.transaction.create({
        data: {
          churchId,
          categoryId: deletedCategory.id,
          type: 'income',
          value: 150,
          date: new Date('2026-04-15'),
        },
      });
      await prisma.unscoped.category.update({
        where: { id: deletedCategory.id },
        data: { deletedAt: new Date() },
      });

      const response = await authed
        .get(
          '/v1/dashboard/by-category?period=custom&dateFrom=2026-04-01&dateTo=2026-04-30',
        )
        .expect(200);

      expect(response.body.data.incomeByCategory).toEqual([
        {
          categoryId: deletedCategory.id,
          name: 'Categoria Descontinuada',
          color: '#111111',
          value: 150,
        },
      ]);
    });
  });

  describe('GET /v1/dashboard/comparison', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .get('/v1/dashboard/comparison')
        .expect(401);
    });

    it('agrupa por mês (padrão) com buckets contínuos e comparison vs. a média dos anteriores', async () => {
      const response = await authed
        .get(
          '/v1/dashboard/comparison?period=custom&dateFrom=2026-01-01&dateTo=2026-03-31',
        )
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.groupBy).toBe('month');
      expect(response.body.data.buckets).toEqual([
        {
          periodStart: '2026-01-01',
          label: 'Jan/26',
          income: 500,
          expense: 1200,
        },
        { periodStart: '2026-02-01', label: 'Fev/26', income: 300, expense: 0 },
        { periodStart: '2026-03-01', label: 'Mar/26', income: 0, expense: 200 },
      ]);
      expect(response.body.data.comparison).toEqual({
        sampleSize: 2,
        incomeVsAvg: -100.0,
        expenseVsAvg: -66.7,
      });
    });

    it('filtra por ministryId e oculta transações sem ministério vinculado', async () => {
      const response = await authed
        .get(
          `/v1/dashboard/comparison?period=custom&dateFrom=2026-01-01&dateTo=2026-01-31&ministryId=${ministryId}`,
        )
        .expect(200);

      expect(response.body.data.buckets).toEqual([
        {
          periodStart: '2026-01-01',
          label: 'Jan/26',
          income: 500,
          expense: 1200,
        },
      ]);
      expect(response.body.data.comparison).toEqual({
        sampleSize: 0,
        incomeVsAvg: null,
        expenseVsAvg: null,
      });
    });

    it('groupBy inválido → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/comparison?groupBy=daily')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('period=custom sem dateFrom/dateTo → 400 VALIDATION_ERROR', async () => {
      const response = await authed
        .get('/v1/dashboard/comparison?period=custom')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('outra igreja não vê os dados desta igreja', async () => {
      const response = await request(app.getHttpServer())
        .get(
          '/v1/dashboard/comparison?period=custom&dateFrom=2026-01-01&dateTo=2026-01-31',
        )
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(200);

      expect(response.body.data.buckets).toEqual([
        {
          periodStart: '2026-01-01',
          label: 'Jan/26',
          income: 99999,
          expense: 0,
        },
      ]);
    });
  });

  describe('GET /v1/dashboard/charts (removido)', () => {
    it('rota antiga não existe mais', async () => {
      await authed.get('/v1/dashboard/charts').expect(404);
    });
  });
});
