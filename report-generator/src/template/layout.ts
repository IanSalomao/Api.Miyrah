import { loadChartJs } from './charts';
import { loadFontFaces } from './fonts';

/** CSS dos slides 16:9 (1280×720). Fontes com fallback web-safe caso ausentes. */
const BASE_CSS = `
:root{
  --ink:#14142B;--muted:#6B7280;--line:#E6E6EF;--soft:#F6F6FB;
  --income:#15803D;--expense:#B91C1C;--accent:#6D28D9;
  --font-display:'Recoleta','Fraunces',Georgia,'Times New Roman',serif;
  --font-body:'Barlow',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  --font-mono:'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',monospace;
}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#fff;color:var(--ink);font-family:var(--font-body);
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.slide{position:relative;width:1280px;height:720px;padding:60px 72px 72px;
  page-break-after:always;display:flex;flex-direction:column;overflow:hidden;}
.slide:last-child{page-break-after:auto;}
.slide__head{display:flex;align-items:flex-end;justify-content:space-between;
  border-bottom:2px solid var(--line);padding-bottom:16px;margin-bottom:28px;}
.slide__eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.16em;
  color:var(--accent);font-weight:600;margin-bottom:6px;}
.slide__title{font-family:var(--font-display);font-size:34px;font-weight:600;letter-spacing:-.01em;}
.slide__hint{font-size:13px;color:var(--muted);}
.slide__body{flex:1;min-height:0;}
.slide__foot{position:absolute;left:72px;right:72px;bottom:26px;display:flex;
  justify-content:space-between;font-size:12px;color:var(--muted);
  border-top:1px solid var(--line);padding-top:12px;}
.slide__foot b{font-family:var(--font-display);font-weight:600;color:var(--ink);}

/* tabelas */
.table{width:100%;border-collapse:collapse;font-size:16px;}
.table th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.08em;
  color:var(--muted);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--line);}
.table td{padding:11px 12px;border-bottom:1px solid var(--soft);}
.table .num{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap;}
.table tfoot td{font-weight:700;border-top:2px solid var(--line);border-bottom:none;font-size:17px;}
.table--compact td,.table--compact th{padding:7px 12px;font-size:14px;}
.dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:10px;vertical-align:middle;}
.pos{color:var(--income);}
.neg{color:var(--expense);}

/* grupos por ministério */
.ministries{display:flex;flex-direction:column;gap:16px;}
.ministry{border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.ministry__head{display:flex;justify-content:space-between;align-items:center;
  background:var(--soft);padding:12px 16px;font-weight:600;}
.ministry__name{font-size:16px;}
.ministry__subtotal{font-family:var(--font-mono);font-variant-numeric:tabular-nums;}
.ministry .table{font-size:14px;}
.ministry .table td{padding:8px 16px;}
.total-geral{display:flex;justify-content:space-between;margin-top:20px;padding-top:14px;
  border-top:2px solid var(--ink);font-size:20px;font-weight:700;}
.total-geral .num{font-family:var(--font-mono);}

/* resumo / balanço */
.summary{max-width:720px;margin:8px auto 0;}
.summary__row{display:flex;justify-content:space-between;align-items:center;
  padding:18px 4px;border-bottom:1px solid var(--line);font-size:22px;}
.summary__row span:last-child{font-family:var(--font-mono);font-variant-numeric:tabular-nums;}
.summary__row--final{border-bottom:none;border-top:3px solid var(--ink);margin-top:8px;
  font-family:var(--font-display);font-weight:600;font-size:30px;}
.summary__label--in{color:var(--income);}
.summary__label--out{color:var(--expense);}

/* gráficos */
.chart-wrap{display:flex;align-items:center;justify-content:center;height:100%;}
.chart-wrap--pie{gap:8px;}

/* lista de transações */
.tx-list .table{font-size:13.5px;}
.tx-list .table td,.tx-list .table th{padding:6px 12px;}

/* estado vazio */
.empty{display:flex;align-items:center;justify-content:center;height:100%;
  color:var(--muted);font-size:18px;}

/* capa */
.slide--cover{justify-content:center;align-items:flex-start;
  background:linear-gradient(135deg,#1B1036 0%,#2E1065 55%,#4C1D95 100%);color:#fff;}
.cover__brand{font-family:var(--font-display);font-size:22px;letter-spacing:.02em;opacity:.85;}
.cover__title{font-family:var(--font-display);font-size:76px;font-weight:600;line-height:1.02;
  margin:22px 0 44px;letter-spacing:-.02em;}
.cover__church{font-size:30px;font-weight:500;}
.cover__period{font-size:20px;opacity:.82;margin-top:10px;}
.cover__meta{position:absolute;bottom:56px;left:72px;font-size:14px;opacity:.72;}
`;

/**
 * Shell HTML. As fontes e o Chart.js vão embutidos no <head>; o sentinela
 * `data-charts-ready` (setado após todos os <script> de gráfico rodarem, que
 * são síncronos com animation:false) sinaliza ao render que pode exportar.
 */
export function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>${loadFontFaces()}
${BASE_CSS}</style>
<script>${loadChartJs()}</script>
</head><body>
${body}
<script>document.body.setAttribute('data-charts-ready','true');</script>
</body></html>`;
}
