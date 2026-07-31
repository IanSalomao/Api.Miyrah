# Fontes da identidade Miyrah

O Chromium na Lambda **não tem fontes de sistema** — sem embutir os `.woff2` aqui,
o PDF renderiza em fallback web-safe (definido em `src/template/layout.ts`) e perde a
identidade tipográfica. O carregador (`src/template/fonts.ts`) embute automaticamente,
como data URI, qualquer arquivo abaixo que existir. Basta colocá-los com **estes nomes exatos**:

| Arquivo esperado                | Família        | Peso |
| ------------------------------- | -------------- | ---- |
| `Recoleta-Regular.woff2`        | Recoleta       | 400  |
| `Recoleta-SemiBold.woff2`       | Recoleta       | 600  |
| `Barlow-Regular.woff2`          | Barlow         | 400  |
| `Barlow-Medium.woff2`           | Barlow         | 500  |
| `Barlow-SemiBold.woff2`         | Barlow         | 600  |
| `JetBrainsMono-Regular.woff2`   | JetBrains Mono | 400  |

- **Recoleta** é uma fonte comercial (display/serif) — use a licença da igreja/projeto.
- **Barlow** e **JetBrains Mono** são open source (OFL), disponíveis no Google Fonts.

Nenhum `.woff2` é versionado no repositório; adicione-os no ambiente de build/deploy.
