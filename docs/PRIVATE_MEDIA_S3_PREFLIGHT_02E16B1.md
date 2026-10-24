# Swim Flow 02E-16B.1 — S3/R2 preflight (sem ativação)

Esta PR prepara a ligação de S3-compatible storage de forma **fail-closed**:
configuração apenas no backend, validação de rollout e porta de acesso a
objetos privados. Não há cliente S3 em runtime, endpoint HTTP novo, bucket,
upload ativo nem migração Prisma.

## Decisões

- Primeiro provedor: Cloudflare R2 Standard, bucket **privado**.
- Credenciais e `S3_*` somente no Render, **nunca** em variáveis `VITE_*`.
- `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED=false` por padrão. Quando ativada,
  a configuração exige endpoint HTTPS sem path, credenciais embutidas ou query,
  region, bucket, access key e secret; configuração parcial falha ao iniciar.
- A rota `POST /api/uploads/signed-url` e o contrato Supabase existente
  **não foram modificados**. Não habilitar a flag até implementar a 02E-16B.2.
- A porta `PrivateMediaStorageRepository` não está registrada no Nest nem
  exposta em controller. Mais adiante, apenas um caso de uso autorizado deverá
  assinar leitura e escrita.
- Novo validador `verifyPrivateImageObject` confere o tamanho *real*
  da resposta HEAD, MIME observado e bytes iniciais via GET Range contra
  o contrato solicitado. Magic bytes não equivalem à decodificação/reencode
  completo de imagem, que pode ser exigido no endurecimento posterior.

## Próximos incrementos (não feitos aqui)

1. Adicionar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`
   **junto do package-lock gerado pelo npm**, implementar o adapter SigV4,
   PUT com TTL de 90s, GET com TTL de 60s, HEAD/Range/DELETE e testes com fake.
2. Verificar permissão **por recurso** (professor x aluno/turma/clube) antes
   de qualquer assinatura, e registrar objetos pendentes em `media_objects`.
3. Após PUT, conferir tamanho/MIME observados e assinatura dos bytes ANTES
   de marcar um objeto como confirmado; excluir objetos inválidos e órfãos.
4. Autorizar novamente no GET e assinar leitura por prazo curto; nunca
   persistir URLs GET assinadas ou guardar URL pública.
5. Criar R2 privado; aplicar CORS apenas para a origem HTTPS de produção da
   Vercel, `PUT`, `Content-Type`, e somente os headers efetivamente usados.
   Não habilitar subdomínio R2.dev público. Testar com dados fictícios.
6. Migrar frontend numa PR separada e somente depois retirar Supabase SDK.

## Checklist operacional

- [ ] `npm ci`, `npm run lint:check`, `npm run test:unit`, `npm run build`.
- [ ] Quality gates PostgreSQL intactos (não executa migrações).
- [ ] Sem chamadas R2/Neon/Render/Vercel e sem mudança de JWT/cookies.
- [ ] Merge manual após validação.

Documentação oficial:
- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://developers.cloudflare.com/r2/buckets/cors/
