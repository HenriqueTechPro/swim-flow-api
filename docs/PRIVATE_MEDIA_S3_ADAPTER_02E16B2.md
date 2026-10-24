# Swim Flow 02E-16B.2 — adapter S3/R2 interno (SEM ATIVAÇÃO)

## Escopo

Esta PR adiciona a implementação SigV4 com AWS SDK v3 da porta
`PrivateMediaStorageRepository` criada na 02E-16B.1:

- `signUpload`: URL assinada por 90 segundos, PUT, com Content-Type restrito;
- `headObject`: ContentType + ContentLength observados, 404 vira `null`;
- `readPrefix`: GET Range limitado a 64 bytes, falha se R2 ignorar o limite;
- `signDownload`: URL assinada por 60 segundos;
- `deleteObject`: operação privada do SDK.

O adapter checa sintaxe estrita de chaves privadas e correspondência MIME/extensão,
mas **isso não é autorização de recurso**. NÃO passar chaves arbitrárias de clientes
para esses métodos, mesmo após validar JWT. O serviço precisa verificar vínculo
professor/aluno/turma e acesso ao objeto antes de assinar qualquer URL.

O SDK exige endpoint HTTPS server-side, bucket, região e chaves; a fábrica rejeita
configuração desativada ou incompleta e não é registrada no container Nest.

## Limites explícitos

- Não cria bucket nem acessa contas reais.
- Não registra o adapter em Nest, nem expõe qualquer rota HTTP nova.
- Não muda `/api/uploads/signed-url` (Supabase) ou contratos de frontend.
- Não muda Neon, Prisma, JWT, CORS, Render ou cookies.
- `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED=false` por padrão; manter assim até
  implementação de autorização, registro `media_objects`, confirmação de PUT,
  exclusão de órfãos e testes E2E de recursos.
- Presigned PUT com Content-Type restringe o MIME declarado, **não o tamanho
  nem a validade dos bytes**; executar HEAD + GET Range + validador existente
  antes de marcar objeto como confirmado. URLs podem ser reutilizadas até vencer;
  futuros fluxos devem tratar reconfirmação e uploads concorrentes com cuidado.
- URLs assinadas são credenciais efêmeras: não salvar no banco, logs ou analytics.
- Não publicar `r2.dev`, não usar domínio público e nunca expor secrets `VITE_*`.

## Verificações

- `npm ci` com `package-lock.json` gerado pelo npm junto das dependências
  `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`;
- lint sem Prettier legado, Prettier apenas em novos arquivos, typecheck/build;
- testes unitários e e2e da API;
- quality gate PostgreSQL com banco descartável;
- testes offline cobrindo assinatura PUT/GET, 404, Range, limite, metadados e DELETE.

Próximas PRs: **02E-16B.3** vínculo/ACL e persistência de objeto pendente;
**02E-16B.4** confirmação e limpeza; **02E-16C** frontend; **02E-17**
remoção definitiva do SDK e adaptador legados.

Fontes: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
e https://developers.cloudflare.com/r2/api/s3/presigned-urls/
