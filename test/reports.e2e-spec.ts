import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { REPORT_RENDERER } from '../src/modules/reports/clients/report-renderer';
import { REPORT_STORAGE } from '../src/modules/reports/clients/report-storage';
import { PrismaService } from '../src/modules/prisma/prisma.service';

const EMAIL = 'e2e-reports@teste.local';
const OTHER_EMAIL = 'e2e-reports-outra-igreja@teste.local';
const PASSWORD = 'senhaSegura123';

const FAKE_KEY = 'reports/test/fixed.pdf';
const FAKE_DOWNLOAD = {
  downloadUrl: 'http://signed.local/fixed',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let otherAuthToken: string;
  const renderSpy = jest.fn(() => Promise.resolve({ key: FAKE_KEY }));

  const cleanup = async () => {
    const churchFilter = { church: { email: { in: [EMAIL, OTHER_EMAIL] } } };
    // O cadastro cria categorias e ministérios padrão — remover antes da church
    // (FKs) junto com os relatórios gerados nos testes.
    await prisma.unscoped.transaction.deleteMany({ where: churchFilter });
    await prisma.unscoped.report.deleteMany({ where: churchFilter });
    await prisma.unscoped.category.deleteMany({ where: churchFilter });
    await prisma.unscoped.ministry.deleteMany({ where: churchFilter });
    await prisma.unscoped.member.deleteMany({ where: churchFilter });
    await prisma.unscoped.church.deleteMany({
      where: { email: { in: [EMAIL, OTHER_EMAIL] } },
    });
  };

  const login = async (email: string): Promise<string> => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'Igreja E2E Reports', email, password: PASSWORD });
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return response.body.data.token as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(REPORT_RENDERER)
      .useValue({ render: renderSpy })
      .overrideProvider(REPORT_STORAGE)
      .useValue({ getSignedDownloadUrl: () => Promise.resolve(FAKE_DOWNLOAD) })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    await cleanup();

    authToken = await login(EMAIL);
    otherAuthToken = await login(OTHER_EMAIL);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(() => renderSpy.mockClear());

  const post = (token: string, body: unknown) =>
    request(app.getHttpServer())
      .post('/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  describe('POST /v1/reports', () => {
    it('sem token → 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/reports')
        .send({
          dateFrom: '2026-07-01',
          dateTo: '2026-07-31',
          sections: ['summary'],
        })
        .expect(401);
    });

    it('gera o relatório e retorna id + downloadUrl inicial', async () => {
      const response = await post(authToken, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        sections: ['summary', 'expenseByMinistry'],
      }).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        downloadUrl: FAKE_DOWNLOAD.downloadUrl,
        expiresAt: FAKE_DOWNLOAD.expiresAt,
      });
      expect(response.body.data.id).toEqual(expect.any(String));
      expect(response.body.data.generatedAt).toEqual(expect.any(String));
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('sem sections → 400 VALIDATION_ERROR', async () => {
      const response = await post(authToken, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        sections: [],
      }).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('sem período → 400 VALIDATION_ERROR', async () => {
      const response = await post(authToken, { sections: ['summary'] }).expect(
        400,
      );
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('includeMember sem transactionList/senha → 400 e não invoca o renderer', async () => {
      const response = await post(authToken, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        sections: ['summary'],
        includeMember: true,
      }).expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(renderSpy).not.toHaveBeenCalled();
    });

    it('includeMember com senha incorreta → 401 INVALID_CREDENTIALS, nada é gerado', async () => {
      const before = await request(app.getHttpServer())
        .get('/v1/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const response = await post(authToken, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        sections: ['transactionList'],
        includeMember: true,
        currentPassword: 'senhaErrada',
      }).expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(renderSpy).not.toHaveBeenCalled();

      const after = await request(app.getHttpServer())
        .get('/v1/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(after.body.data.meta.total).toBe(before.body.data.meta.total);
    });

    it('includeMember com senha correta → 201', async () => {
      await post(authToken, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        sections: ['transactionList'],
        includeMember: true,
        currentPassword: PASSWORD,
      }).expect(201);
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /v1/reports', () => {
    it('lista o histórico com o snapshot params', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/reports?page=1&limit=20')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.items.length).toBeGreaterThan(0);
      const item = response.body.data.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('generatedAt');
      expect(item.params).toEqual(
        expect.objectContaining({ sections: expect.any(Array) }),
      );
      expect(response.body.data.meta).toEqual(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('outra igreja não vê os relatórios desta igreja', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/reports')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(200);
      expect(response.body.data.meta.total).toBe(0);
    });
  });

  describe('GET /v1/reports/:id/download', () => {
    let reportId: string;

    beforeAll(async () => {
      const created = await post(authToken, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-31',
        sections: ['summary'],
      }).expect(201);
      reportId = created.body.data.id;
    });

    it('gera um novo link de download', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/reports/${reportId}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      expect(response.body.data).toEqual(FAKE_DOWNLOAD);
    });

    it('relatório de outra igreja → 404 RESOURCE_NOT_FOUND', async () => {
      const response = await request(app.getHttpServer())
        .get(`/v1/reports/${reportId}/download`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(404);
      expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('id inexistente → 404', async () => {
      await request(app.getHttpServer())
        .get('/v1/reports/00000000-0000-4000-8000-000000000000/download')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
