# Swim Flow — 02F-06B3B | Batch active private media references (API)

## Contract
POST /api/uploads/private-images/active-references
Authorization: Nest JWT + current-role guard + uploads:write, plus fresh profile authorization inside the use case.
Request:
{ "target": "student-photo" | "teacher-photo" | "parent-photo" | "profile-avatar", "resourceIds": ["UUID", "..."] }
- Strict JSON object; 1–25 unique UUIDs; single target type.
- Response { "data": { "references": [{ "resourceId": "UUID", "mediaId": "UUID | null" }] } }.
- Cache-Control: private, no-store. No Blob URLs, object keys, ETag or tokens.
- An absent photo returns mediaId:null; a revoked role or forbidden target returns 404.
- Students, teachers and parents: current ADMIN role only. Profile avatar: only current user's own ID. Teacher cross-user photo access remains denied.
- Authorization runs before querying bindings; DB fetch is a single bounded Prisma findMany for the whole page. The existing composite foreign key guarantees that these bindings reference VERIFIED media on BLOB, matching the target and resource.
- 503 if private storage feature flag is OFF; no fallback to public storage.

## Why a batch endpoint
Student/teacher/parent lists are paginated. A single call for the visible page avoids N requests per card and does not force a join or download of photo bytes on initial list render. The frontend can query only on demand, with current resource IDs and after checking authorization.

## Compatibility
- No changes to existing photo fields, legacy Supabase URLs, Prisma schema or migration SQL.
- No activation/deletion of photos in this PR. The existing CAS activation and protected JPEG stream remain unchanged.
- Do not persist temporary blob: object URLs in the database, browser storage or query cache.
- Successful reference lookup is not permission to download the JPEG without another server-side authorization check.
- WARNING: IDs from removed resources may remain in historical bindings; the private read endpoint still denies bytes if the target no longer exists. A later cleanup policy will reconcile these.

## Follow-up (02F-06B3C)
Develop a frontend hook using this batch contract with per-identity cancellation and a temporary object URL component, then pilot one profile or entity flow before switching all CRUD forms. Avoid setting avatarUrl/photo to UUID or blob: URL. Plan a consistent way to clear or replace legacy photo fields and handle canceled edits.

## Gates
- TypeScript, lint, Prettier changed files, unit and E2E, PostgreSQL baseline CI.
- Render deployed with SWIMFLOW_PRIVATE_BLOB_ENABLED=false until private smoke is approved.
