# Swim Flow — 02F-06B2 | Private image binding and authenticated read

## Scope
The API already had audited AssignPrivateBlobImageUseCase and ReadPrivateBlobImageUseCase, plus a Prisma atomic active binding and a private Vercel Blob adapter. This change publishes their authenticated HTTP interfaces WITHOUT changing the schema, replacing legacy photo storage, or exposing object addresses.

## Endpoints
- POST /api/uploads/private-image/:uploadId/activate
  - Authorization: Nest JWT + RolesGuard + uploads:write + fresh domain check of current profile and target.
  - JSON body must contain expectedMediaId: null (first attach) or a UUID (compare-and-swap replacement).
  - Response: { data: { mediaId, status: "ACTIVE" } }, with 409 on lost race.
  - A stale/invalid candidate, revoked role or missing target fails closed.
- GET /api/uploads/private-image/:uploadId
  - Authorization: JWT + uploads:write + fresh domain check, ACTIVE binding and verified storage metadata.
  - Returns JPEG stream, Content-Length, Content-Type, Cache-Control: private, no-store and X-Content-Type-Options: nosniff.
  - Never returns a Blob URL, token, pathname, or a public redirect.

## Security and rollout
- Both routes require SWIMFLOW_PRIVATE_BLOB_ENABLED=true and the server-only BLOB_READ_WRITE_TOKEN; otherwise 503 after authorization.
- Teacher access to other records is not opened; only current administrators may access student/teacher/parent photos; self avatar access is limited to the current user.
- Old photos are NOT deleted when replaced; existing separately audited cleanup handles retention.
- The legacy POST /api/uploads/signed-url and dashboard remain untouched.
- No new env keys, schema migrations, browser-facing credentials, or Supabase fallback.
- Keep flag OFF in Render until private Blob credentials and a controlled smoke test are confirmed.

## Checks
- Unit and E2E coverage for 503-disabled service, 201/CAS 409, malformed input 400, JWT 401, private stream headers, 404 domain denial.
- Existing domain unit tests cover current-role revocation, cross-target denial, ETag and binding restrictions.
- Run npx tsc --noEmit, npm run lint:check, npm run test:unit -- --runInBand, npm run test:e2e and npm run build before merge.

## Next PR (02F-06B3)
Move PhotoUpload in the dashboard to the complete private sequence: POST candidate, POST activate using expectedMediaId, then authorized GET through the API. Review frontend token delivery, cache eviction and avatar display. Only retire Supabase Storage after real migration and regression testing. Reporting Edge Functions have separate dependencies and must remain until replaced.
