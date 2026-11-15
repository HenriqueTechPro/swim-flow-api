# Swim Flow 1.2 — Neon production, empty baseline (2026-11-15)

This is a **new database with zero demonstration data**. The action MUST NOT touch Neon staging, Vercel or Render.

## Fixed target
- New Neon project `swim-flow-production`: `round-bonus-30138797`
- Branch: `production` / `br-tiny-mud-bb79ybtx`
- Database: `swimflow`, Postgres 17, region `aws-us-east-1`
- Host: `ep-broad-wildflower-bb1fuesv.c-15.us-east-1.aws.neon.tech`
- Pooler host: `ep-broad-wildflower-bb1fuesv-pooler.c-15.us-east-1.aws.neon.tech`
- 12 committed Prisma migrations in `prisma/migrations`, already exercised by PostgreSQL disposable CI
- Old staging project `raspy-breeze-33258358` MUST NOT be targeted

## Before migration
1. Merge the reviewed pull request into `main` after all quality checks are green. The workflow is manual only; PRs and pushes perform no production SQL.
2. Create/protect the GitHub environment `swimflow-neon-production` (required reviewers and branch restriction to main).
3. In Neon production Connection Details retrieve direct and pooled URLs for database `swimflow`. Copy them ONLY to the protected environment secrets:
   - `SWIMFLOW_PRODUCTION_DIRECT_URL` (direct connection)
   - `SWIMFLOW_PRODUCTION_DATABASE_URL` (pooled runtime connection)
   Each URL must include `sslmode=require` and a password, and point to the exact production host. Do not put credentials in issues, commits or chat.
4. Verify the database is new/empty and keep staging unchanged.

## Manual execution
From GitHub Actions, select `Neon production — apply empty Prisma baseline (manual)`, workflow on `main` and confirmation `APPLY_SWIM_FLOW_EMPTY_PRODUCTION_SCHEMA`. Approve the protected environment.

The workflow installs/validates/generates without secrets, then checks exact production identity before executing `npm run prisma:migrate:deploy` and `npm run prisma:migrate:status`. It verifies that 12 migrations finished and important user/demo tables have zero rows. No seed, no `db push`, no copying staging data, and no manual ledger changes.

## After migration — separately
Audit schema in Neon read-only; create the independent API service in Render with production-only JWT, credentials, CORS, session/cookie configuration and private media store; bootstrap the first administrator after review; validate auth and CRUD; only then repoint `swim-flow-dash` with explicit authorization. Keep `swim-flow-dash-staging` connected to staging. Render free hours are shared and may suspend active services; consider sustainability before real users.

If migration fails, DO NOT force it, manually edit Prisma ledger, or switch production traffic. Investigate and recover using an explicitly reviewed plan.
