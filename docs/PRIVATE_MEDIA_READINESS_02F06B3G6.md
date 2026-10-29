# 02F-06B3G6 — Read-only readiness do Neon e limites de staging

## Evidências observadas em 29/10/2026

- PR API #83: **merged**. A ação manual de aplicar migrações NÃO foi executada aqui.
- Neon `raspy-breeze-33258358`, branch `br-gentle-wildflower-b7qrnd74`, DB `swimflow`: exatamente 2 migrações aplicadas, 5 pendentes; os checksums correspondem ao histórico do repo.
- `private_media_objects` e `private_media_active_bindings`: ausentes. Snapshot agregado: 1 perfil, 0 alunos, 0 professores, 0 responsáveis. **Nenhum dado individual foi lido**.
- Vercel: o projeto `swim-flow-dash` existe, com deployments production e preview; NÃO foi confirmado outro projeto dedicado ao staging. As variáveis visíveis por nome incluem `VITE_API_URL`, `BLOB_READ_WRITE_TOKEN` e três `VITE_SUPABASE_*`; o token Blob está cadastrado para production, preview e development. Nenhum valor foi descriptografado. Não assumir isolamento de storage ou API nos previews.
- Render: `render.yaml` versionado declara serviço staging `swim-flow-api-staging`, plano free, `autoDeployTrigger: off`; existência efetiva e URL do serviço **não confirmadas**.

## Entrega deste PR (sem alterações reais)

- `scripts/private-media-staging-audit.cjs --check`: hashes e inventário de migrações, offline.
- `--audit`: exige exatamente projeto/branch/domínio/db/schema de staging, flags privadas desligadas e NÃO produção. Abre uma transação PostgreSQL `SET TRANSACTION READ ONLY`, `RepeatableRead`, só SELECT, verifica checksum de todos os registros Prisma e as duas tabelas privadas.
- Resultados permitidos: **PENDING** (2 migrações); **READY** (7 migrações e tabelas); qualquer outro estado é **DRIFT/blocked**, não tenta corrigir.
- Workflow `Audit private media readiness in Neon staging — READ ONLY`, disparo SOMENTE manual na branch main, env `swimflow-neon-staging` e segredos apenas no passo final; nenhuma execução automática por merge.
- CI testa limites, bloqueio de origem incorreta, SQL somente de leitura e as classificações.

## Próximo corte — requer aprovação humana específica

1. Verificar segredos `SWIMFLOW_STAGING_DATABASE_URL` e `SWIMFLOW_STAGING_DIRECT_URL` no GitHub Environment `swimflow-neon-staging`. Não revelar valores.
2. Rodar a ação **Audit ... READ ONLY** manualmente. O resultado deve ser `PENDING` antes de qualquer escrita.
3. Quando autorizado, executar separadamente a ação **Apply ONLY private-media migrations to Neon staging — MANUAL**, inserindo a frase exata definida em `docs/PRIVATE_MEDIA_STAGING_MIGRATION_02F06B3G5.md`.
4. Após escrita controlada, rodar auditoria somente leitura e exigir `READY`.
5. Só depois configurar Render e Vercel **separados da produção** e executar smoke Blob em store descartável.

## Medidas de segurança

Não colocar token privado Vercel em `VITE_*`; não apagar credenciais/variáveis legadas antes de auditar uso; não reutilizar Blob nem `VITE_API_URL` de produção nos previews de homologação. Não realizar migração em produção, nem ligar flags antes do staging E2E.
