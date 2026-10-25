# Swim Flow — Etapa 02E-16A | Fundação para fotos privadas no Cloudflare R2

Data: 24/10/2026. Repositório API NestJS (Render), banco PostgreSQL (Neon).
**PR de preparação. NÃO ativa o R2 nem altera o upload existente.**

## Por que esta migração?

1. O frontend ainda usa `src/lib/media/upload-image.ts` com
   `@supabase/supabase-js`, inclusive fallback direto para o Storage.
2. O backend usa `SupabaseManagedUploadsRepository` no `HttpModule`.
3. O contrato de upload devolve `bucket/path/token/publicUrl`, concebido
   para imagens publicamente acessíveis no Supabase. Fotos de alunos menores
   precisam de **bucket privado** e leitura autorizada.
4. Login por senha no Neon e acesso ao dashboard seguem funcionando;
   o responsável informou que os antigos GET 401 deixaram de ocorrer.
   Não modificar refresh, login ou CORS nesta PR.

## Provedor proposto

**Cloudflare R2, classe Standard**, API compatível com S3:
- Cota gratuita atual publicada: 10 GB-mês, 1 milhão de operações Class A
  e 10 milhões Class B por mês; saída de dados gratuita.
- Presigned PUT/GET no endpoint `<ACCOUNT_ID>.r2.cloudflarestorage.com`
  sem domínio próprio; não usar URLs públicas permanentes para menores.
- Fontes oficiais: https://developers.cloudflare.com/r2/pricing/ e
  https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Revisar preços, limites e exigências da conta no momento de ativar.
- Acesso de serviço com token R2 limitado ao bucket e às operações
  estritamente necessárias. Chaves **só no Render**, nunca `VITE_*`.

## Entregue nesta PR (segurança antes da integração)

- `planPrivateImageUpload` cria apenas um plano de objeto **privado**;
  não aceita caminho, bucket, URL ou extensão de arquivo enviados pelo
  navegador. Deriva prefixo de tipo, identificador UUID autorizado
  e nome final de outro UUID aleatório.
- Suporta `profile-avatar`, `student-photo`, `teacher-photo` e
  `parent-photo`, mantendo tipos JPG/PNG/WEBP/GIF do fluxo atual.
- Exige tamanho positivo, inteiro, dentro de 5 MiB. Esse dado só servirá
  para validação prévia: **o backend também deverá verificar o tamanho
  real dos bytes/objeto no upload**, não confiar apenas no número do
  navegador nem na assinatura do Content-Type.
- `loadPrivateR2Config` retorna `null` com rollout desativado e
  bloqueia ativação malformada/missing credentials sem exibir segredos.
  Constrói o endpoint a partir de account ID hexadecimal estrito, em vez
  de aceitar endpoint arbitrário (reduz risco de SSRF).
- Jest sem credenciais verifica bucket privado, MIME, tamanho, UUID,
  bloqueio de URLs públicas, configuração e segurança de mensagens.
- `.env.example` documenta as futuras variáveis, **comentadas**.
- Não foram adicionadas dependências npm, endpoints, mudanças no schema,
  migrações, usuários, blobs ou chamadas reais ao R2/Neon.

## Ordem obrigatória antes do cutover

**02E-16B — backend com AWS SDK v3 e lockfile revisado**
- Usar `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`.
- Inserir adapter S3/R2 no `ManagedUploadsRepository`, desligado por
  padrão, com rollout explícito; jamais inserir chaves no `VITE_*`.
- Atualizar o contrato DTO: tamanho real + `uploadUrl` assinado,
  `objectKey` e expiração curta; nunca enviar URL pública. PUT
  exige Content-Type exato e cabeçalhos assinados. Não adicionar
  fallback Supabase a partir do modo R2.
- Testar sem internet com dependência S3 mockada e um R2/bucket de teste
  explicitamente autorizado para teste de integração.

**02E-16C — persistência, leitura e segurança de mídia**
- Guardar apenas a referência de objeto no banco, não a presigned URL.
- Validar MIME pelos bytes/magic number e tamanho **real** do objeto
  (streaming proxy ou HEAD/validação final), com limpeza de tentativas
  incompletas. Não considerar upload confirmado até essa verificação.
- Validar autorização específica de leitura por aluno/responsável/
  professor/clube. A verificação existente de `existsForTarget`
  garante apenas existência do recurso; **não garante escopo de professor**
  para qualquer aluno. Resolver antes de publicar.
- Emitir GET privado curto apenas após checar permissões. Evitar
  expor URLs em logs, analytics, browser history ou toast.
- Rotina de limpeza de versões antigas/órfãs, remoção, cache privado
  e retenção compatível com dados de crianças.

**02E-16D — frontend, CORS e corte definitivo**
- Substituir `supabase.storage` do frontend por PUT da URL
  retornada pela API; atualizar visualização privada e estados de erro.
- Restringir CORS de bucket a
  `https://swim-flow-dash.vercel.app` e ambientes explicitamente
  permitidos; método PUT e cabeçalhos de content-type assinados.
- Testar fluxo ponta-a-ponta com **dados sintéticos** e usuário de papel
  limitado; testar objeto acima de 5 MiB, MIME divergente, recurso de
  outro professor, URLs expiradas/reutilizadas e exclusão.
- Somente após CI e E2E: remover SDK Supabase, adaptadores, fallback,
  `VITE_SUPABASE_*` e variáveis API legadas.
- Manter login, refresh e admin Neon intocados durante o cutover.

## Restrições de ativação

O flag `SWIMFLOW_R2_STORAGE_ENABLED` existe **somente no parser de
configuração de preparação nesta etapa**. Ele NÃO seleciona provedores,
NÃO ativa uploads, NÃO deve ser configurado como `true` no Render, e
NÃO substitui o adapter atual. Não criar bucket nem colar API keys no
GitHub para aprovar esta PR. O próximo passo é provisionar R2 privado e
integrar o SDK com lockfile e testes sem afetar o serviço atual.
