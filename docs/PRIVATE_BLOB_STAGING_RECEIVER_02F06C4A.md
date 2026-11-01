# Swim Flow — Etapa 02F-06C4A | Receptor isolado de prova OIDC com proteção anti-replay

## O que foi verificado

O PR #94 foi mesclado; API Quality Gate e PostgreSQL Baseline da `main` ficaram verdes. A Vercel confirma que o store privado **de homologação** `swim-flow-private-media-staging` (`store_PJZzrdBiiVcRyLHj`) permanece com **0 objetos / 0 bytes** e **nenhum projeto conectado**. O teste OIDC anterior com `swim-flow-blob-smoke-ci-only` não libera autenticação Render → staging.

**Este PR implementa somente o receptor lógico offline e o contrato do armazenamento de nonces. Ele NÃO implanta uma Vercel Function, não abre URL de rede e não concede acesso a fotos.** Não assumir que Render já tenha conexão operacional.

## Protocolo 02F-06C4A

`scripts/private-blob-broker-readonly-receiver.cjs` exporta `createStagingBrokerProbeReceiver` como função de fetch puro, sem registro HTTP. O único endpoint desenhado, para quando houver projeto dedicado, é:

- `POST /api/probe`, `Content-Type: application/json`; até **1024 bytes**.
- Corpo exato em JSON assinado no contrato do PR #94, com assinatura HMAC-SHA256, audiência fixa, janela de 30 segundos, nonce UUID.
- Receptor exige `VERCEL_ENV=preview`, `BLOB_STORE_ID=store_PJZzrdBiiVcRyLHj`, `VERCEL_PROJECT_ID` idêntico a `SWIMFLOW_BLOB_BROKER_PROJECT_ID`, e **não permite os IDs conhecidos do dashboard staging nem do laboratório descartável**.
- Exige `SWIMFLOW_BLOB_BROKER_READONLY_ENABLED=true`, `VERCEL_OIDC_TOKEN` presente e nenhuma variável RW estática, experimental ou override de endpoint. Não aceita media privada ligada, R2/S3 ligados ou ambiente Vercel production.
- Exige `claimNonce` com persistência atômica durável, `head` do SDK e classe `BlobNotFoundError`. Se alguma dependência faltar, retorna `503 broker-disabled` antes de chamar o SDK.
- Envelopes válidos chegam **somente a HEAD de um caminho aleatório `__swimflow-broker-probe/v1/<uuid>.txt`**, nunca a `private/students/...`. SDK usa OIDC do contexto do projeto Vercel, sem passagem explícita de token e com timeout.
- HEAD de chave inexistente responde `200 synthetic-head-not-found`; respostas inesperadas e falhas são negadas. Não faz `PUT`, `GET`, `LIST`, `DELETE`, não retorna ETag, pathname, URL Blob ou bytes de imagem.
- Respostas `Cache-Control: private, no-store` e `X-Content-Type-Options: nosniff`; sem CORS. Falhas usam códigos públicos fixos e não exibem exceções de SDK.

## Persistência anti-replay projetada, ainda NÃO provisionada

`scripts/private-blob-broker-postgres-nonce.cjs` exporta `createAtomicPostgresNonceClaim(query)`. Usa **somente `INSERT ... ON CONFLICT (nonce_key) DO NOTHING RETURNING nonce_key` com parâmetros**, exigindo `rowCount === 1` e chave retornada idêntica. Retorna false para segunda reivindicação. Erros do banco são negados pela verificação da assinatura, sem imprimir detalhes.

`docs/sql/private_blob_broker_nonce_staging.sql` é material de **revisão, não uma migration executada**. Esse SQL exige uma tabela nova de nonces em um **PostgreSQL separado e aprovado para o broker de homologação** (ou banco staging explicitamente autorizado), nunca na produção. O projeto deve definir limites e expurgo de nonces somente após a janela de segurança. Nunca usar `Set` em memória em instâncias serverless.

## Configuração: NÃO APLICAR AINDA

Variáveis futuras do **projeto Vercel dedicado e separado**:
- `SWIMFLOW_BLOB_BROKER_READONLY_ENABLED=true` (somente após todos os testes e liberação);
- `SWIMFLOW_BLOB_BROKER_PROJECT_ID=prj_...` (ID **real** do projeto dedicado, ainda inexistente);
- `BLOB_STORE_ID=store_PJZzrdBiiVcRyLHj` (atribuído pela conexão do store ao futuro projeto);
- `SWIMFLOW_BLOB_BROKER_SHARED_KEY` (32 bytes aleatórios base64url, secret; distinto de JWT, RW e OIDC);
- `VERCEL_OIDC_TOKEN` controlado e rotacionado pela Vercel — **nunca copiado manualmente ao Render**.

A chave HMAC também terá de existir apenas no **Render staging**. Não colocar em GitHub, `VITE_*`, scripts, prints, banco ou conversa. Não criar Vercel Token, adicionar cartão nem alterar ambientes a partir deste PR.

## Verificações offline e status atual

`npm run blob:broker:receiver:test` (CI API Quality Gate) testa guardas de ambiente, assinatura, nonce, expiração, negação de GET/PUT/DELETE, tamanho do corpo, JSON inválido, erros de rede, headers, armazenamento ausente e contrato SQL atômico. Testes não fazem conexão com serviços externos.

Sem novo provider Nest, controller, endpoint Vercel, projeto, domínio, migração, rede, credencial ou registro de rota. Mesmo que o repositório seja publicado no Render, os módulos `scripts/` são **passivos e não iniciam transporte algum**.

## Passos ainda necessários para 02F-06C4B

1. Confirmar se a Vercel fornece RW estático legítimo para Render staging. Se sim, preferir a arquitetura mais simples e **não publicar broker**.
2. Se somente OIDC: criar e aprovar um projeto Vercel **novo e dedicado** para homologação, distinto de dashboard e laboratório; conectar **somente** `swim-flow-private-media-staging` a Preview.
3. Criar o bundle standalone de função Vercel a partir do receptor auditado; integrar nonce PostgreSQL com credencial **somente de staging** e table SQL revisada. Exigir nonce durável de verdade para deploy, limite de requisições/corpo e rate limiting na borda.
4. Testar a função sem segredo ou backend de nonce: deve retornar 503 (closed); depois testar com HMAC e nonce durável no staging, ainda **somente HEAD sintético**.
5. Somente após prova de segurança e análise de custos desenvolver PUT/GET privados em PRs próprios, respeitando autorização Nest, aluno/turma/responsável, ETag, auditoria, compensação, `Cache-Control` e rollout gradual.
6. Produção segue proibida até aprovação separada.

**Rollback:** reverter somente arquivos desta etapa; nenhuma tabela, objeto, segredo ou deploy foi criado.

Referências:
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/functions/quickstart
