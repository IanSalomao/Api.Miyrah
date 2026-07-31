import { launchBrowser } from './browser';

/**
 * Renderiza o HTML de slides num PDF 16:9 (1280×720 px lógicos). Cada `.slide`
 * ocupa uma página (page-break-after). Espera o sentinela `data-charts-ready`
 * antes de exportar, garantindo que os gráficos Chart.js já pintaram.
 */
export async function renderPdf(html: string, isOffline: boolean): Promise<Buffer> {
  const browser = await launchBrowser(isOffline);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page
      .waitForSelector('body[data-charts-ready="true"]', { timeout: 8000 })
      .catch(() => undefined);

    const pdf = await page.pdf({
      printBackground: true,
      width: '1280px',
      height: '720px',
      pageRanges: '', // todas
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
