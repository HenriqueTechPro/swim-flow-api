# Swim Flow — 02E-9H | Preflight de autenticação local Neon staging e migração guardada

## Auditoria do banco real em 22/10/2026 (staging, não produção)

- Projeto Neon: `swim-flow-staging` (`raspy-breeze-33258358`)
- Branch principal: `staging` (`br-gentle-wildflower-b7qrnd74`)
- Database: `swimflow`, PostgreSQL 17.
- Estrutura antes da migração: 31 tabelas de negócio + `_prisma_migrations` (32 ao todo), 24 enums.
- Histórico: exclusivamente `20261020000000_init_neon`, finalizada sem rollback, checksum `e98a2c3c9940e55344fc39c7a551979c7b2b20362783e2ddf44ab01b40fc3e80`.
- `local_auth_identities` e `local_auth_action_tokens` ausentes; `profiles`, `students` e `auth_sessions` sem registros.
- **NENHUMA ALTERAÇÃO FOI APLICADA NA BRANCH PRINCIPAL DO STAGING nesta etapa.**

## Prova isolada realizada no Neon

Branch temporária: `mcp-migration-2026-10-22T09-26-49`, ID
`br-mute-fire-b7rqfrhs`, descendente da branch `staging`.

Uma migração SQL **equivalente ao arquivo versionado**, com guarda de
baseline e registro manual no formato `_prisma_migrations`, foi aplicada
nessa branch de teste. Verificação read-only posterior:
- 34 tabelas ao todo (33 de aplicação e `_prisma_migrations`).
- `local_auth_identities` e `local_auth_action_tokens` presentes e vazias.
- 9 constraints `local_auth%`, incluindo PKs, FKs e CHECKs.
- 5 índices nessas duas tabelas, incluindo PK/uniques e índice de consulta.
- Histórico agora contém 2 migrações finalizadas, com checksum incremental
  `7a010c592b4c30b6d2e8a609ccd593c8bea262e98371fa2e99d3211a26f046a5`.
- **Importante:** a operação de teste usou SQL via Neon e registrou
  o histórico no formato Prisma; **não equivale a rodar a CLI Prisma**.
- A branch de teste **não deve ser confundida com staging principal**.
  Sua exclusão requer autorização do responsável. A antiga branch de
  validação de baseline `br-restless-field-b7oz99tj` também permanece.

## Procedimento recomendado para a migração real

Esta PR entrega `scripts/neon-local-auth-staging.cjs`, um executor
**desligado por padrão, exclusivamente manual**:

1. Revisar/mesclar esta PR; confirmar backups e os IDs de destino.
2. Configurar `DATABASE_URL` pooled e `DIRECT_URL` direct exclusivamente
   no terminal privado do operador, sem copiar credenciais para GitHub/chat.
   Ambas devem exigir TLS, ser do endpoint exato de staging e utilizar
   `schema=public`.
3. Rodar `npm ci && npm run prisma:generate` e
   `npm run neon:local-auth:staging -- --check` (validação offline).
4. Obter autorização explícita para a atualização do staging.
5. Somente após aprovação, definir:
   `NEON_PROJECT_ID=raspy-breeze-33258358`,
   `NEON_BRANCH_ID=br-gentle-wildflower-b7qrnd74` e
   `SWIMFLOW_LOCAL_AUTH_STAGING_APPROVAL=APPLY_SWIM_FLOW_LOCAL_AUTH_STAGING`.
6. Rodar `npm run neon:local-auth:staging -- --apply`.

O executor recusa alvos diferentes, inventário ou checksums diferentes de
ambas migrations, schema que já contenha identidades, baseline divergente,
usuários existentes ou dados de sessão. Em seguida, usa **`prisma migrate deploy`**
da versão versionada no repositório, verifica as 2 migrations concluídas,
33 tabelas de aplicação, 9 constraints e ausência de identidades/tokens,
e roda `prisma migrate status`.

Se o deploy falhar ou deixar história parcialmente aplicada, **não repetir**
à força; primeiro inspecionar schema e `_prisma_migrations` de forma privada.
**Nunca** usar `db push`, `migrate reset` ou apagar a baseline.

## CI e próximos passos

- `npm run neon:local-auth:staging:test` valida SHA-256 dos dois arquivos,
  bloqueio por ambiente/flag, pre/post conditions, ordem e `--check` offline,
  sem acessar Neon de verdade.
- A CI do PostgreSQL descartável segue rodando
  `prisma migrate deploy` e `migrate status` sobre ambas migrations.
- [ ] Revisão e merge manual desta PR.
- [ ] Autorização explícita de escrita no staging real e execução via Prisma.
- [ ] Pós-verificação real no Neon + endpoint `/health/ready` no Render.
- [ ] Provisionamento inicial protegido do primeiro administrador.
- [ ] Cutover local/Google e S3 posteriormente.

Supabase permanece como compatibilidade em Auth/Storage, desligado somente
após a migração completa do código e a validação HTTP/Vercel/Render.
