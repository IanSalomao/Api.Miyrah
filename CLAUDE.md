# CLAUDE.md

Este arquivo orienta o Claude Code ao trabalhar neste repositório — a **API Miyrah**.

## Natureza deste repositório

Backend em NestJS do sistema Miyrah, um sistema de gestão financeira para igrejas (controle de entradas/saídas, membros, ministérios, categorias e relatórios). Este repo cuida só da API; não há front-end aqui.

> [!important] Fonte da verdade do produto
> A especificação funcional completa (requisitos, telas, regras de negócio, campos de formulário) vive em
> `/home/ian/Documentos/I'AM/PESSOAL/MIYRAH/Miyrah.md`.
> Este CLAUDE.md **não repete** aquele conteúdo — ele documenta apenas decisões de arquitetura/engenharia da API. Sempre que uma dúvida for sobre comportamento de tela, campo ou regra de negócio, a resposta está lá, não aqui.

> [!note] Estado atual do código
> Todo o roadmap está implementado, com testes unitários e e2e: fundações (Docker Compose, schema Prisma + migrations, config Zod, envelope global de resposta/erro, prefixo `/v1`, Swagger em `/docs`, PrismaModule com extension de multi-tenancy via AsyncLocalStorage), `auth` (cadastro, login, guard global, recuperação de senha), os CRUDs `members`/`ministries`/`categories`/`transactions`, `account` (perfil, senha, exclusão), `dashboard` (agregações) e `reports` (geração de PDF via a Lambda `report-generator/`).
>
> Ambiente de dev roda em containers: todo `npm`/`npx` da API deve ser executado dentro do serviço `dev` (`docker exec miyrah-api-dev-1 ...`) — o `node_modules` do host não é usado. **Exceção:** o `report-generator/` é um projeto à parte que roda no **host** (`npm`/`serverless offline` diretamente), pois precisa do Chromium local.

## Stack

| Camada         | Tecnologia                                                    |
| -------------- | ------------------------------------------------------------- |
| Linguagem      | TypeScript                                                    |
| Framework      | NestJS                                                        |
| Banco de dados | PostgreSQL                                                    |
| ORM            | Prisma (Client + Migrate)                                     |
| Autenticação   | JWT (stateless, expiração variável — ver seção Autenticação)  |
| Validação      | class-validator + class-transformer (DTOs)                    |
| Env config     | `@nestjs/config` + validação de schema com Zod                |
| Docs de API    | `@nestjs/swagger`                                             |
| E-mail         | Resend (recuperação de senha)                                 |
| Geração de PDF | Puppeteer (relatórios)                                        |
| Storage        | Object storage S3-compatible (MinIO local / S3 ou R2 em prod) |
| Testes         | Jest (unit) + Supertest (e2e)                                 |

## Comandos

```bash
npm run start:dev      # servidor de dev com hot-reload
npm run start:debug    # servidor de dev com debugger + hot-reload
npm run build          # compila para dist/ (nest build)
npm run lint           # eslint --fix em src/, apps/, libs/, test/
npm run format         # prettier --write em src/ e test/

npm run test           # testes unitários (Jest; rootDir src/, pega todo *.spec.ts)
npm run test:watch     # unitários em watch mode
npm run test:cov       # unitários com relatório de cobertura
npm run test:e2e       # e2e via Supertest (test/*.e2e-spec.ts, config em test/jest-e2e.json)
```

Rodar um teste específico:

```bash
npx jest src/auth/auth.service.spec.ts        # um arquivo (unit)
npx jest -t "nome do describe ou it"          # por nome, em qualquer arquivo
npx jest --config ./test/jest-e2e.json test/auth.e2e-spec.ts   # um arquivo e2e
```

## Arquitetura multi-tenant

Cada **igreja** é um tenant. É um schema único no Postgres — **não** há schema nem banco separado por igreja.

- Toda tabela que pertence a uma igreja (membros, ministérios, categorias, transações, relatórios) tem uma coluna `churchId`.
- O escopo por tenant é aplicado de forma centralizada via **Prisma Client Extension** (não confiar em cada service lembrar de filtrar por `churchId` manualmente) — a extension injeta o filtro/valor de `churchId` nas queries a partir do contexto da request autenticada.
- `Church` é ao mesmo tempo o tenant e a entidade de autenticação (ver abaixo) — não existe um modelo `User` separado no MVP, já que o cadastro/login é feito diretamente pela igreja (não há múltiplos usuários por igreja na spec atual).

## Autenticação

- JWT único (sem refresh token), emitido no login.
- Tempo de expiração varia conforme o checkbox "Lembrar-me" do login: sessão curta sem marcar, 30 dias marcando. Os dois valores de expiração devem ser configuráveis via env var, não hardcoded.
- Recuperação de senha: token de uso único, expiração curta (ex.: 1h), enviado por e-mail via Resend, conforme fluxo de 4 passos descrito no spec.

> [!note] Resolvido — revogação imediata na exclusão de conta
> O spec exige que a exclusão de conta desative o acesso **imediatamente**. Decisão implementada (2026-07-13): o `JwtAuthGuard` global confere no banco, a cada request autenticado, se a igreja segue ativa (`findFirst` por PK com `deletedAt: null`). Conta excluída → 401 na hora, mesmo com JWT criptograficamente válido por até 30 dias. Custo aceito: um SELECT por PK por request.

## Estrutura de módulos

O critério de organização não é "feature vs infra", e sim "é um módulo Nest (`@Module`) ou não é". Todo módulo — de domínio ou de infraestrutura — vive em `src/modules/`; o que não é módulo (guards/decorators/filters/pipes compartilhados, validação de env) fica em `src/common/` e `src/config/`, fora de `modules/`:

```
prisma/            # schema.prisma + migrations (o código Nest fica em src/)
report-generator/  # microsserviço serverless (Lambda) que renderiza o PDF — projeto à parte, roda no host
src/
  common/            # sem @Module — guards, decorators, filters, pipes compartilhados
  config/            # sem @Module — validação de env (Zod)
  modules/
    prisma/            # PrismaService + client extension de multi-tenancy + TenantContext
    mail/              # MailService (Resend)
    auth/
    account/           # perfil da igreja, alteração de senha, exclusão de conta
    members/
    ministries/
    categories/
    transactions/
    dashboard/         # agregações de Início e Dashboard
    reports/           # geração de PDF (monta o payload, invoca a Lambda, salva histórico + link)
```

Cada módulo de feature segue o padrão Nest: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.

## Convenções de API

- **Paginação**: offset-based via query params `page` e `limit`.
- **Envelope de resposta para listagens** (dentro do `data` do envelope padrão `{ success, data }`):
  ```json
  {
    "items": [ ... ],
    "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
  }
  ```
- **Validação**: todo endpoint recebe input via DTO com `class-validator`; `ValidationPipe` global com `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- **Documentação**: todo controller/DTO decorado para o Swagger (`@nestjs/swagger`), exposto em `/docs` (ou path equivalente a definir no `main.ts`).
- **Soft delete**: entidades com exclusão lógica (Membros, Ministérios, Categorias, Transações) usam coluna `deletedAt` (nullable). Queries de listagem sempre filtram `deletedAt: null` por padrão.
- Valor de transação é armazenado com sinal (positivo = Entrada, negativo = Saída), conforme regra de negócio do spec — validar no DTO/service que a categoria escolhida é do mesmo tipo da transação.

## Banco de dados / Prisma

- Migrations do Prisma versionadas no repo (`prisma/migrations/`).
- Nomes de modelo em PascalCase singular (`Church`, `Member`, `Ministry`, `Category`, `Transaction`, `Report`), seguindo a convenção padrão do Prisma.
- Todo modelo com tenant (exceto `Church`) tem `churchId` com índice, dado que toda query de listagem filtra por ele.

## Relatórios em PDF

A geração é isolada num **microsserviço serverless** (`report-generator/`, Serverless Framework), não no processo da API. Fluxo (ver `wiki/api/_plano-backend-reports.md`):

- O módulo `reports` valida o pedido, agrega os dados dos blocos marcados (`report-aggregation.service` + `report-payload.builder`) e monta um `ReportPayload` JSON.
- A API **invoca a Lambda de forma síncrona** (`@aws-sdk/client-lambda`, `InvokeCommand` RequestResponse; `LambdaReportRenderer`). A Lambda é um renderizador puro: abre o Chromium (`puppeteer-core` + `@sparticuz/chromium`; em dev usa `puppeteer` full), renderiza um template HTML + Chart.js de slides 16:9, exporta o PDF, sobe ao S3 (privado) e devolve só a `key`.
- Falha/timeout da Lambda → `5xx` e **nenhum** registro é gravado (sem histórico órfão). O `INSERT` em `church_reports` (com o snapshot `params`) só ocorre após a `key` confirmada.
- Download: `S3ReportStorage` gera uma **URL assinada de curta duração** (`@aws-sdk/s3-request-presigner`, TTL via `REPORT_DOWNLOAD_URL_TTL`) sob demanda; o `filePath` interno nunca é exposto.
- `REPORT_RENDERER` e `REPORT_STORAGE` são tokens de injeção → substituídos por fakes no e2e (sem AWS).
- **Topologia dev:** a API roda no container `dev` e a Lambda roda no host via `serverless offline` (invoke em `:3005`) — a API a alcança por `LAMBDA_ENDPOINT=http://host.docker.internal:3005`. O bucket é o MinIO do Docker Compose; as URLs assinadas usam `S3_PUBLIC_ENDPOINT` (ex.: `http://localhost:9000`) para serem abríveis no browser do host. Ver `report-generator/README.md`.

## Testes

- Toda feature nova precisa de: testes unitários do service (regras de negócio) **e** teste e2e do fluxo do endpoint via Supertest.
- Testes unitários ficam junto do arquivo testado (`*.spec.ts`, dentro de `src/`, conforme já configurado no `jest` do `package.json`).
- Testes e2e ficam em `test/*.e2e-spec.ts`.

## Variáveis de ambiente

Validadas via schema Zod no bootstrap (falha rápido se faltar alguma). Lista inicial esperada:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRATION_DEFAULT` (sessão curta, sem "lembrar-me")
- `JWT_EXPIRATION_REMEMBER_ME` (30 dias)
- `RESEND_API_KEY`
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`
- `S3_PUBLIC_ENDPOINT` (opcional; endpoint público para as URLs assinadas de download — em dev, `http://localhost:9000`; cai no `S3_ENDPOINT`)
- `AWS_REGION` (default `us-east-1`), `LAMBDA_REPORT_FUNCTION_NAME` (default `report-generator-dev-process`), `LAMBDA_ENDPOINT` (opcional; em dev aponta ao serverless-offline)
- `REPORT_DOWNLOAD_URL_TTL` (default `900` — TTL em segundos da URL de download)
- `PORT`

## Convenção de commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, ...).

## Roadmap imediato

1. ~~Docker Compose com Postgres local (+ MinIO para storage de relatórios)~~ ✅
2. ~~Inicializar Prisma, definir schema e primeira migration~~ ✅
3. ~~Módulo `auth` (cadastro, login, recuperação de senha)~~ ✅
4. ~~CRUDs de `members`, `ministries`, `categories`, `transactions`~~ ✅
5. ~~Agregações de `dashboard`/Início (cards, gráficos)~~ ✅
6. ~~Geração de relatórios em PDF + storage~~ ✅ (microsserviço `report-generator/` + módulo `reports`)
7. ~~`churches` — perfil, alteração de senha, exclusão de conta~~ ✅ (módulo `account`)
