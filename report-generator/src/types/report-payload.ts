import { z } from 'zod';

/**
 * Contrato do payload API → Lambda. A Lambda é um renderizador puro: não
 * conhece o banco, apenas valida este JSON e o transforma em PDF. A API é
 * responsável por agregar os dados e por ordenar `blocks` (a ordem recebida
 * é a ordem dos slides). A capa é implícita (renderizada de `meta`).
 */

const categoryValueSchema = z.object({
  name: z.string(),
  color: z.string(),
  value: z.number(),
});

const ministryGroupSchema = z.object({
  ministry: z.string(),
  subtotal: z.number(),
  byCategory: z.array(categoryValueSchema),
});

const monthlyPointSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const transactionRowSchema = z.object({
  date: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  member: z.string().nullable().optional(),
  value: z.number(),
});

const summaryDataSchema = z.object({
  previousBalance: z.number(),
  totalIncome: z.number(),
  totalExpense: z.number(),
  finalBalance: z.number(),
});

/** União discriminada por `type` — cada bloco vira exatamente um slide. */
export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('summary'), data: summaryDataSchema }),
  z.object({ type: z.literal('incomeByCategory'), data: z.array(categoryValueSchema) }),
  z.object({ type: z.literal('incomeByMinistry'), data: z.array(ministryGroupSchema) }),
  z.object({ type: z.literal('incomeCategoryChart'), data: z.array(categoryValueSchema) }),
  z.object({ type: z.literal('incomeMonthlyChart'), data: z.array(monthlyPointSchema) }),
  z.object({ type: z.literal('expenseByMinistry'), data: z.array(ministryGroupSchema) }),
  z.object({ type: z.literal('expenseByCategory'), data: z.array(categoryValueSchema) }),
  z.object({ type: z.literal('expenseCategoryChart'), data: z.array(categoryValueSchema) }),
  z.object({ type: z.literal('expenseMonthlyChart'), data: z.array(monthlyPointSchema) }),
  z.object({
    type: z.literal('transactionList'),
    includeMember: z.boolean(),
    data: z.array(transactionRowSchema),
  }),
]);

export const reportMetaSchema = z.object({
  churchId: z.string(),
  churchName: z.string(),
  periodLabel: z.string(),
  dateFrom: z.string(),
  dateTo: z.string(),
  generatedAtLabel: z.string(),
});

export const reportPayloadSchema = z.object({
  meta: reportMetaSchema,
  blocks: z.array(blockSchema),
});

export type CategoryValue = z.infer<typeof categoryValueSchema>;
export type MinistryGroup = z.infer<typeof ministryGroupSchema>;
export type MonthlyPoint = z.infer<typeof monthlyPointSchema>;
export type TransactionRow = z.infer<typeof transactionRowSchema>;
export type SummaryData = z.infer<typeof summaryDataSchema>;
export type ReportBlock = z.infer<typeof blockSchema>;
export type ReportBlockType = ReportBlock['type'];
export type ReportMeta = z.infer<typeof reportMetaSchema>;
export type ReportPayload = z.infer<typeof reportPayloadSchema>;
