# Swim Flow API

API do Swim Flow construída com NestJS, Prisma e Swagger.

## Requisitos

- Node 20+
- Banco PostgreSQL acessível via `DATABASE_URL`

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
DATABASE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
# Legacy fallback if you still use the old JWT-based admin key:
SUPABASE_SERVICE_ROLE_KEY=
JWT_ACCESS_SECRET=
REFRESH_TOKEN_TTL_DAYS=7
AUTH_REFRESH_COOKIE_NAME=swim_flow_refresh_token
AUTH_COOKIE_SAME_SITE=lax
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_PATH=/api/auth
AUTH_SECURE_COOKIES=false
API_CORS_ORIGIN=http://localhost:8080
NEST_API_PORT=3334
CACHE_TTL_SECONDS=30
SWAGGER_ENABLED=true
SWAGGER_PATH=docs
```

Notas importantes de auth e CORS:

- `API_CORS_ORIGIN` aceita multiplas origens separadas por virgula.
- Para operacoes administrativas do Supabase, como convites e listagem de acessos, prefira `SUPABASE_SECRET_KEY`. A API ainda aceita `SUPABASE_SERVICE_ROLE_KEY` como fallback legado.
- Em `localhost`, o padrao `AUTH_COOKIE_SAME_SITE=lax` e `AUTH_SECURE_COOKIES=false` funciona bem para front e API em portas diferentes.
- Se frontend e API ficarem em dominios diferentes em producao, use `AUTH_COOKIE_SAME_SITE=none` junto com `AUTH_SECURE_COOKIES=true`.
- So configure `AUTH_COOKIE_DOMAIN` em producao quando voce realmente precisar compartilhar o cookie entre subdominios.

## Instalação

```bash
npm install
npm run prisma:generate
```

## Desenvolvimento

```bash
npm run start:dev
```

API local:

```txt
http://localhost:3334
```

Swagger local:

```txt
http://localhost:3334/docs
```

## Build

```bash
npm run build
npm run start:prod
```

## Deploy planejado: Neon + Render + Vercel

A estrutura definitiva adotada é **PostgreSQL Neon** (banco), **Render** (API)
e **Vercel** (dashboard). O schema inicial já foi implantado no **Neon staging**
em 21/10/2026, com 31 tabelas de aplicação, 24 enums e sem dados importados.
A API ainda não foi publicada no Render e o banco de produção não existe.
A implantação de serviços não acontece automaticamente ao fazer merge.
Veja `docs/NEON_STAGING_BASELINE_APPLIED_02E5.md` para a evidência e para
a diferença entre o SQL transacional aplicado e o comando Prisma CLI pendente.

Na API Render, execute o build com:

```bash
npm ci && npm run prisma:generate && npm run build
```

Start: `npm run start:prod` com `NODE_ENV=production` e as variáveis
`DATABASE_URL` (pooled), `DIRECT_URL` (direct), `JWT_ACCESS_SECRET` e
`API_CORS_ORIGIN` protegidas no ambiente do serviço.

Em bancos Neon **novos e vazios**, migrações futuras seguem
`npm run prisma:migrate:deploy`, nunca `db push` no deploy.
No staging já inicializado, **não reaplique a baseline**; antes de conectar
Render, valide o histórico com `prisma migrate status` usando Prisma 6.

A API possui dois endpoints de diagnóstico:

- `GET /health`: processo HTTP respondendo (não consulta o banco);
- `GET /health/ready`: consulta somente-leitura ao PostgreSQL,
  retorna **200** se pronto e **503** se o banco estiver indisponível,
  sem revelar URLs ou credenciais, com `Cache-Control: no-store`.

**Transição:** o serviço ainda requer Supabase para Auth e Storage.
A retirada desses componentes e a escolha de bucket S3 gratuito ocorrerão
em PRs futuras, depois dos serviços substitutos testados.

Leia `DEPLOY_CHECKLIST.md` e `docs/RENDER_NEON_MIGRATION.md`
antes de qualquer conexão real ao Neon.
