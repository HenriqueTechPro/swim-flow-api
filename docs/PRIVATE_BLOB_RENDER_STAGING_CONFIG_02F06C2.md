# Swim Flow — Etapa 02F-06C2 | Bloqueio de credenciais e ativação no Render staging

## Descoberta da auditoria

As rotas de fotos privadas **já existem** no `UploadsController` e os respectivos serviços estão registrados no `HttpModule`:

- `privateImageUploadProvider` injeta `StorePrivateBlobImageUseCase` apenas quando `loadPrivateVercelBlobConfig` retorna uma configuração.
- `privateImageAccessProvider` injeta os casos de uso de leitura, commit, ativação e referências somente quando a mesma configuração existe.
- Sem configuração (`SWIMFLOW_PRIVATE_BLOB_ENABLED=false` ou ausente), as operações privadas retornam **503** e não acessam o armazenamento. Não foi necessário criar segundo módulo NestJS.

O loader antigo validava somente se `BLOB_READ_WRITE_TOKEN` tinha tamanho mínimo. Isso permitia **configurar acidentalmente um token de Blob de outro ambiente**, mesmo com o serviço Nest pronto para operar. Este PR fecha essa brecha **antes** da construção do adaptador.

## Contrato 02F-06C2: staging somente, fail closed

Quando `SWIMFLOW_PRIVATE_BLOB_ENABLED=true`, todos os requisitos abaixo são obrigatórios:

- `SWIMFLOW_ENVIRONMENT=staging`
- `BLOB_STORE_ID=store_PJZzrdBiiVcRyLHj`
- `BLOB_RENDER_STAGING_STORE_NAME=swim-flow-private-media-staging`
- Na infraestrutura Render (`RENDER=true`): `RENDER_EXTERNAL_HOSTNAME=swim-flow-api-staging.onrender.com`
- `BLOB_READ_WRITE_TOKEN` de verdade, do tipo `vercel_blob_rw_<store-id>_<secret>`, cujo store embutido corresponde **exatamente** a `store_PJZzrdBiiVcRyLHj`
- Flags alternativas `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED` e `SWIMFLOW_R2_STORAGE_ENABLED` desligadas
- Nenhuma variável `VERCEL_OIDC_TOKEN`, `BLOB_SMOKE_READ_WRITE_TOKEN`, `BLOB_SMOKE_STORE_ID` ou override de URL do Blob em runtime

Se qualquer requisito falhar, o bootstrap do provider lança um erro **fixo e sem credenciais**. Não há fallback de token, não se converte OIDC em RW, e não ocorre upload acidental.

**Importante:** `NODE_ENV=production` é normal para builds do Render staging; a separação é feita por `SWIMFLOW_ENVIRONMENT` e `RENDER_EXTERNAL_HOSTNAME`, não por `NODE_ENV`.

## Estado pós-merge, até nova autorização

**NÃO** configure `SWIMFLOW_PRIVATE_BLOB_ENABLED=true` no Render staging neste momento. O store `swim-flow-private-media-staging` continua sem credencial RW legítima verificada. O laboratório descartável OIDC usado no VS Code não fornece token para o Render.

Não conecte o store de produção nem compartilhe tokens ou arquivos `.env` em mensagens ou PRs.

O carregador pode ser testado offline com mocks e tokens *totalmente sintéticos*. Não há alteração de ambiente Vercel/Render, Neon, migração, rota, usuário ou arquivo real neste PR.

## Testes e próximos passos

- Testes `src/infra/storage/private-vercel-blob-config.spec.ts`: flag OFF, staging válido sintético, Render staging real versus nome production, IDs do store reais conhecidos e falsos, token de outro store, OIDC do laboratório, backends concorrentes e proteção contra vazamento da string secreta.
- CI: `npm run test:unit`, build, lint sem alteração de formato legado, e gates de PostgreSQL.
- Após o merge: confirmar que o Render staging continua atendendo `/health` e que as rotas privadas permanecem 503 sem a flag. **Não fazer upload real.**
- Próximo PR: decidir credencial permanente suportada no Render *ou* desenhar mediação server-to-server com Vercel OIDC sem delegar acesso irrestrito. Esse desenho exige autenticação da chamada Render → função Vercel, autorização pelo Nest e proteção contra replay; não implementar token improvisado.

Para reverter apenas este PR, restaurar o loader anterior é suficiente; nenhuma migração ou arquivo remoto é alterado. **Não** usar rollback que elimine mídia.

Fontes técnicas: https://render.com/docs/environment-variables e https://vercel.com/docs/vercel-blob/private-storage .
