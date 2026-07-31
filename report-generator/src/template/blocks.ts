import type {
  CategoryValue,
  MinistryGroup,
  ReportBlock,
  ReportBlockType,
  ReportMeta,
  SummaryData,
} from '../types/report-payload';
import { barChart, pieChart } from './charts';
import { escapeHtml, formatCurrency, formatDate } from './format';

/** Sanitiza a cor vinda do dado antes de interpolar em `style` (anti-injeção). */
function cssColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#9CA3AF';
}

function emptyState(message = 'Sem lançamentos no período.'): string {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

interface SlideOptions {
  block: ReportBlockType;
  eyebrow: string;
  title: string;
  body: string;
  meta: ReportMeta;
}

/** Estrutura comum de um slide (cabeçalho + corpo + rodapé). */
function slide(o: SlideOptions): string {
  return `<section class="slide" data-block="${o.block}">
  <div class="slide__head">
    <div>
      <div class="slide__eyebrow">${escapeHtml(o.eyebrow)}</div>
      <h2 class="slide__title">${escapeHtml(o.title)}</h2>
    </div>
  </div>
  <div class="slide__body">${o.body}</div>
  <div class="slide__foot">
    <span><b>Miyrah</b> · ${escapeHtml(o.meta.churchName)}</span>
    <span>${escapeHtml(o.meta.periodLabel)}</span>
  </div>
</section>`;
}

function categoryRows(items: CategoryValue[]): string {
  return items
    .map(
      (item) =>
        `<tr><td><span class="dot" style="background:${cssColor(item.color)}"></span>${escapeHtml(item.name)}</td>` +
        `<td class="num">${formatCurrency(item.value)}</td></tr>`,
    )
    .join('');
}

function categoryTable(items: CategoryValue[]): string {
  if (items.length === 0) return emptyState();
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return `<table class="table">
    <thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead>
    <tbody>${categoryRows(items)}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${formatCurrency(total)}</td></tr></tfoot>
  </table>`;
}

function ministryTable(groups: MinistryGroup[]): string {
  if (groups.length === 0) return emptyState();
  const total = groups.reduce((sum, group) => sum + group.subtotal, 0);
  const blocks = groups
    .map(
      (group) =>
        `<div class="ministry">
      <div class="ministry__head">
        <span class="ministry__name">${escapeHtml(group.ministry)}</span>
        <span class="ministry__subtotal">${formatCurrency(group.subtotal)}</span>
      </div>
      <table class="table table--compact"><tbody>${categoryRows(group.byCategory)}</tbody></table>
    </div>`,
    )
    .join('');
  return `<div class="ministries">${blocks}</div>
  <div class="total-geral"><span>Total geral</span><span class="num">${formatCurrency(total)}</span></div>`;
}

function summaryBody(data: SummaryData): string {
  return `<div class="summary">
    <div class="summary__row"><span>Saldo anterior</span><span>${formatCurrency(data.previousBalance)}</span></div>
    <div class="summary__row"><span class="summary__label--in">+ Entradas do período</span><span class="pos">${formatCurrency(data.totalIncome)}</span></div>
    <div class="summary__row"><span class="summary__label--out">− Saídas do período</span><span class="neg">${formatCurrency(data.totalExpense)}</span></div>
    <div class="summary__row summary__row--final"><span>= Saldo final</span><span>${formatCurrency(data.finalBalance)}</span></div>
  </div>`;
}

function pieBody(id: string, items: CategoryValue[]): string {
  if (items.length === 0) return emptyState();
  return `<div class="chart-wrap chart-wrap--pie">${pieChart(id, items)}</div>`;
}

function barBody(id: string, items: { label: string; value: number }[], color: string): string {
  if (items.length === 0) return emptyState();
  return `<div class="chart-wrap">${barChart(id, items, color)}</div>`;
}

function transactionListBody(includeMember: boolean, rows: {
  date: string;
  description?: string | null;
  category: string;
  member?: string | null;
  value: number;
}[]): string {
  if (rows.length === 0) return emptyState();
  const head =
    `<tr><th>Data</th><th>Descrição</th><th>Categoria</th>${includeMember ? '<th>Membro</th>' : ''}<th class="num">Valor</th></tr>`;
  const body = rows
    .map(
      (row) =>
        `<tr><td>${formatDate(row.date)}</td>` +
        `<td>${escapeHtml(row.description ?? '—')}</td>` +
        `<td>${escapeHtml(row.category)}</td>` +
        (includeMember ? `<td>${escapeHtml(row.member ?? '—')}</td>` : '') +
        `<td class="num ${row.value < 0 ? 'neg' : 'pos'}">${formatCurrency(row.value)}</td></tr>`,
    )
    .join('');
  return `<div class="tx-list"><table class="table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** Capa: sempre o primeiro slide, renderizada a partir de `meta`. */
export function renderCover(meta: ReportMeta): string {
  return `<section class="slide slide--cover" data-block="cover">
  <div class="cover__brand">Miyrah</div>
  <h1 class="cover__title">Relatório<br>Financeiro</h1>
  <div class="cover__church">${escapeHtml(meta.churchName)}</div>
  <div class="cover__period">${escapeHtml(meta.periodLabel)}</div>
  <div class="cover__meta">Gerado em ${escapeHtml(meta.generatedAtLabel)}</div>
</section>`;
}

/** Um bloco → um slide. O `data-block` espelha o `type` (usado nos testes). */
export function renderBlock(block: ReportBlock, meta: ReportMeta): string {
  switch (block.type) {
    case 'incomeByCategory':
      return slide({ block: block.type, eyebrow: 'Entradas', title: 'Entradas por Categoria', meta, body: categoryTable(block.data) });
    case 'incomeByMinistry':
      return slide({ block: block.type, eyebrow: 'Entradas', title: 'Entradas por Ministério', meta, body: ministryTable(block.data) });
    case 'incomeCategoryChart':
      return slide({ block: block.type, eyebrow: 'Entradas', title: 'Distribuição de Entradas', meta, body: pieBody('chart_income_cat', block.data) });
    case 'incomeMonthlyChart':
      return slide({ block: block.type, eyebrow: 'Entradas', title: 'Histórico Mensal de Entradas', meta, body: barBody('chart_income_month', block.data, '#15803D') });
    case 'expenseByMinistry':
      return slide({ block: block.type, eyebrow: 'Saídas', title: 'Saídas por Ministério', meta, body: ministryTable(block.data) });
    case 'expenseByCategory':
      return slide({ block: block.type, eyebrow: 'Saídas', title: 'Saídas por Categoria', meta, body: categoryTable(block.data) });
    case 'expenseCategoryChart':
      return slide({ block: block.type, eyebrow: 'Saídas', title: 'Distribuição de Saídas', meta, body: pieBody('chart_expense_cat', block.data) });
    case 'expenseMonthlyChart':
      return slide({ block: block.type, eyebrow: 'Saídas', title: 'Histórico Mensal de Saídas', meta, body: barBody('chart_expense_month', block.data, '#B91C1C') });
    case 'transactionList':
      return slide({ block: block.type, eyebrow: 'Detalhe', title: 'Lista de Transações', meta, body: transactionListBody(block.includeMember, block.data) });
    case 'summary':
      return slide({ block: block.type, eyebrow: 'Resumo', title: 'Balanço do Período', meta, body: summaryBody(block.data) });
  }
}
