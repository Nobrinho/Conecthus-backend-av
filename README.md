# WenLock · API

API REST do **WenLock**, sistema de controle de acesso com CRUD completo de usuários. É a solução da avaliação prática para Desenvolvedor Full Stack da Conecthus.

- **Frontend:** [Conecthus-frontend-av](https://github.com/Nobrinho/Conecthus-frontend-av) (Next.js 16 + React 19), que segue o protótipo do Adobe XD
- **Documentação interativa:** Swagger UI em `http://localhost:3000/docs`

---

## Requisitos da avaliação → onde estão

| Requisito (PDF) | Implementação |
| --- | --- |
| Endpoints de CRUD de usuários | `src/modules/users`: `POST`, `GET` (lista), `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| API RESTful com NestJS | NestJS 12, rotas versionadas em `/api/v1` |
| Documentar com Swagger UI | `/docs`, com exemplos, schemas e todas as respostas de erro de cada rota |
| Banco relacional (MySQL ou PostgreSQL) | PostgreSQL 17 com Prisma 7 |
| Tabelas para os dados dos usuários | `prisma/schema.prisma` + migration em `prisma/migrations` (tabela `users`) |
| Nome só letras · E-mail válido · Matrícula só números · Senha 6 alfanuméricos · todos obrigatórios | `src/modules/users/user.rules.ts` + `dto/create-user.dto.ts` (o frontend repete as mesmas regras) |
| Pesquisa por nome e paginação | `GET /users?search=&page=`, 15 por página, em ordem alfabética |
| Login e recuperação de senha (telas do protótipo) | `src/modules/auth`: JWT + refresh rotacionado, `forgot-password` e `reset-password` por e-mail |

---

## Começando

### Tudo com Docker (recomendado)

```bash
docker compose up --build
```

Sobe o Postgres, aplica as migrations, roda o seed e inicia a API em `http://localhost:3000`. Também sobe o **Mailpit** em `http://localhost:8025`, uma caixa de entrada de desenvolvimento onde chegam os e-mails de recuperação de senha. Depois suba o frontend (veja o README dele) em `http://localhost:3001`.

### Local

Pré-requisitos: Node.js 22.12+ e um Postgres (o `docker compose up -d db mailpit` resolve).

```bash
cp .env.example .env
npm install
npm run prisma:deploy && npm run db:seed
npm run start:dev
```

### Conta de acesso (seed)

| Login | Senha |
| --- | --- |
| `millena.souza@wenlock.com` **ou** matrícula `100001` | `abc123` |

O seed também cria 30 usuários de exemplo (mesma senha) para exercitar a paginação e a busca. Ele é idempotente e se recusa a rodar com `NODE_ENV=production`.

---

## Stack

| Camada | Escolha |
| --- | --- |
| Framework | NestJS 12 (ESM, TypeScript 6) |
| Banco | PostgreSQL 17 com Prisma 7 e driver adapter `@prisma/adapter-pg` |
| Autenticação | JWT de acesso curto + refresh token rotacionado, Passport |
| E-mail | nodemailer via SMTP (Mailpit em desenvolvimento) |
| Documentação | Swagger UI e OpenAPI 3 em `/docs` |
| Validação | `class-validator` nos DTOs, Zod nas variáveis de ambiente |
| Logs | pino com id de requisição e redação de campos sensíveis |
| Testes | Vitest: unidade e e2e contra Postgres real |
| Lint | oxlint + Prettier |

---

## Endpoints

Todas as rotas ficam sob `/api/v1`. Tudo exige `Authorization: Bearer <accessToken>`, exceto o que está marcado como público.

### users

| Método | Rota | O que faz |
| --- | --- | --- |
| `POST` | `/users` | Cadastra. 400 se algum campo fere as regras; 409 se o e-mail ou a matrícula já existem, com `field` indicando qual. |
| `GET` | `/users` | Lista paginada. `search` (parte do nome, sem diferenciar maiúsculas), `page` (a partir de 1), `limit` (padrão 15), `order` (`asc` por padrão). |
| `GET` | `/users/:id` | Busca pelo id (UUID). 404 se não existe. |
| `PATCH` | `/users/:id` | Atualização parcial. Sem `password`, a senha atual é mantida. Grava `updatedAt`. |
| `DELETE` | `/users/:id` | Remove e encerra as sessões do usuário em cascata. Responde 204. |

Resposta de usuário (nunca contém senha nem hash):

```json
{
  "id": "0ed804e4-4d85-4b83-a78e-d2ece90d618f",
  "name": "Adriano Machado Souza",
  "email": "adriano.souza@wenlock.com",
  "registration": "200001",
  "createdAt": "2026-09-30T00:17:34.158Z",
  "updatedAt": null
}
```

`updatedAt` é `null` até a primeira edição. É o que alimenta o "Última edição: Nenhuma" da tela Visualizar.

### auth

| Método | Rota | Acesso | O que faz |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | público | `{ login, password }`. `login` aceita o e-mail **ou** a matrícula. 401 com `Usuário/Senha inválido(a)`. |
| `POST` | `/auth/refresh` | público | Troca o refresh token por um par novo e invalida o antigo. |
| `POST` | `/auth/logout` | público | Encerra a sessão do refresh token enviado. Idempotente. |
| `POST` | `/auth/logout-all` | autenticado | Encerra todas as sessões do usuário. |
| `GET` | `/auth/me` | autenticado | Dados do usuário do token (nome e iniciais do header). |
| `POST` | `/auth/forgot-password` | público | Envia por e-mail um link de uso único para o frontend. 404 `E-mail não cadastrado`. |
| `POST` | `/auth/reset-password` | público | `{ token, password }`. Troca a senha e encerra todas as sessões. 400 se o link é inválido, já usado ou vencido. |

Login, refresh, forgot e reset estão sob o limite estrito de tentativas (`THROTTLE_CREDENTIALS_LIMIT`).

### health

| Método | Rota | Acesso | O que faz |
| --- | --- | --- | --- |
| `GET` | `/health` | público | Checa banco e heap. Responde 503 se algo falhar. |

---

## Regras de validação

Definidas uma única vez em [src/modules/users/user.rules.ts](src/modules/users/user.rules.ts) e aplicadas nos DTOs. O frontend espelha exatamente estas regras para validar enquanto a pessoa digita; a API é quem garante.

| Campo | Regra | Origem |
| --- | --- | --- |
| `name` | Obrigatório, só letras (com acento) separadas por um espaço, até 30 caracteres | PDF "Apenas Letras" + limite do XD |
| `email` | Obrigatório, e-mail válido, até 40 caracteres, único, gravado em minúsculas | PDF + limite do XD |
| `registration` | Obrigatório, só dígitos, de 4 a 10, única, guardada como texto (preserva zeros à esquerda) | PDF "Apenas Números" + limites do XD |
| `password` | Obrigatório, exatamente 6 caracteres alfanuméricos, guardada como hash argon2id | PDF "Alfanuméricos de 6 dígitos" |

Mensagens em português. Campos não declarados no DTO são recusados com 400 (`forbidNonWhitelisted`).

---

## Contratos de resposta

**Listagens** usam sempre o mesmo envelope (`buildPaginatedResult`):

```json
{
  "data": [],
  "meta": { "total": 31, "page": 1, "limit": 15, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": false }
}
```

**Erros** têm um formato só, produzido pelo `AllExceptionsFilter`:

```json
{
  "statusCode": 409,
  "message": "Já existe um usuário com esta matrícula",
  "error": "Conflict",
  "field": "registration",
  "path": "/api/v1/users",
  "timestamp": "2026-09-30T00:19:12.059Z",
  "requestId": "e0911fdc-a3d4-4559-aed9-6885beecb73c"
}
```

`message` é uma string, ou uma lista quando vem da validação. `field` aparece nos conflitos, para o formulário marcar o campo certo. `requestId` é o mesmo do header `x-request-id` e da linha de log.

A unicidade é checada no service para responder com o campo, e a constraint `UNIQUE` do banco continua sendo a garantia final contra corridas: o `P2002` do Prisma também vira 409 com `field` ([prisma-error.mapper.ts](src/common/filters/prisma-error.mapper.ts)). Qualquer erro não tratado vira 500 genérico; o detalhe vai só para o log.

---

## Modelo de dados

[prisma/schema.prisma](prisma/schema.prisma) · migration em `prisma/migrations/*_init`.

| Modelo | Tabela | Papel |
| --- | --- | --- |
| `User` | `users` | `name` VARCHAR(30), `email` VARCHAR(40) único, `registration` VARCHAR(10) único, `passwordHash`, `role`, `isActive`, `createdAt`, `updatedAt` (nulo até editar). Índice em `name` para a busca ordenada. |
| `RefreshToken` | `refresh_tokens` | Uma linha por sessão: hash do token, validade e revogação |
| `PasswordResetToken` | `password_reset_tokens` | Link de recuperação: hash do token, validade e `usedAt` (uso único) |

Chaves UUID; as tabelas de token caem em cascata quando o usuário é removido.

---

## Segurança

- **Tudo protegido por padrão:** o `JwtAuthGuard` é global; abrir uma rota exige o decorator `@Public()`.
- **Access token curto e refresh rotacionado:** cada refresh invalida o anterior. Se um refresh já usado reaparece, todas as sessões da conta são encerradas, porque é o sinal de token roubado.
- **Segredos nunca em claro no banco:** senha em argon2id; refresh e token de redefinição em SHA-256 (tokens gerados pelo servidor, de alta entropia).
- **Login sem vazar existência de conta pelo tempo:** usuário inexistente é verificado contra um hash falso e recebe a mesma mensagem.
- **Rate limit** geral e um limite estrito nas rotas de credenciais.
- **Logs** redigem `authorization`, `cookie`, `password`, `refreshToken` e `token`.
- helmet, CORS restrito à origem do frontend e validação de ambiente com Zod no boot.

---

## Decisões e trade-offs

- **Interpretação das regras:** "Senha alfanumérica de 6 dígitos" foi lida como exatamente 6 letras ou números. O XD escreve "Mín. 4 Letras" na matrícula, mas o PDF diz "Apenas Números", e o PDF prevaleceu.
- **Autorização:** o protótipo não mostra perfis, então qualquer usuário autenticado gerencia usuários. A infraestrutura de papéis (`Role`, `@Roles`, `RolesGuard`) continua pronta para restringir rotas quando for preciso; a usuária do seed é `ADMIN`.
- **Sem autocadastro:** o `POST /auth/register` do template foi removido. Usuários são criados por quem está logado, como no protótipo.
- **"E-mail não cadastrado":** o protótipo exibe essa mensagem, então `forgot-password` responde 404. Isso permite descobrir quais e-mails têm conta; o risco é mitigado pelo rate limit estrito da rota. Em produção, o recomendado seria responder sempre 204.
- **`updatedAt` nulo na criação**, em vez do `@updatedAt` automático do Prisma, para diferenciar "nunca editado" na tela Visualizar.
- **Datas com fuso (`timestamptz`):** o banco guarda o instante com fuso, então clientes de banco mostram o horário local de quem consulta. A API responde em ISO 8601 UTC (`...Z`) e o frontend converte para o fuso do navegador.
- **Busca só por nome**, conforme o PDF (o template buscava também por e-mail).
- **Módulo de exemplo `tasks` removido** para o código ficar focado no que é avaliado.

---

## Variáveis de ambiente

Validadas com Zod no boot ([src/config/env.validation.ts](src/config/env.validation.ts)); faltando alguma, a API não sobe e diz o quê.

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` / `API_PREFIX` | `3000` / `api` | Porta e prefixo (`/api/v1/...`) |
| `CORS_ORIGINS` | `*` | Origens liberadas (o `.env.example` usa `http://localhost:3001`) |
| `DATABASE_URL` | — | Conexão do Postgres |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — | Segredos distintos, mínimo 32 caracteres |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `7d` | Validade dos tokens |
| `APP_URL` | `http://localhost:3001` | Frontend; o link de recuperação aponta para `<APP_URL>/redefinir-senha?token=...` |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | Validade do link de recuperação |
| `SMTP_HOST` / `SMTP_PORT` | — / `1025` | SMTP. Sem `SMTP_HOST`, o e-mail vai só para o log |
| `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM` | — | Credenciais e remetente |
| `THROTTLE_*` | `60000` / `120` / `10` | Rate limit geral e o das credenciais |
| `SWAGGER_ENABLED` / `SWAGGER_PATH` | `true` / `docs` | Documentação |

---

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run start:dev` | Sobe com recarga automática |
| `npm run build` / `start:prod` | Compila e roda o build |
| `npm run typecheck` / `lint` / `format` | Tipos, oxlint e Prettier |
| `npm test` | Testes de unidade |
| `npm run test:e2e` | Testes e2e contra o Postgres de teste (`docker compose up -d db-test`) |
| `npm run prisma:migrate` / `prisma:deploy` | Cria (dev) ou aplica (prod) migrations |
| `npm run db:seed` | Popula o banco |

---

## Estrutura

```
src/
  main.ts / app.module.ts   bootstrap e guards globais
  config/                   env (Zod), configuração tipada, helmet/CORS/validação, Swagger
  common/                   decorators, DTOs de paginação e erro, filtros, guards
  infra/
    prisma/                 PrismaService
    hash/                   argon2 (senha) e SHA-256 (tokens)
    mail/                   MailService (SMTP / log)
    logger/                 pino
  modules/
    users/                  regras, DTOs, controller, service, repositório
    auth/                   login, refresh, logout, recuperação de senha, estratégia JWT
    health/                 sonda para orquestradores
prisma/                     schema, migrations e seed
test/                       e2e e o helper que sobe a aplicação
```

Cada módulo separa responsabilidades: o **controller** só roteia e documenta, o **service** tem a regra, o **repositório** é o único que conhece o Prisma, e o **DTO de resposta** (`fromEntity`) garante que campos internos não vazem.

---

## Testes

```bash
npm test                        # 29 testes de unidade, sem banco
docker compose up -d db-test
npm run test:e2e                # 45 testes e2e contra Postgres real
```

- **Unidade:** `UsersService` (hash, 409 com campo, busca só por nome, paginação, senha opcional na edição) e `AuthService` (login por e-mail e por matrícula, mensagem única, rotação e reuso de refresh, forgot/reset com token de uso único).
- **E2E:** sobem a aplicação inteira com o mesmo `configureApp` do `main.ts`. Cobrem cada regra de validação campo a campo (inclusive nomes acentuados e limites), obrigatoriedade, 409 por e-mail (sem diferenciar maiúsculas) e matrícula, paginação de 15 em ordem alfabética, busca, 404/400 por id, edição parcial com e sem senha, exclusão, 401 sem token e o fluxo completo de recuperação de senha. O envio de e-mail é trocado por uma caixa de saída em memória.

O **CI** (`.github/workflows/ci.yml`) roda lint, formatação, typecheck, unidade e build, e os e2e com um Postgres de serviço.

---

## Docker

O `Dockerfile` é multi-estágio: a imagem final roda como não-root, com `tini` como PID 1 e `HEALTHCHECK` em `/api/v1/health`. As migrations e o seed rodam no serviço `migrate`, que executa uma vez e sai, para várias réplicas da API não tentarem migrar ao mesmo tempo.

---

## Detalhes que valem saber

- **ESM:** todo import relativo termina em `.js`, mesmo apontando para `.ts`.
- **Versões fixadas:** `prisma`/`@prisma/client` 7 e TypeScript 6 (exigido pelo `@nestjs/cli` 12). Os `overrides` do `package.json` corrigem advisories transitivos e liberam o `@nestjs/throttler` 6 no NestJS 12.
- **A estratégia JWT consulta o banco a cada requisição**, de propósito: um usuário removido ou desativado perde o acesso na hora, sem esperar o token expirar.
