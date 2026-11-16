# RaiaNexo — Render Free production API (pilot, separate account)

## Decision
- The RaiaNexo dashboard stays on the Vercel production project `swim-flow-dash`.
- The **production API** is a new Render Free web service in a **different Render account** from staging.
- The production database is the **already prepared independent Neon Postgres** project/branch. Never use staging URLs or credentials.
- This is a controlled pilot only. Free web services can sleep after 15 minutes idle and cold-start slowly, have ephemeral filesystems, and do not support shell or pre-deploy jobs.
- Future hosting can be migrated to a VPS without replacing the database or the dashboard's business logic.

## Create the web service manually
1. In the **new account**, open Render → New → Web Service → connect the GitHub repository `HenriqueTechPro/swim-flow-api`.
2. Service name: `swim-flow-api-production` (infrastructure name; product brand remains RaiaNexo).
3. Branch: `main`; language/runtime: Node; plan: `Free`; region: Virginia; root directory: repository root.
4. Build: `npm ci --include=dev && npm run prisma:generate && npm run build`
5. Start: `npm run start:prod`. Port: Render-provided `PORT`, do not hardcode one.
6. Health check path: `/health`. Disable auto-deploy until explicitly reviewed.
7. Avoid importing the default `render.yaml`: it defines `swim-flow-api-staging`. The separate `render-production.yaml` describes production as a reference.

## Minimum deployment environment
Set these as Render server-side variables (never with a `VITE_` prefix):
```dotenv
NODE_VERSION=22
NODE_ENV=production
SWAGGER_ENABLED=false
DATABASE_URL=<Neon production pooled PostgreSQL URL with sslmode=require>
DIRECT_URL=<Neon production direct PostgreSQL URL with sslmode=require>
API_CORS_ORIGIN=https://swim-flow-dash.vercel.app
JWT_ACCESS_SECRET=<new unique random secret of at least 32 characters>
AUTH_COOKIE_SAME_SITE=none
AUTH_SECURE_COOKIES=true
AUTH_COOKIE_PATH=/api/auth
AUTH_REFRESH_COOKIE_NAME=swim_flow_refresh_token
JWT_ACCESS_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=7
SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=false
SWIMFLOW_LOCAL_INVITES_ENABLED=false
SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED=false
SWIMFLOW_PRIVATE_BLOB_ENABLED=false
SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED=false
SWIMFLOW_R2_STORAGE_ENABLED=false
```
- Replace `API_CORS_ORIGIN` with the **actual production frontend origin** if a custom domain becomes active. Only use reviewed origin(s), not `*`.
- Generate a **different JWT secret** from staging; never reuse the staging database URL.
- Keep sign-in/invitations disabled until the production first-admin bootstrap is executed using its reviewed guarded script. A successful health check alone does **not** mean login is enabled.
- Object storage/media requires its own reviewed production integration, not automatic copying of staging keys.

## Before enabling browser login
1. Confirm that Neon production is correctly targeted and Prisma migrations are applied with the guarded procedure from the existing scripts (production-specific project and branch, explicit approval). Do **not** add migrations to `build` or `start`.
2. Because Render Free lacks shell/pre-deploy jobs, run approved migration/bootstrap operations from a controlled trusted development machine or separate reviewed workflow; never run them against staging accidentally.
3. Confirm `https://<new-render-service>.onrender.com/health` responds 200 (a cold start can take about a minute).
4. Test CORS from the real Vercel production domain; then verify refresh cookies work across domains (third-party cookies may be restricted by browsers).

## Connect only the Vercel production build
1. In Vercel `swim-flow-dash` → Settings → Environment Variables, configure `VITE_API_URL=https://<new-render-service>.onrender.com` for target **Production**. This is a build-time Vite variable, so trigger a fresh production build/deploy.
2. Do not point the Vercel **staging** project at this new production API.
3. In the main Vercel project an older `VITE_API_URL` may target `Production, Preview, Development`; scope the production change without losing the preview/development connection.
4. Verify backend /health, preflight, login, session persistence, and sample read/write operations without copying any staging records.

## Rollback
Restore the previous production dashboard deployment or its previous Production `VITE_API_URL`; do not repoint production at staging as a long-term fallback. Keep backups and secrets outside Git.
