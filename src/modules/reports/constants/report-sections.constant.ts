/**
 * Chaves dos blocos do relatório (enum de `sections` no POST /v1/reports).
 * Semântica de cada bloco: ver Miyrah#Relatórios e wiki/api/reports.md.
 */
export const REPORT_SECTIONS = [
  'summary',
  'incomeByCategory',
  'incomeByMinistry',
  'incomeCategoryChart',
  'incomeMonthlyChart',
  'expenseByMinistry',
  'expenseByCategory',
  'expenseCategoryChart',
  'expenseMonthlyChart',
  'transactionList',
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

/**
 * Ordem fixa dos slides no PDF, independente da ordem enviada pelo cliente:
 * Entradas → Saídas → Detalhe → Resumo (a capa é implícita, sempre primeiro,
 * e o balanço/summary por último). A API ordena; a Lambda só itera.
 */
export const REPORT_SECTION_ORDER: readonly ReportSection[] = [
  'incomeByCategory',
  'incomeByMinistry',
  'incomeCategoryChart',
  'incomeMonthlyChart',
  'expenseByMinistry',
  'expenseByCategory',
  'expenseCategoryChart',
  'expenseMonthlyChart',
  'transactionList',
  'summary',
];
