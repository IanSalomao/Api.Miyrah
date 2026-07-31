import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CategoryValue, MonthlyPoint } from '../types/report-payload';

let chartJsCache: string | null = null;

/**
 * Lê o UMD do Chart.js para injetar inline no HTML — o Chromium na Lambda pode
 * não ter acesso de rede (CDN é frágil), então o script vai embutido. Incluído
 * no pacote via `patterns` no serverless.yml.
 */
export function loadChartJs(): string {
  if (chartJsCache) return chartJsCache;
  const candidates = [
    process.env.CHART_JS_PATH,
    join(process.cwd(), 'node_modules/chart.js/dist/chart.umd.js'),
    join(__dirname, '../../node_modules/chart.js/dist/chart.umd.js'),
    join(process.env.ASSETS_DIR ?? join(process.cwd(), 'assets'), 'vendor/chart.umd.js'),
  ].filter((p): p is string => Boolean(p));

  for (const path of candidates) {
    if (existsSync(path)) {
      chartJsCache = readFileSync(path, 'utf8');
      return chartJsCache;
    }
  }
  throw new Error(
    'chart.umd.js não encontrado. Instale `chart.js` ou aponte CHART_JS_PATH.',
  );
}

const COMMON = 'responsive:false,animation:false,maintainAspectRatio:false';

/** Pizza (distribuição por categoria). A cor vem do dado, nunca de paleta própria. */
export function pieChart(id: string, items: CategoryValue[]): string {
  const labels = items.map((i) => i.name);
  const data = items.map((i) => i.value);
  const colors = items.map((i) => i.color);
  return `<canvas id="${id}" width="460" height="440"></canvas>
<script>new Chart(document.getElementById('${id}'),{type:'doughnut',` +
    `data:{labels:${json(labels)},datasets:[{data:${json(data)},backgroundColor:${json(colors)},borderColor:'#ffffff',borderWidth:2}]},` +
    `options:{${COMMON},cutout:'56%',plugins:{legend:{position:'right',labels:{font:{size:14,family:'Barlow'},boxWidth:14,padding:14}}}}});</script>`;
}

/** Barras (histórico mensal). Cor semântica única por série (entradas/saídas). */
export function barChart(id: string, items: MonthlyPoint[], color: string): string {
  const labels = items.map((i) => i.label);
  const data = items.map((i) => i.value);
  return `<canvas id="${id}" width="1040" height="440"></canvas>
<script>new Chart(document.getElementById('${id}'),{type:'bar',` +
    `data:{labels:${json(labels)},datasets:[{data:${json(data)},backgroundColor:'${color}',borderRadius:6,maxBarThickness:72}]},` +
    `options:{${COMMON},layout:{padding:8},scales:{y:{beginAtZero:true,ticks:{font:{family:'Barlow'},callback:function(v){return 'R$ '+Number(v).toLocaleString('pt-BR');}}},x:{ticks:{font:{family:'Barlow'}},grid:{display:false}}},plugins:{legend:{display:false}}}});</script>`;
}

/** JSON seguro para embutir em <script> (neutraliza `</script>` dentro de strings). */
function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
