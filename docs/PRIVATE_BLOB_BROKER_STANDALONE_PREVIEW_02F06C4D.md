# Swim Flow — Etapa 02F-06C4D | Standalone Vercel Blob broker Preview (OFF por padrão)

## Status confirmado (01/11/2026)

- PR #97 mesclado; teste em PostgreSQL 16 efêmero passou: vinte e quatro INSERTs concorrentes, exatamente um claim atômico vencedor.
- Storage privado `swim-flow-private-media-staging` (`store_PJZzrdBiiVcRyLHj`): **0 arquivos e 0 bytes**.
- Associação existente: **somente Preview** do projeto `swim-flow-private-blob-broker-staging` (`prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`).
- Vercel: projeto vazio, **sem repo/deploy**. As únicas variáveis de projeto inspecionadas são `BLOB_STORE_ID` e `BLOB_WEBHOOK_PUBLIC_KEY` para Preview.
- Render staging e dashboard: fotos privadas OFF; nenhum segredo foi compartilhado ou criado.

## Pacote independente em `blob-broker/`

- `api/probe.js`: única Vercel Node.js Function, com contrato HTTP Fetch. Responde **503 broker-disabled** até existir configuração completa e *explicitamente habilitada* em Preview.
- `lib/handler.mjs`: valida o ID fixo do projeto e da equipe, OIDC no runtime, store privado correto, variável de habilitação, chave HMAC, e **banco Neon isolado com usuário de permissões mínimas**.
- `lib/private-blob-broker-auth-v1.cjs`, `private-blob-broker-readonly-receiver.cjs`, `private-blob-broker-postgres-nonce.cjs`: cópias **idênticas byte a byte** de scripts canônicos já testados; o CI recusa qualquer divergência, evitando comportamento diferente entre o broker e os mocks da API.
- `tests/handler.test.mjs`: no Node 22, teste com mocks do SDK e do driver SQL sem importar credenciais ou usar rede.
- `package.json`: pacote independente, não inclui NestJS, Prisma ou front. Dependências especificadas `@vercel/blob@2.8.2` e `pg@^8.16.0`.
- `vercel.json`: apenas uma função e timeout curto de 10 segundos.

**Dependências concluídas na 02F-06C4E:** `blob-broker/package-lock.json` foi gerado pelo `npm` no CI e versionado. O API Quality Gate agora faz `npm ci --prefix blob-broker --ignore-scripts` e executa `npm test --prefix blob-broker`, além de validar integridade e sincronização dos módulos de segurança. Isso **não** autoriza um deploy antes do isolamento do banco e dos segredos.

### Contrato da futura conexão de nonces

O broker **não** aceita o `DATABASE_URL` ou `DIRECT_URL` da aplicação Nest. Só aceita uma variável própria:

- `SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL`, com nome de banco **exato** `swimflow_blob_broker_nonce_staging` e usuário exclusivo `swimflow_blob_broker_nonce_rw`;
- `SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST` com hostname Neon do mesmo banco, `*.neon.tech`;
- `sslmode=require`, TLS e senha presente.

**Esse banco/role não existem ainda.** Criá-los requer um próximo passo explícito em Neon **staging**, com segregação de privilégios. Não usar credenciais da API principal, do Neon Production, Prisma ou do role administrador. A tabela `private_blob_broker_nonce_claims` deve ser provisionada no novo banco seguindo `docs/sql/private_blob_broker_nonce_staging.sql` após revisão; o papel de runtime precisa somente de SELECT/INSERT na tabela de nonces e não deve ter CREATE/DROP. O teste de concorrência em CI não cria essa tabela remotamente.

### Configuração futura Vercel Preview (NÃO EXECUTAR AINDA)

- `SWIMFLOW_BLOB_BROKER_READONLY_ENABLED=true`
- `SWIMFLOW_BLOB_BROKER_PROJECT_ID=prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`
- `SWIMFLOW_BLOB_BROKER_SHARED_KEY` (32 bytes aleatórios em base64url; segredo **diferente** de JWT/OIDC/RW; somente nos cofre de ambientes Render staging e Vercel Preview)
- `SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST` (host verdadeiro verificado do banco Neon)
- `SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL` (segredo somente Neon DB de nonces)
- `BLOB_STORE_ID` e `VERCEL_OIDC_TOKEN` pertencem ao contexto Vercel, sem copiar OIDC para Render.

**Não usar o .env.local OIDC do laboratório.** Não habilitar flag se falta role, tabela, SQL e testes.

## Próximos gates antes de HTTP público

1. **Concluído no PR #98 atualizado:** lockfile versionado e instalação `npm ci` + testes de pacote no CI.
2. Provisionar banco e role exclusivos de nonces no **Neon staging** com privilégios mínimos e schema versionado separadamente.
3. Verificar bloqueios de acesso, rate limiting/abuso, proteção da função e timeout do Postgres; obter sinais de clock skew e negação de replay.
4. Ligar o projeto Vercel ao repositório *somente* com `rootDirectory=blob-broker`, mantendo o ambiente desativado por padrão. Como a ligação Git pode causar deploy automático, revisar antes.
5. Validar em Preview que `POST /api/probe` sem segredos retorna 503, sem acessar Blob.
6. Configurar credenciais por canais seguros, com confirmação humana, e validar somente `HEAD` sintético e replay. Não abrir GET/PUT/DELETE de fotos.
7. Teste Render→Vercel apenas após autorização; ativar perfis/fotos por PR separado.

**Rollback:** nenhum deploy nem Neon remoto foi alterado neste PR. Reverter os arquivos do diretório `blob-broker/` e os scripts/CI é suficiente.

Documentação oficial:
- https://vercel.com/docs/functions/quickstart
- https://vercel.com/docs/vercel-blob/using-blob-sdk
