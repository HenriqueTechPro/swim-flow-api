# Swim Flow API — Render + Neon (Etapa 01)

## Scope and current limitations

The infrastructure bootstrap prepared the **API runtime** and **Prisma migration tooling**. Etapa 02D-1 adds a reviewed, versioned initial migration, generated from the canonical database schema. It does **not** migrate user data or remove the existing Supabase Auth/Storage integration. Until a separate authentication/storage migration is completed, Supabase credentials remain required by the current API. Do not disconnect Supabase yet.

This is a clean-database plan: existing test records are intentionally not retained.

## Neon — create an empty PostgreSQL project

1. Create an empty Neon PostgreSQL database. Do not expose its connection strings in Git or the browser.
2. Copy Neon’s **pooled connection string** to `DATABASE_URL` (runtime), and its **direct connection string** to `DIRECT_URL` (schema migrations). Use SSL and check connection-pool settings.
3. Review `prisma/schema.prisma` carefully: it retains the existing models and may contain Supabase-specific assumptions, enum mappings, and migration history. Review the initial migration against a fresh PostgreSQL database before deploying.
4. Generate an initial, versioned SQL baseline **locally**, without database access:

   ```bash
   npm ci
   npm run prisma:generate
   npm run prisma:validate
   node scripts/create-neon-baseline.cjs
   ```

5. The initial SQL migration is now **versioned in Git** under `prisma/migrations/20261020000000_init_neon/migration.sql`. It includes Prisma's table/enum/index/foreign-key DDL and separately reviewed PostgreSQL CHECK constraints and partial unique indexes. Run `node scripts/create-neon-baseline.cjs --check` to assert the generated SQL exactly matches the schema and custom SQL files. Never regenerate silently as part of deploy.
6. On the **empty Neon DB only**, after reviewing the SQL, execute `npm run prisma:migrate:deploy`. Then run `npm run prisma:generate` and `npm run build`.
7. Use new incremental versioned migrations for future schema modifications (`npm run prisma:migrate:dev -- --name descriptive_change`). Never run `prisma db push` or `prisma migrate dev` as a deploy startup command.

**Important:** A Prisma-generated SQL baseline captures Prisma-managed tables/enums/relations, not arbitrary Supabase SQL constructs (RLS policies, storage buckets, auth.users). Those integrations need separate replacement work. Keep the Supabase environment available during this transitional PR. Generate and review SQL before applying it; do not assume it will reproduce the entire old Supabase environment.

## Render — API service

- Deploy as a Node web service connected to the API repository and branch.
- Recommended build command: `npm ci && npm run prisma:generate && npm run build`.
- Start command: `npm run start:prod`. Set `NODE_ENV=production`.
- Render provides `PORT`; it now takes precedence over `NEST_API_PORT`. The API binds to `0.0.0.0`.
- Set `DATABASE_URL`, `DIRECT_URL`, a random `JWT_ACCESS_SECRET` (at least 32 characters), `API_CORS_ORIGIN` with the exact dashboard origin, and the other required settings shown in `.env.example`.
- For HTTPS frontend/API on different sites, test cookie behavior carefully. `AUTH_COOKIE_SAME_SITE=none` requires `AUTH_SECURE_COOKIES=true`. Cross-origin cookie support depends on browser privacy policies.
- While legacy authentication/storage remains, configure the necessary Supabase environment values securely in Render only.
- Set `SWAGGER_ENABLED=false` in production unless intentionally exposing API documentation.
- Health checks and first-request cold starts should be tested before real usage. Avoid wake-up ping loops.

## Verification checklist

- [ ] `npm run prisma:validate`
- [ ] `npm run prisma:generate`
- [ ] `npm run build`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e`
- [ ] Review the versioned Prisma + manual SQL baseline (`prisma/migrations/20261020000000_init_neon/migration.sql`)
- [ ] Confirm the PostgreSQL CI gate runs against an empty disposable database
- [ ] Apply baseline to an **empty**, non-production Neon database and verify schema
- [ ] Deploy Render staging; inspect startup logs and `/health`
- [ ] Verify authenticated read/write flows and CORS/cookies across Vercel + Render
- [ ] Replace Supabase Auth and Storage in a separate, security-reviewed PR

**Status (21 October 2026):** The versioned SQL is committed and verified by the disposable PostgreSQL CI. A **Neon staging-only** project and database have now been provisioned in AWS us-east-1 (PostgreSQL 17). Read-only inspection of database `swimflow` on branch `staging` found zero user relations/enums and no `_prisma_migrations` table. **No schema migration has been applied to Neon.** This is NOT a production rollout; authentication/storage replacement remains a separate stage. See `docs/NEON_STAGING_VERIFICATION_02E3.md`.
