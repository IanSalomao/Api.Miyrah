import type { Browser } from 'puppeteer-core';

/**
 * Resolve o Chromium conforme o ambiente:
 * - dev (serverless-offline / IS_OFFLINE): `puppeteer` full, que traz um
 *   Chromium baixado e roda no Linux do host;
 * - Lambda: `puppeteer-core` + `@sparticuz/chromium` (binário compatível com
 *   o runtime Amazon Linux, empacotado na função).
 *
 * Os imports são dinâmicos para que o pacote de produção não precise carregar
 * o `puppeteer` full (devDependency) e vice-versa.
 */
export async function launchBrowser(isOffline: boolean): Promise<Browser> {
  if (isOffline) {
    const puppeteer = (await import('puppeteer')).default;
    return (await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1280, height: 720 },
    })) as unknown as Browser;
  }

  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = await import('puppeteer-core');
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}
