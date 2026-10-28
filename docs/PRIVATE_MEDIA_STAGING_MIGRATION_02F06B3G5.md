# 02F-06B3G5 — Neon staging: cinco migrações de fotos privadas

## Estado observado em 28/10/2026 — somente leitura
- PR #48 dashboard: MERGED; smoke Chromium real com API simulada aprovado.
- Neon `swim-flow-staging`, projeto `raspy-breeze-33258358`, branch `staging` / `br-gentle-wildflower-b7qrnd74`, banco `swimflow`.
- O histórico Prisma deste banco só contém `20261020000000_init_neon` e `20261021000000_local_auth_identity_foundation`, ambos marcados como concluídos.
- `private_media_objects` e `private_media_active_bindings` **não existem** no staging. Logo, o fluxo Blob não pode ser homologado end-to-end nesse banco ainda.
- O repositório tem 5 migrações aditivas versionadas e byte-pinned pendentes, de 25 e 26/10/2026.
- Vercel: projeto `swim-flow-dash` observado, mas não foi identificado um projeto separado `swim-flow-dash-staging`. Variáveis de produção/preview não foram alteradas.
- Render staging e store Blob descartável ainda não foram confirmados; não presumir que existem.

## Preparação implementada (SEM aplicar migrações)
1. `npm run private-media:staging -- --check` confirma as sete migrações aprovadas **offline**, sem segredos nem banco.
2. Workflow `Apply ONLY private-media migrations to Neon staging — MANUAL` é **workflow_dispatch**, somente `main`, aprovação digitada `APPLY_ONLY_PRIVATE_MEDIA_MIGRATIONS_TO_NEON_STAGING`, ambiente `swimflow-neon-staging`.
3. `--apply` valida o par pooled/direct com TLS, o host e banco staging fixos, o projeto e branch Neon fixos, URL `schema=public`, ambiente NÃO-produção e todas as flags de Blob/S3/R2 desligadas.
4. Checa histórico Prisma exato (2 migrações concluídas com checksums) + tabelas legadas existentes + duas tabelas privadas ainda ausentes ANTES de chamar o Prisma.
5. Executa **somente** `prisma migrate deploy` sobre os cinco arquivos previamente fixados; verifica histórico de sete migrações e as duas tabelas privadas após.
6. Se qualquer precondição falhar, não aplica nada. Se o Prisma iniciar mas falhar a meio, não tenta rollback ou retry automático; revisar `_prisma_migrations` e migrações no staging antes de qualquer nova execução.
7. Os segredos Neon são passados apenas ao passo final protegido do workflow, nunca a `npm ci`, Prisma generate ou CI de PR.

## Passo manual, somente quando autorizado e ambiente revisado
No GitHub da API: Actions → **Apply ONLY private-media migrations to Neon staging — MANUAL** → Run workflow → branch `main` → aprovação literal. Confirmar que o GitHub Environment `swimflow-neon-staging` está protegido e que `SWIMFLOW_STAGING_DATABASE_URL` e `SWIMFLOW_STAGING_DIRECT_URL` apontam **somente** para Neon staging.

**Não executar ainda** sem confirmação humana e sem revisão do estado do banco de staging. Este PR não roda workflow manual, não liga flags e não altera Render/Neon/Vercel.

## Depois da aplicação manual
- Repetir leitura das sete migrações e tabelas privadas; confirmar contagens sem acessar dados de usuários.
- Configurar Render e Vercel para STAGING isolados (não reuse flags de produção).
- Validar Blob com store descartável via workflow manual existente da API.
- Homologar 401/403/404/409/413/503, JWT, upload JPG/PNG, visualização, remoção, CORS, PWA e rollback; executar apenas com dados sintéticos.
- Produção só após evidências e consentimento explícito.

A migração não transporta imagens públicas existentes nem apaga nadadores, professores ou responsáveis. Os cinco arquivos SQL revisados contêm DDL e restrições, com `DROP CONSTRAINT` para substituir checks — **não** `DROP TABLE`.
