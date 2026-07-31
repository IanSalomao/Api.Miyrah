import { reportPayloadSchema } from './report-payload';

const meta = {
  churchId: 'c1',
  churchName: 'X',
  periodLabel: 'p',
  dateFrom: '2026-07-01',
  dateTo: '2026-07-31',
  generatedAtLabel: '30/07/2026',
};

describe('reportPayloadSchema', () => {
  it('aceita um payload válido', () => {
    const parsed = reportPayloadSchema.parse({
      meta,
      blocks: [
        { type: 'summary', data: { previousBalance: 1, totalIncome: 2, totalExpense: 3, finalBalance: 0 } },
        { type: 'transactionList', includeMember: false, data: [] },
      ],
    });
    expect(parsed.blocks).toHaveLength(2);
  });

  it('rejeita um type de bloco desconhecido', () => {
    expect(() =>
      reportPayloadSchema.parse({ meta, blocks: [{ type: 'foo', data: [] }] }),
    ).toThrow();
  });

  it('exige includeMember em transactionList', () => {
    expect(() =>
      reportPayloadSchema.parse({ meta, blocks: [{ type: 'transactionList', data: [] }] }),
    ).toThrow();
  });

  it('rejeita meta incompleto', () => {
    expect(() => reportPayloadSchema.parse({ meta: {}, blocks: [] })).toThrow();
  });
});
