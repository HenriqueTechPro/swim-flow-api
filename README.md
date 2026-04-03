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
API_CORS_ORIGIN=http://localhost:8080
NEST_API_PORT=3334
CACHE_TTL_SECONDS=30
SWAGGER_ENABLED=true
SWAGGER_PATH=docs
```

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

`start:prod` tambem executa `prisma:generate` antes de subir a aplicacao, para evitar cliente Prisma desatualizado em deploys.

## Railway

Build command:

```bash
npm install && npm run prisma:generate && npm run build
```

Start command:

```bash
npm run start:prod
```
