import type { ReportPayload } from '../types/report-payload';
import { renderBlock, renderCover } from './blocks';
import { layout } from './layout';

/**
 * Monta o HTML completo: capa (implícita) + um slide por bloco, na ordem em
 * que a API os enviou. Não reordena nem filtra — essa responsabilidade é da API.
 */
export function buildHtml(payload: ReportPayload): string {
  const slides = [
    renderCover(payload.meta),
    ...payload.blocks.map((block) => renderBlock(block, payload.meta)),
  ];
  return layout(slides.join('\n'));
}
