import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { REPORT_RENDERER } from './clients/report-renderer';
import { REPORT_STORAGE } from './clients/report-storage';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportPayloadBuilder } from './report-payload.builder';
import { ReportsService } from './reports.service';

jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

function createDto(overrides: Partial<CreateReportDto> = {}): CreateReportDto {
  const dto = new CreateReportDto();
  Object.assign(dto, {
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
    sections: ['summary'],
    includeMember: false,
    ...overrides,
  });
  return dto;
}

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    unscoped: { church: { findFirst: jest.Mock } };
    tenant: {
      report: {
        create: jest.Mock;
        findMany: jest.Mock;
        count: jest.Mock;
        findFirst: jest.Mock;
      };
      $transaction: jest.Mock;
    };
  };
  let builder: { build: jest.Mock };
  let renderer: { render: jest.Mock };
  let storage: { getSignedDownloadUrl: jest.Mock };

  beforeEach(async () => {
    prisma = {
      unscoped: { church: { findFirst: jest.fn() } },
      tenant: {
        report: {
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          findFirst: jest.fn(),
        },
        $transaction: jest.fn(),
      },
    };
    builder = { build: jest.fn().mockResolvedValue({ meta: {}, blocks: [] }) };
    renderer = {
      render: jest.fn().mockResolvedValue({ key: 'reports/c1/uuid.pdf' }),
    };
    storage = {
      getSignedDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'http://signed/link',
        expiresAt: '2026-07-10T14:45:00.000Z',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportPayloadBuilder, useValue: builder },
        { provide: REPORT_RENDERER, useValue: renderer },
        { provide: REPORT_STORAGE, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  describe('create', () => {
    it('monta o payload, invoca o renderer, grava o histórico e devolve o link', async () => {
      prisma.unscoped.church.findFirst.mockResolvedValue({ name: 'Igreja X' });
      prisma.tenant.report.create.mockResolvedValue({
        id: 'r1',
        generatedAt: new Date('2026-07-10T14:30:00.000Z'),
      });

      const result = await service.create('c1', createDto());

      expect(builder.build).toHaveBeenCalledWith(
        expect.objectContaining({ churchId: 'c1', churchName: 'Igreja X' }),
      );
      expect(renderer.render).toHaveBeenCalledTimes(1);
      expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith(
        'reports/c1/uuid.pdf',
      );
      expect(result).toEqual({
        id: 'r1',
        generatedAt: '2026-07-10T14:30:00.000Z',
        downloadUrl: 'http://signed/link',
        expiresAt: '2026-07-10T14:45:00.000Z',
      });
    });

    it('grava o snapshot params (categoryIds default [], sem a senha)', async () => {
      prisma.unscoped.church.findFirst.mockResolvedValue({ name: 'Igreja X' });
      prisma.tenant.report.create.mockResolvedValue({
        id: 'r1',
        generatedAt: new Date(),
      });

      await service.create(
        'c1',
        createDto({ sections: ['summary', 'expenseByCategory'] }),
      );

      expect(prisma.tenant.report.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            churchId: 'c1',
            filePath: 'reports/c1/uuid.pdf',
            params: {
              dateFrom: '2026-07-01',
              dateTo: '2026-07-31',
              categoryIds: [],
              sections: ['summary', 'expenseByCategory'],
              includeMember: false,
            },
          }),
        }),
      );
    });

    it('includeMember sem transactionList e sem senha → 400 com os dois details, sem invocar o renderer', async () => {
      expect.assertions(4);
      try {
        await service.create(
          'c1',
          createDto({ includeMember: true, sections: ['summary'] }),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe('VALIDATION_ERROR');
        expect((error as AppException).details).toEqual([
          { field: 'includeMember', message: expect.any(String) },
          { field: 'currentPassword', message: expect.any(String) },
        ]);
      }
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('includeMember com senha incorreta → 401 INVALID_CREDENTIALS, sem invocar o renderer nem gravar', async () => {
      prisma.unscoped.church.findFirst.mockResolvedValue({ password: 'hash' });
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.create(
          'c1',
          createDto({
            includeMember: true,
            sections: ['transactionList'],
            currentPassword: 'errada',
          }),
        ),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

      expect(renderer.render).not.toHaveBeenCalled();
      expect(prisma.tenant.report.create).not.toHaveBeenCalled();
    });

    it('includeMember com senha correta → gera com includeMember=true', async () => {
      prisma.unscoped.church.findFirst
        .mockResolvedValueOnce({ password: 'hash' }) // assertCurrentPassword
        .mockResolvedValueOnce({ name: 'Igreja X' }); // meta
      mockedBcrypt.compare.mockResolvedValue(true as never);
      prisma.tenant.report.create.mockResolvedValue({
        id: 'r1',
        generatedAt: new Date(),
      });

      await service.create(
        'c1',
        createDto({
          includeMember: true,
          sections: ['transactionList'],
          currentPassword: 'correta',
        }),
      );

      expect(builder.build).toHaveBeenCalledWith(
        expect.objectContaining({ includeMember: true }),
      );
      expect(renderer.render).toHaveBeenCalledTimes(1);
    });

    it('não grava histórico se a Lambda falhar', async () => {
      prisma.unscoped.church.findFirst.mockResolvedValue({ name: 'Igreja X' });
      renderer.render.mockRejectedValue(
        new AppException('REPORT_GENERATION_FAILED', 'falhou', 502),
      );

      await expect(service.create('c1', createDto())).rejects.toMatchObject({
        code: 'REPORT_GENERATION_FAILED',
      });
      expect(prisma.tenant.report.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna items + meta paginada, mais recentes primeiro', async () => {
      prisma.tenant.$transaction.mockResolvedValue([
        [
          {
            id: 'r1',
            generatedAt: new Date('2026-07-10T14:30:00.000Z'),
            params: { sections: ['summary'] },
          },
        ],
        1,
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toEqual([
        {
          id: 'r1',
          generatedAt: '2026-07-10T14:30:00.000Z',
          params: { sections: ['summary'] },
        },
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('getDownload', () => {
    it('gera um novo link quando o relatório existe', async () => {
      prisma.tenant.report.findFirst.mockResolvedValue({
        filePath: 'reports/c1/uuid.pdf',
      });

      const result = await service.getDownload('r1');

      expect(storage.getSignedDownloadUrl).toHaveBeenCalledWith(
        'reports/c1/uuid.pdf',
      );
      expect(result).toEqual({
        downloadUrl: 'http://signed/link',
        expiresAt: '2026-07-10T14:45:00.000Z',
      });
    });

    it('relatório inexistente (ou de outra igreja) → 404', async () => {
      prisma.tenant.report.findFirst.mockResolvedValue(null);

      await expect(service.getDownload('r1')).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});
