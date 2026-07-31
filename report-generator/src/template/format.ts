/** Formatação pt-BR (ICU completo no Node ≥13). */

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** R$ 1.234,56 (aceita negativos: -R$ 200,00). */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/** 'YYYY-MM-DD' → 'DD/MM/AAAA', sem depender de timezone. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Escapa texto para interpolação segura em HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
