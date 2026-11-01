# Swim Flow — 02F-06C4C | Anti-replay real em PostgreSQL descartável

## Estado confirmado

- PR #96 mesclado, verificações de API e PostgreSQL verdes.
- Projeto Vercel: `swim-flow-private-blob-broker-staging`, id `prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`.
- Store **privado** `swim-flow-private-media-staging` (`store_PJZzrdBiiVcRyLHj`) conectado ao **projeto dedicado somente em Preview**.
- Store confirmado vazio (0 objetos, 0 bytes).
- Nenhum deploy, endpoint, chave HMAC, credencial Render ou banco de nonces persistente foi configurado. As rotas de imagens privadas permanecem desligadas.

## O que este PR comprova

O PR #95 já introduziu `createAtomicPostgresNonceClaim`, com SQL `INSERT ... ON CONFLICT DO NOTHING RETURNING nonce_key`, parametrizado e exigindo 1 linha afetada. Até agora, os testes de concorrência usavam mocks e `Set` em memória, que **não** provam exclusão mútua entre diferentes instâncias/serverless.

`scripts/verify-private-blob-broker-nonce-postgres.cjs` executa **somente dentro do job GitHub Actions `PostgreSQL baseline quality gate`**, contra `postgres:16` descartável, usuário/db/host fixos `ci@localhost:5432/swimflow`, `DIRECT_URL` e `DATABASE_URL` estritamente validados. O script exige simultaneamente:
- `SWIMFLOW_DISPOSABLE_DB=yes`, `CI=true`, `GITHUB_ACTIONS=true`,
- `GITHUB_WORKFLOW=PostgreSQL baseline quality gate`,
- `GITHUB_REPOSITORY=HenriqueTechPro/swim-flow-api`,
- protocolo PostgreSQL, host local, porta, usuário, senha, banco e schema específicos de CI; `NODE_ENV` diferente de production.

O script **recusa tabelas preexistentes**, cria só `public.private_blob_broker_nonce_claims` com chave única, executa **24 reivindicações simultâneas sobre dois PrismaClients distintos**, exige **1 sucesso e 23 rejeições**, confirma que replay posterior falha, verifica nonces independentes e validade de expiração, e **remove a tabela em `finally`**. Não usa dados ou tabelas de alunos, não faz migração versionada e nunca conecta a Vercel, Render ou Neon. O passo ocorre **depois** das verificações oficiais de schema/migrations no mesmo banco efêmero.

`scripts/verify-private-blob-broker-nonce-postgres.test.cjs` executa **offline** no API Quality Gate para provar que o script recusa Neon, Render, endereço não local, usuário/porta/schema divergentes, ambiente de produção e execução fora do CI.

### Comandos CI

- `npm run blob:broker:postgres:guard:test` — Node test offline, sem acesso ao banco.
- `npm run blob:broker:postgres:ci` — real SQL, **somente no serviço PostgreSQL efêmero oficial do CI**.

## Pontos ainda BLOQUEADOS

Este teste NÃO cria a tabela real do projeto broker, nem fornece credenciais de PostgreSQL para Vercel. Para publicar receptor `/api/probe` e enviar um HEAD assinado, faltam:

1. Escolher explicitamente autenticação do **Render** no Blob de homologação: se existir token RW legítimo e exclusivo, ele dispensa o broker; se não existir, seguir com OIDC na função Vercel.
2. Aprovar um banco/schema separado de homologação para nonces, com permissões mínimas, retenção TTL e descarte após janela segura; não criar tabela na produção nem no banco principal de alunos sem isolamento revisado.
3. Criar uma função Vercel separada, **desativada por padrão**, que importe o receptor e injete `head`, `BlobNotFoundError` e a implementação real de `claimNonce`; testar negações e limites antes do deploy.
4. Gerar e distribuir uma nova chave HMAC de 32 bytes **exclusivamente por gerenciadores seguros de variáveis** em Render staging e Vercel Preview, sem registrar no código, logs ou chat.
5. Autorizar uma verificação `HEAD` sintética e confirmar bloqueio do replay entre instâncias. Nenhum GET/PUT/DELETE de fotos permitido neste estágio.

**Rollback:** este PR adiciona apenas testes e etapas CI. Nenhuma alteração em banco remoto, API em produção, serviço Vercel publicado ou mídia de usuário. Caso a tabela de CI não seja removida, o job falha e o contêiner descartável é destruído ao final.

Referências: `docs/PRIVATE_BLOB_STAGING_RECEIVER_02F06C4A.md`, `docs/PRIVATE_BLOB_DEDICATED_BROKER_PROJECT_02F06C4B.md`.
