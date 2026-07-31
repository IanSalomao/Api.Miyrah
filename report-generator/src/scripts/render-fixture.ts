/**
 * Gera um PDF de exemplo localmente (sem S3), para aceite visual do template.
 *   npm run render:fixture   → escreve fixture.pdf e fixture.html na raiz
 */
import { writeFileSync } from 'node:fs';
import { renderPdf } from '../render/render-pdf';
import { buildHtml } from '../template/build-html';
import type { ReportPayload } from '../types/report-payload';

const income = [
  { name: 'Dízimos', color: '#22C55E', value: 71574.89 },
  { name: 'Ofertas', color: '#16A34A', value: 15200.5 },
  { name: 'Doações', color: '#4ADE80', value: 6007.43 },
];
const expense = [
  { name: 'Aluguel', color: '#EF4444', value: 24000 },
  { name: 'Salários', color: '#DC2626', value: 38500.07 },
  { name: 'Utilidades', color: '#F87171', value: 13450 },
];

const payload: ReportPayload = {
  meta: {
    churchId: '00000000-0000-0000-0000-000000000000',
    churchName: 'Primeira Igreja Batista de Feira de Santana',
    periodLabel: '01/07/2026 – 31/07/2026',
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
    generatedAtLabel: '30/07/2026',
  },
  blocks: [
    { type: 'incomeByCategory', data: income },
    {
      type: 'incomeByMinistry',
      data: [
        { ministry: 'Música e Louvor', subtotal: 21200.5, byCategory: [{ name: 'Ofertas', color: '#16A34A', value: 21200.5 }] },
        { ministry: 'Sem ministério', subtotal: 71581.32, byCategory: income },
      ],
    },
    { type: 'incomeCategoryChart', data: income },
    {
      type: 'incomeMonthlyChart',
      data: [
        { label: 'Mai/26', value: 78000 },
        { label: 'Jun/26', value: 85400 },
        { label: 'Jul/26', value: 92782.82 },
      ],
    },
    {
      type: 'expenseByMinistry',
      data: [
        { ministry: 'Administração e Finanças', subtotal: 41991.29, byCategory: [{ name: 'Salários', color: '#DC2626', value: 38500.07 }, { name: 'Utilidades', color: '#F87171', value: 3491.22 }] },
        { ministry: 'Infraestrutura', subtotal: 33958.78, byCategory: [{ name: 'Aluguel', color: '#EF4444', value: 24000 }, { name: 'Utilidades', color: '#F87171', value: 9958.78 }] },
      ],
    },
    { type: 'expenseByCategory', data: expense },
    { type: 'expenseCategoryChart', data: expense },
    {
      type: 'expenseMonthlyChart',
      data: [
        { label: 'Mai/26', value: 70100 },
        { label: 'Jun/26', value: 72300 },
        { label: 'Jul/26', value: 75950.07 },
      ],
    },
    {
      type: 'transactionList',
      includeMember: true,
      data: [
        { date: '2026-07-03', description: 'Dízimo culto domingo', category: 'Dízimos', member: 'João da Silva', value: 250 },
        { date: '2026-07-05', description: 'Conta de energia', category: 'Utilidades', member: null, value: -842.31 },
        { date: '2026-07-10', description: 'Oferta missionária', category: 'Ofertas', member: 'Maria Souza', value: 1200 },
      ],
    },
    { type: 'summary', data: { previousBalance: 59205.68, totalIncome: 92782.82, totalExpense: 75950.07, finalBalance: 76038.43 } },
  ],
};

async function main(): Promise<void> {
  const html = buildHtml(payload);
  writeFileSync('fixture.html', html);
  const pdf = await renderPdf(html, true);
  writeFileSync('fixture.pdf', pdf);
  // eslint-disable-next-line no-console
  console.log(`fixture.pdf gerado (${pdf.length} bytes) e fixture.html`);
}

void main();
