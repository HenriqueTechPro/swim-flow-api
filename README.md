# Swim Flow API

API do Swim Flow construída com NestJS, Prisma e Swagger.

## Requisitos

- Node 22 (mesma versão usada no CI e Render)
- Banco PostgreSQL acessível via `DATABASE_URL`

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
DATABASE_URL=
# Supabase Auth/Storage are optional legacy providers during migration.
# Do not configure them for Neon-only staging; legacy routes return HTTP 503.
# VITE_SUPABASE_URL=
# VITE_SUPABASE_PUBLISHABLE_KEY=
# SUPABASE_SECRET_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
JWT_ACCESS_SECRET=
SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=false
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
- Para operações **legadas** do Supabase, ambas as variáveis públicas precisam estar disponíveis e ações administrativas também exigem `SUPABASE_SECRET_KEY`. Sem credenciais, operações legadas respondem HTTP 503, sem impedir `/health` e `/health/ready`.
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

**Render staging está preparado como infraestrutura declarativa**
em `render.yaml`, sem deploy automático e sem secrets no repositório.
Para vincular o GitHub ao Render, configurar as variáveis protegidas
e publicar o Web Service gratuito em Virgínia, siga
`docs/RENDER_STAGING_SETUP_02E6.md`. Não crie outro banco no Render;
o PostgreSQL continua no Neon. A versão de staging do Neon contém apenas
o schema (33 tabelas de aplicação, duas migrações Prisma), sem dados importados do Supabase.


A estrutura definitiva adotada é **PostgreSQL Neon** (banco), **Render** (API)
e **Vercel** (dashboard). O schema inicial já foi implantado no **Neon staging**
entre 21 e 22/10/2026, com 33 tabelas de aplicação, 24 enums e duas migrações aplicadas, sem dados importados.
Em 22/10/2026, o Prisma 6 confirmou `Database schema is up to date!`,
e a API local respondeu HTTP 200 em `/health` e `/health/ready` usando o Neon.
O staging da API está publicado em
`https://swim-flow-api-staging.onrender.com`, com `/health` e
`/health/ready` verificados em 23/10/2026. O banco de produção não existe.
A implantação de serviços não acontece automaticamente ao fazer merge.
Veja `docs/NEON_STAGING_BASELINE_APPLIED_02E5.md` para a evidência
histórica da baseline SQL, e `docs/RENDER_STAGING_SETUP_02E6.md` para
o procedimento atualizado de deploy.

Na API Render, execute o build com:

```bash
npm ci --include=dev && npm run prisma:generate && npm run build
```

A opção `--include=dev` deve permanecer no build do Render mesmo com
`NODE_ENV=production`: o comando `nest build` depende de `@nestjs/cli`,
instalado como dependência de desenvolvimento. A execução continua via
`npm run start:prod`.

Start: `npm run start:prod` com `NODE_ENV=production` e as variáveis
`DATABASE_URL` (pooled), `DIRECT_URL` (direct), `JWT_ACCESS_SECRET` e
`API_CORS_ORIGIN` protegidas no ambiente do serviço.

Em bancos Neon **novos e vazios**, migrações futuras seguem
`npm run prisma:migrate:deploy`, nunca `db push` no deploy.
No staging já inicializado, **não reaplique a baseline**; antes de conectar
Render, valide o histórico com `prisma migrate status` usando Prisma 6.

No Windows, preferir corrigir a conectividade de rede quando houver erro
`P1001`; o Prisma e a API usam normalmente os hostnames DNS do Neon,
sem fixar IPs nem executar wrappers IPv4. Não desative TLS.

A API possui dois endpoints de diagnóstico:

- `GET /health`: processo HTTP respondendo (não consulta o banco);
- `GET /health/ready`: consulta somente-leitura ao PostgreSQL,
  retorna **200** se pronto e **503** se o banco estiver indisponível,
  sem revelar URLs ou credenciais, com `Cache-Control: no-store`.

**Transição 02E-9O:** o endpoint `POST /api/auth/login` utiliza a
identidade local PostgreSQL, mas exige
`SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=true`, **desativado por padrão**.
Só habilite após o provisionamento seguro do primeiro administrador e
testes de autenticação em staging. Enquanto isso, login retorna 503.
Google OAuth, convites e recuperação de senha nos endpoints antigos
continuam indisponíveis até sua migração; uploads ainda usam o adapter
Supabase e retornam 503 sem credenciais. Não liberar usuários reais.
Procedimento: `docs/LOCAL_PASSWORD_CUTOVER_02E9O.md`.

Leia `DEPLOY_CHECKLIST.md` e `docs/RENDER_NEON_MIGRATION.md`
antes de qualquer conexão real ao Neon.
