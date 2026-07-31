/**
 * Helpers puros de agregação financeira. Espelham a lógica do DashboardService
 * (round2, breakdown por categoria, bucketização mensal) — mantidos separados
 * para não acoplar reports ↔ dashboard; unificar é um follow-up possível.
 */

const MONTH_ABBR_PT_BR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Date → 'YYYY-MM-DD' (colunas @db.Date já vêm em UTC meia-noite). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthLabelPtBr(year: number, monthIndex: number): string {
  return `${MONTH_ABBR_PT_BR[monthIndex]}/${String(year).slice(-2)}`;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Sequência contínua de meses [from, to], inclusive buckets vazios. */
export function buildMonthlyBuckets(
  from: Date,
  to: Date,
): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
  );
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    buckets.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: monthLabelPtBr(year, month),
    });
    cursor.setUTCMonth(month + 1);
  }
  return buckets;
}

export interface CategoryRow {
  value: number;
  category: { id: string; name: string; color: string };
}

/**
 * Agrega por categoria (magnitude, sempre positiva), ordenado por valor desc.
 * Categoria soft-deletada ainda referida por uma transação continua aparecendo.
 */
export function categoryBreakdown(
  rows: CategoryRow[],
): { name: string; color: string; value: number }[] {
  const buckets = new Map<
    string,
    { name: string; color: string; value: number }
  >();
  for (const row of rows) {
    const bucket = buckets.get(row.category.id) ?? {
      name: row.category.name,
      color: row.category.color,
      value: 0,
    };
    bucket.value += Math.abs(row.value);
    buckets.set(row.category.id, bucket);
  }
  return [...buckets.values()]
    .sort((a, b) => b.value - a.value)
    .map((bucket) => ({ ...bucket, value: round2(bucket.value) }));
}
