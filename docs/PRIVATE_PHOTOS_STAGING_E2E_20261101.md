# Swim Flow — Homologação real de foto privada (PR #99)

Objetivo: enviar uma foto sintética pela API NestJS no Render staging, ativá-la em um aluno fictício, ler após F5 e conferir que nenhum URL Blob ou segredo chegou ao navegador. O frontend Vercel continua INALTERADO até esse teste passar.

## Infraestrutura confirmada
- Store PRIVADO: `swim-flow-private-media-staging`, ID `store_PJZzrdBiiVcRyLHj`.
- Vercel broker: `swim-flow-private-blob-broker-staging`, projeto `prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`, organização `team_ONfSvrgCkVLlDaKIeFuPlrEL`. Única conexão Blob é Preview.
- Preview de teste isolado previamente publicado: `swim-flow-private-blob-broker-staging-4adioi4xb.vercel.app`.
- Neon staging: novo banco `swimflow_blob_broker_nonce_staging` e role SQL de mesmo nome lógico `swimflow_blob_broker_nonce_rw` com **somente SELECT/INSERT** em `private_blob_broker_nonce_claims`. Role verificado SEM SELECT/INSERT em `swimflow.public.students` e sem CREATE/DELETE/UPDATE.
- Variáveis sensíveis de banco e HMAC definidas **somente em Preview** na Vercel. As flags de mídia continuam `false`, mesmo após deploy.

## Caminho de dados e controle
Frontend autenticado → NestJS `/api/uploads/private-image` → `StorePrivateBlobImageUseCase` (permissões e Sharp) → HMAC v2 → Vercel Preview `/api/media` → nonce atômico PostgreSQL → `@vercel/blob` OIDC → metadados VERIFIED em Neon da API. A ativação é uma operação CAS separada. GET passa de novo pela ACL atual e retorna bytes proxy pela API Nest, nunca URL Blob.

O broker aceita apenas JPEG normalizado (máx. **2.800.000 bytes pós-Sharp**) nos caminhos UUID privados; recusa overwrite, replay, paths arbitrários e versões ETag divergentes. Essa restrição abaixo do limite de 5 MB da API evita ultrapassar o limite do corpo de Vercel Functions após base64. Arquivos cujo JPEG normalizado ultrapasse o limite devem falhar explicitamente, nunca truncar.

## Variáveis Vercel Preview
- `BLOB_STORE_ID` deve ser a variável auto-configurada pela conexão do store.
- `SWIMFLOW_BLOB_BROKER_PROJECT_ID` exato e `SWIMFLOW_BLOB_BROKER_NONCE_DB_HOST` exato.
- `SWIMFLOW_BLOB_BROKER_NONCE_DATABASE_URL` (Sensitive, usuário exclusivo, SSL require).
- `SWIMFLOW_BLOB_BROKER_SHARED_KEY` (Sensitive, 32 bytes base64url).
- `SWIMFLOW_BLOB_BROKER_MEDIA_ENABLED=false` **até o teste aprovado**.
- `VERCEL_OIDC_TOKEN` é gerenciado pela Vercel no runtime; NUNCA copiá-lo para Render.
- Não configurar RW token estático da produção ou do laboratório.

## Variáveis Render staging necessárias PARA habilitar depois do teste do transporte
- `SWIMFLOW_ENVIRONMENT=staging`
- `SWIMFLOW_PRIVATE_BLOB_ENABLED=true` (somente na janela de teste, manter OFF até então)
- `SWIMFLOW_PRIVATE_BLOB_TRANSPORT=broker`
- `BLOB_STORE_ID=store_PJZzrdBiiVcRyLHj`
- `BLOB_RENDER_STAGING_STORE_NAME=swim-flow-private-media-staging`
- `SWIMFLOW_BLOB_BROKER_PROJECT_ID=prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`
- `SWIMFLOW_BLOB_BROKER_URL=https://<URL_REAL_PREVIEW>/api/media`
- `SWIMFLOW_BLOB_BROKER_SHARED_KEY` **mesma chave guardada em Vercel Preview** (Sensitive/Secret).
- `SWIMFLOW_BLOB_BROKER_BYPASS_TOKEN` token **específico de Deployment Protection** no projeto Vercel dedicado (32 caracteres).
- `RENDER_EXTERNAL_HOSTNAME=swim-flow-api-staging.onrender.com` já deve ser a identidade do serviço; `RENDER=true` fornecido pelo Render.
- Jamais adicionar segredos em `VITE_*`, GitHub repo/CI, screenshots ou mensagens.

A Preview da Vercel está protegida por SSO. O Render necessita do cabeçalho `x-vercel-protection-bypass`; o adaptador já o envia, mas o token precisa ser criado e configurado com o Render conectado. Não remover SSO como atalho.

## Checklist E2E com usuário ADMIN fictício, via Insomnia
1. Confirmar broker Preview correto, sem publicação no dashboard principal e sem fazer foto real.
2. Testar `POST /api/media` sem HMAC: deve responder 503 com flag OFF (ou 401 quando redeploy/auth habilitados); nunca retornar bytes.
3. Ativar as duas flags em janela de homologação e executar login do ADMIN fictício na API staging.
4. Criar aluno **fictício** na API staging e obter UUID. Fazer `POST /api/uploads/private-image` com Bearer do ADMIN e `multipart/form-data`: `target=student-photo`, `resourceId=<uuid do aluno>`, `file=<jpeg sintético>`. Resposta: `data.uploadId` e `VERIFIED`.
5. Para novo aluno sem foto antiga, ativar com `POST /api/uploads/private-image/<uploadId>/activate` e body `{"expectedMediaId":null}`. Se existir foto legado, usar `POST /api/uploads/private-images/commit` com expectedLegacyUrl correto, expectedMediaId, newMediaId.
6. `GET /api/uploads/private-image/<uploadId>` com Bearer autorizado deve devolver `image/jpeg`, `Cache-Control: private, no-store`. Um usuário não autorizado deve obter 404.
7. Recarregar e conferir a referência ativa via `POST /api/uploads/private-images/active-references`, usando `{"target":"student-photo","resourceIds":["<uuid>"]}`.
8. Trocar foto via novo upload e commit/activate CAS, conferir ETag/UUID e não retornar URL.
9. Desligar as flags e confirmar que rotas privadas voltam a negar acesso. Não apagar fotos nem registros automaticamente.

## Gate de entrega
Um merge com CI verde **não** prova E2E no Render. Não afirmar que fotos funcionam até validar essa sequência de ponta a ponta. A equipe pode conectar o app Render ao ChatGPT para permitir configuração do ambiente e validação sem cópia de segredos.
