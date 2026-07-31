# Miyrah — Report Generator (Lambda)

Microsserviço serverless que renderiza o **relatório financeiro em PDF** da Miyrah.
É um **renderizador puro**: recebe um `ReportPayload` (JSON já agregado pela API),
abre o Chromium headless, renderiza um template HTML + Chart.js de slides 16:9,
exporta o PDF, sobe ao S3 (privado) e devolve a `key`. Não conhece o banco nem
tem credenciais de rede além da escrita no bucket.

Ver o plano completo em `../wiki/api/_plano-backend-reports.md`.

## Fluxo

```
API (NestJS)  --InvokeCommand (RequestResponse)-->  Lambda  --PutObject-->  S3
                       { ReportPayload }              (Chromium)     { key }
```

A API valida o pedido, monta o `ReportPayload`, invoca esta função de forma síncrona,
recebe a `key`, grava o histórico e gera uma URL assinada. Se a Lambda falhar, a API
responde 5xx e **nada** é gravado (sem registro órfão).

## Contrato (`ReportPayload`)

Definido e validado por Zod em `src/types/report-payload.ts`. `meta` (dados da capa e
rodapé) + `blocks[]` (um slide por bloco, **na ordem recebida** — a API é quem ordena).
A capa é implícita (sempre o primeiro slide). Tipos de bloco: `summary`,
`incomeByCategory`, `incomeByMinistry`, `incomeCategoryChart`, `incomeMonthlyChart`,
`expenseByMinistry`, `expenseByCategory`, `expenseCategoryChart`, `expenseMonthlyChart`,
`transactionList`.

## Estrutura

```
src/
  main.ts               handler: valida(zod) → buildHtml → renderPdf → uploadPdf → { key }
  config.ts             env (S3, região, IS_OFFLINE)
  types/                contrato + schema zod
  template/             layout + blocos + gráficos + fontes + formatação (gera o HTML)
  render/               Puppeteer (Chromium local em dev, @sparticuz/chromium na Lambda)
  s3/                   upload (PutObject)
  scripts/render-fixture.ts   gera um PDF de exemplo local (aceite visual)
assets/fonts/           .woff2 da identidade (ver README lá; ausentes → fallback web-safe)
```

## Desenvolvimento

```bash
npm install                 # inclui puppeteer full (baixa um Chromium ~150MB)
npm test                    # testes unitários do template (não precisam de Chromium)
npm run render:fixture      # gera fixture.pdf e fixture.html na raiz (precisa do Chromium)
npm start                   # serverless offline (invoke em http://localhost:3005)
```

Variáveis de ambiente (`.env.local`, gitignored): `IS_OFFLINE`, `AWS_REGION`,
`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

### Integração local com a API

1. Na raiz do repo: `docker compose up` (Postgres + MinIO; `minio-init` cria o bucket).
2. Aqui: `npm start` (serverless-offline expõe o invoke em `:3005`).
3. No `.env` da API: `LAMBDA_ENDPOINT=http://host.docker.internal:3005` (a API roda no
   container e alcança a Lambda no host) e `S3_PUBLIC_ENDPOINT=http://localhost:9000`.

## Deploy (AWS) — responsabilidade do operador

- **Fontes:** adicione os `.woff2` em `assets/fonts/` (ver README lá) antes do deploy,
  senão o PDF sai em fallback.
- **Chromium:** confirme que a versão de `@sparticuz/chromium` casa com a do
  `puppeteer-core` (ambas resolvem para a mesma versão de Chromium).
- **Empacotamento:** `serverless-esbuild` (zip). `@sparticuz/chromium`/`puppeteer-core`
  são `external` e o binário do Chromium vai no zip; `chart.umd.js` e `assets/` entram
  via `package.patterns`. Se o pacote passar de 250MB (unzipped), migre para imagem de
  container (ECR) — ver decisão #10 do plano.
- **IAM:** a função recebe apenas `s3:PutObject` no bucket. Em produção deixe as
  credenciais S3 vazias no ambiente para usar o IAM role.
- `sls deploy` (o `service`/`function` resultante é `report-generator-<stage>-process`).
