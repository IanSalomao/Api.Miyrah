import type { ReportBlock, ReportMeta } from '../types/report-payload';
import { buildHtml } from './build-html';

const meta: ReportMeta = {
  churchId: 'c1',
  churchName: 'Igreja Teste',
  periodLabel: 'Julho / 2026',
  dateFrom: '2026-07-01',
  dateTo: '2026-07-31',
  generatedAtLabel: '30/07/2026',
};

const build = (
  blocks: ReportBlock[],
  metaOverride: Partial<ReportMeta> = {},
): string => buildHtml({ meta: { ...meta, ...metaOverride }, blocks });

const emptySummary: ReportBlock = {
  type: 'summary',
  data: {
    previousBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    finalBalance: 0,
  },
};

describe('buildHtml', () => {
  it('sempre inclui a capa como primeiro slide', () => {
    const html = build([]);
    expect(html).toContain('data-block="cover"');
    expect(html).toContain('Igreja Teste');
  });

  it('gera um <section data-block> por bloco recebido', () => {
    const html = build([emptySummary, { type: 'incomeByCategory', data: [] }]);
    expect(html).toContain('data-block="summary"');
    expect(html).toContain('data-block="incomeByCategory"');
  });

  it('não renderiza blocos que não foram enviados', () => {
    const html = build([emptySummary]);
    expect(html).not.toContain('data-block="transactionList"');
    expect(html).not.toContain('data-block="expenseByMinistry"');
  });

  it('preserva a ordem dos blocos recebida (a API é quem ordena)', () => {
    const html = build([{ type: 'expenseByCategory', data: [] }, emptySummary]);
    expect(html.indexOf('data-block="expenseByCategory"')).toBeLessThan(
      html.indexOf('data-block="summary"'),
    );
  });

  it('formata valores em R$ pt-BR', () => {
    const html = build([
      {
        type: 'incomeByCategory',
        data: [{ name: 'Dízimos', color: '#22C55E', value: 1234.5 }],
      },
    ]);
    expect(html).toMatch(/1\.234,50/);
  });

  it('escapa HTML de dados não confiáveis', () => {
    const html = build([], { churchName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('inclui a coluna Membro só quando includeMember é true', () => {
    const row = {
      date: '2026-07-01',
      description: 'd',
      category: 'c',
      member: 'Fulano',
      value: 10,
    };
    const withMember = build([
      { type: 'transactionList', includeMember: true, data: [row] },
    ]);
    expect(withMember).toContain('Fulano');
    expect(withMember).toContain('<th>Membro</th>');

    const without = build([
      { type: 'transactionList', includeMember: false, data: [row] },
    ]);
    expect(without).not.toContain('Fulano');
    expect(without).not.toContain('<th>Membro</th>');
  });

  it('sanitiza cor inválida antes de interpolar em style', () => {
    const html = build([
      {
        type: 'incomeByCategory',
        data: [{ name: 'x', color: 'red;background:url(evil)', value: 1 }],
      },
    ]);
    expect(html).not.toContain('url(evil)');
  });

  it('agrupa saídas por ministério com subtotal e total geral', () => {
    const html = build([
      {
        type: 'expenseByMinistry',
        data: [
          {
            ministry: 'Sem ministério',
            subtotal: 100,
            byCategory: [{ name: 'Aluguel', color: '#EF4444', value: 100 }],
          },
        ],
      },
    ]);
    expect(html).toContain('Sem ministério');
    expect(html).toContain('Total geral');
  });
});
