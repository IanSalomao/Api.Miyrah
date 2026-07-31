/**
 * Contrato do payload que a API monta e envia à Lambda de render. Espelha
 * `report-generator/src/types/report-payload.ts` (projetos separados no
 * monorepo, sem import cruzado). A Lambda revalida com Zod ao receber.
 */

export interface CategoryValue {
  name: string;
  color: string;
  value: number;
}

export interface MinistryGroup {
  ministry: string;
  subtotal: number;
  byCategory: CategoryValue[];
}

export interface MonthlyPoint {
  label: string;
  value: number;
}

export interface TransactionRow {
  date: string;
  description?: string | null;
  category: string;
  member?: string | null;
  value: number;
}

export interface SummaryData {
  previousBalance: number;
  totalIncome: number;
  totalExpense: number;
  finalBalance: number;
}

export type ReportBlock =
  | { type: 'summary'; data: SummaryData }
  | {
      type:
        | 'incomeByCategory'
        | 'expenseByCategory'
        | 'incomeCategoryChart'
        | 'expenseCategoryChart';
      data: CategoryValue[];
    }
  | { type: 'incomeByMinistry' | 'expenseByMinistry'; data: MinistryGroup[] }
  | { type: 'incomeMonthlyChart' | 'expenseMonthlyChart'; data: MonthlyPoint[] }
  | { type: 'transactionList'; includeMember: boolean; data: TransactionRow[] };

export interface ReportMeta {
  churchId: string;
  churchName: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  generatedAtLabel: string;
}

export interface ReportPayload {
  meta: ReportMeta;
  blocks: ReportBlock[];
}
