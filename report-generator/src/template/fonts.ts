import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface FontDef {
  family: string;
  file: string;
  weight: number;
  style: 'normal' | 'italic';
}

/**
 * Fontes da identidade Miyrah. Coloque os `.woff2` em `assets/fonts/` com estes
 * nomes exatos para ativá-las (ver assets/fonts/README.md). Enquanto ausentes,
 * o CSS cai no stack de fallback definido em layout.ts.
 */
const FONT_FILES: FontDef[] = [
  {
    family: 'Recoleta',
    file: 'Recoleta-Regular.woff2',
    weight: 400,
    style: 'normal',
  },
  {
    family: 'Recoleta',
    file: 'Recoleta-SemiBold.woff2',
    weight: 600,
    style: 'normal',
  },
  {
    family: 'Barlow',
    file: 'Barlow-Regular.woff2',
    weight: 400,
    style: 'normal',
  },
  {
    family: 'Barlow',
    file: 'Barlow-Medium.woff2',
    weight: 500,
    style: 'normal',
  },
  {
    family: 'Barlow',
    file: 'Barlow-SemiBold.woff2',
    weight: 600,
    style: 'normal',
  },
  {
    family: 'JetBrains Mono',
    file: 'JetBrainsMono-Regular.woff2',
    weight: 400,
    style: 'normal',
  },
];

function fontsDir(): string {
  const base = process.env.ASSETS_DIR ?? join(process.cwd(), 'assets');
  return join(base, 'fonts');
}

/**
 * Regras @font-face embutindo cada `.woff2` encontrado como data URI — o
 * Chromium na Lambda não tem fontes de sistema, então sem embutir o PDF cai
 * em fallback silenciosamente. Fontes ausentes são ignoradas.
 */
export function loadFontFaces(): string {
  const dir = fontsDir();
  const faces: string[] = [];
  for (const font of FONT_FILES) {
    const path = join(dir, font.file);
    if (!existsSync(path)) continue;
    const base64 = readFileSync(path).toString('base64');
    faces.push(
      `@font-face{font-family:'${font.family}';font-style:${font.style};` +
        `font-weight:${font.weight};font-display:swap;` +
        `src:url(data:font/woff2;base64,${base64}) format('woff2');}`,
    );
  }
  return faces.join('\n');
}
