# Swim Flow — 02E-16B.5 | PUT único e leitura vinculada ao ETag

Base: PR #59 integrado. Código continua **desligado**: nenhum novo controller,
provider, cron ou endpoint; sem alteração do frontend, do Render ou do JWT.

## Contrato de uploads seguros

O adapter S3/R2 agora cria `PutObjectCommand({ IfNoneMatch: '*' })`
e assina **ambos** os cabeçalhos `Content-Type` e `If-None-Match`.
O cliente deverá enviá-los exatamente como retornados em `headers`.

O Cloudflare R2 informa que gravações `PutObject` condicionais são
atômicas contra a versão comprometida atual do objeto. Se a mesma
URL for reutilizada (ou várias requisições forem feitas ao mesmo tempo),
apenas a primeira criação sobre uma chave ausente pode ter sucesso.
As demais falham com **412 PreconditionFailed**, sem sobrescrever a imagem.

**Não tratar ETag como MD5 ou hash de conteúdo.** ETag é um validador de
versão opaco, inclusive nos uploads multipart.

Fontes oficiais:
- https://developers.cloudflare.com/r2/api/s3/api/
- https://developers.cloudflare.com/r2/api/s3/extensions/
- https://developers.cloudflare.com/r2/reference/consistency/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/

## Confirmação e armazenamento

- `HeadObject` retorna tamanho, tipo e ETag observado.
- O verificador exige um ETag forte, com aspas, sem caracteres de controle.
- `GetObject` de prefixo envia `If-Match: <ETag do HEAD>`; se outro
  objeto substituiu os bytes, R2/S3 deve responder `412` e a
  confirmação permanece `PENDING` sem anunciar sucesso.
- Após confirmar assinatura dos bytes e tamanho, um novo HEAD exige
  o **mesmo** ETag, tipo e tamanho.
- O CAS `PENDING → VERIFIED` grava `verified_at` e
  `verified_etag` **juntos**, no PostgreSQL.
- A migração incremental `20261025010000_private_media_verified_etag`
  adiciona coluna opcional com CHECK que exige ETag forte em toda mídia
  VERIFIED; **nenhuma migração anterior foi reescrita**.

## Download privado

Na leitura, a API verifica papel atual, propriedade e estado `VERIFIED`.
Gera um GET assinado (60s) com `If-Match: <verified_etag>` assinado;
o futuro cliente deverá fornecer esse header exato. Se o objeto no R2
não corresponder ao ETag gravado, a leitura falha, não serve novos bytes.

## CI, testes e limitações

- Verificação de TypeScript, Prettier incremental, Jest, E2E e banco
  PostgreSQL descartável; sem chamada real ao R2.
- Testes isolados do AWS SDK verificam cabeçalhos condicionais e
  `X-Amz-SignedHeaders`, além de `If-Match` em GET/Range.
- SQL descartável verifica coluna `verified_etag`, valores válidos,
  inválidos e atomicidade de estado.
- Testes de integração **reais** com bucket R2 descartável continuam
  pendentes: PUT e replay concorrente (apenas um 200, demais 412),
  HEAD/GET com ETag, overwrite e GET incorretos (412), falha de rede
  e in-flight uploads. A documentação confirma o suporte, mas testes
  simulados não substituem esse ensaio.

### Limites ainda não resolvidos

1. Bucket privado, sem `r2.dev`; CORS de Vercel deve permitir
   `Content-Type`, `If-None-Match` e `If-Match`, além de métodos
   PUT e GET. **Verificar de verdade no navegador**.
2. `If-None-Match: *` impede substituir objetos existentes, porém após
   um DELETE a chave volta a ficar disponível. Uma requisição antiga
   ainda em voo pode completar **depois** do DELETE, criando órfão.
   A espera de 2 minutos de 02E-16B.4 não garante que todo PUT
   iniciado antes da expiração terminou. Antes de ligar cleanup
   em produção, implementar e testar política para esse caso.
3. Usuários com credenciais administrativas S3 podem sobrescrever fora
   do fluxo; privilegiar credenciais estritamente limitadas.
   O GET condicional falha caso o ETag armazenado já não corresponda.
4. Prefixo/magic bytes **não** provam decodificação de imagem completa
   nem remoção de EXIF; adicionar validação/normalização de imagem antes
   de liberar fotos de crianças em ambiente real.
5. ETag não impede objetos *maliciosos* com assinatura inicial válida.
6. O código segue **não conectado** ao Nest HTTP; nenhum arquivo real
   foi transferido, e o banco Neon real não recebeu migrações nesta etapa.
7. URLs GET e PUT são credenciais temporárias; não persistir, não logar,
   não retornar a quem não tenha autorização atual.
8. As fotos legadas ainda usam Supabase Storage: não remover SDK,
   variáveis nem URLs antes de substituir o upload do React.

## Próximo passo

**02E-16B.6**: teste de integração privado em um bucket descartável R2
que o proprietário da conta poderá provisionar, usando credenciais de
teste **somente em secrets protegidos**, sem colar no chat.
Validar rede, CORS, 412, PUT tardio, limpeza e decodificação completa
para então permitir o cutover HTTP/React na **02E-16C**.
