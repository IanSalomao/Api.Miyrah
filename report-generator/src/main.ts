import { loadConfig } from './config';
import { logger } from './logger';
import { renderPdf } from './render/render-pdf';
import { uploadPdf } from './s3/upload';
import { buildHtml } from './template/build-html';
import { reportPayloadSchema } from './types/report-payload';

export interface RenderResult {
  key: string;
}

/** Rastreia cold start entre invocações no mesmo container quente. */
let warmed = false;

/**
 * Handler síncrono (RequestResponse). Recebe o ReportPayload da API, renderiza
 * o PDF via Chromium, sobe ao S3 e devolve `{ key }`. Qualquer falha propaga
 * (a API traduz para 5xx e não grava histórico órfão).
 */
export async function handler(event: unknown): Promise<RenderResult> {
  const startedAt = Date.now();
  const coldStart = !warmed;
  warmed = true;

  const config = loadConfig();
  const payload = reportPayloadSchema.parse(event);

  logger.info('Render iniciado', {
    churchId: payload.meta.churchId,
    blocks: payload.blocks.length,
    coldStart,
  });

  const html = buildHtml(payload);
  const pdf = await renderPdf(html, config.isOffline);
  const key = await uploadPdf(pdf, payload.meta.churchId, config);

  logger.info('Render concluído', {
    key,
    pdfBytes: pdf.length,
    payloadBytes: JSON.stringify(event).length,
    durationMs: Date.now() - startedAt,
    coldStart,
  });

  return { key };
}
