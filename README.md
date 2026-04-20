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

## Railway

Build command:

```bash
npm install && npm run prisma:generate && npm run build
```

Start command:

```bash
npm run start:prod
```
