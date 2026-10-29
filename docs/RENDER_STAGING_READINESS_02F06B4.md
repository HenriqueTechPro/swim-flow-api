# Swim Flow — 02F-06B4: Render staging readiness (read-only)

## Estado confirmado em 29/10/2026
- API PR #86 merged; migration workflow #5 succeeded.
- Neon staging: 7/7 migrations finished, 0 incomplete; both private-media tables exist and have zero records.
- Vercel currently has one identified project (swim-flow-dash); separate frontend staging not confirmed.
- render.yaml describes a separate free service named swim-flow-api-staging, but actual provisioning and connectivity remain unverified.

## Scope
1. Render Blueprint explicitly keeps Blob/S3/R2 flags false. No Blob token, Supabase secret, seed, or Prisma migration step.
2. Read-only, anonymous probe pinned to https://swim-flow-api-staging.onrender.com:
   - GET /health must return HTTP 200 with status=ok and service=swim-flow-nest-api.
   - GET /health/ready must return HTTP 200 with status=ready, service=swim-flow-nest-api, dependency=postgresql.
   - Redirects prohibited; no cookies, authorization header, POST, private body or credentials printed.
   - Each request has a 90-second deadline for free-tier cold starts.
3. Manual-only GitHub Action: Render staging — anonymous readiness check (READ ONLY). Zero secrets.
4. API quality runs offline tests with mocked HTTP; PR CI never contacts Render.

## Checklist after merge
1. In the Render Dashboard verify swim-flow-api-staging exists as a distinct service, linked to the repository, manual deployment, isolated from production secrets.
2. Configure DATABASE_URL and DIRECT_URL to Neon swim-flow-staging branch staging/database swimflow. Never reuse production DB. Configure API_CORS_ORIGIN to isolated staging frontend origin when available.
3. Verify its actual URL exactly matches https://swim-flow-api-staging.onrender.com. If not, do not bypass the guard. Submit a reviewed allowlist change.
4. After reviewing environment, manually deploy ONLY the distinct staging service. The Blueprint has autoDeployTrigger off; merging code does not deploy.
5. From API GitHub Actions run Render staging — anonymous readiness check (READ ONLY) on main.
6. A green run proves only liveness and PostgreSQL round-trip. It cannot prove Render is connected to the correct Neon branch: independently verify DB destination in Render settings without showing secrets, and re-run Neon read-only audit READY.
7. Only after verified isolation: separate disposable private Blob store, server-side token ONLY in Render staging, then E2E tests with synthetic photos. Keep production flags off.

## Failure diagnosis
- Refused origin or command: preflight guard, zero HTTP requests.
- /health unhealthy: service missing, DNS, cold start or Nest process.
- /health/ready unhealthy: PostgreSQL connectivity or Prisma readiness; do not solve this by connecting to production.
- No failure in this workflow writes data, triggers migrations, deploys or enables feature flags.

This PR does not provision or change Render/Vercel/Blob services or Neon data.
