# Swim Flow — 02E-17B | Adaptador privado do Vercel Blob

## Estado

Etapa 02E-17A (#62) integrada. O store `swim-flow-private-media` já existe
na Vercel, vinculado ao frontend `swim-flow-dash`. A API NestJS permanece
na **Render** e esta etapa **não** transfere para ela o token Vercel.
Nenhuma foto foi enviada, lida, apagada ou migrada.

## Implementação

- Dependência oficial `@vercel/blob@2.8.2`, versão fixa com npm lock.
- `VercelPrivateBlobStorageRepository` traduz o contrato anterior para
  `put`, `head`, `get` e `del` do SDK, com chamadas sempre
  `access: 'private'` quando aplicável e token explícito no servidor.
- Nomes admitidos: `private/{profiles|students|teachers|parents}/{uuid}/{uuid}.{jpg|png|gif|webp}`;
  nada de pathname do cliente, URLs arbitrárias, `r2.dev` ou nome pessoal.
- Escrita `allowOverwrite: false`, `addRandomSuffix: false`,
  payload limitado a 5 MiB, MIME/extensão e magic bytes básicos; comparação
  entre resposta do `put` e `head` posterior (ETag/tipo/tamanho).
- Somente URLs com host `*.private.blob.vercel-storage.com` e pathname
  exato são aceitas internamente. **URL de armazenamento não é devolvida
  pela porta para o navegador nem registrada no banco**.
- Leitura com `get(pathname, { access: 'private', useCache: false })`,
  cabeçalho condicional If-Match e verificação adicional de ETag antes de
  liberar o stream. O caso `null` representa objeto ausente.
- `del` com `ifMatch` evita excluir uma geração diferente do arquivo.
- Testes Jest com SDK 100% mockado: nenhum token real, rede ou uso do Blob.

## Segurança e limitações que bloqueiam ativação

1. **Não há controller, provider Nest, rota ou comando de upload exposto**.
   `SWIMFLOW_PRIVATE_BLOB_ENABLED` continua ausente/desativado no Render.
2. Revalidar papel, turma, vínculo com responsável e recurso em **cada**
   operação. Nenhum pathname sozinho autoriza acesso.
3. O teste de magic bytes NÃO decodifica uma imagem por completo.
   Adicionar decodificação segura, remoção de EXIF e possível re-encode
   antes do primeiro upload de fotografias de menores.
4. A porta pressupõe que o chamador já validou a imagem antes do PUT.
   Não expor essa classe diretamente ao controller HTTP.
5. Falha entre PUT e HEAD/DB pode deixar órfãos. Compensação e
   limpeza com ETag e auditoria precisam ser desenhadas e testadas.
6. ETag de Vercel Blob é validador de versão, NÃO hash criptográfico.
7. O backend Render precisa ter seu próprio secret de
   `BLOB_READ_WRITE_TOKEN`. A Vercel já tem o secret no projeto do
   frontend, mas **não** está automaticamente disponível no Render.
   Nunca copiar o valor para `VITE_*`, commits, tickets ou conversas.
8. Nenhum serviço pago ou cartão foi solicitado nesta etapa. Verificar
   limites do plano Hobby antes de usar fotos reais.
9. O código S3/R2 e a integração Supabase existentes foram preservados
   por segurança de rollback; planejar retirada posterior.

## Próxima etapa sugerida

**02E-17C:** caso de uso de upload por API autenticada com tamanho máximo,
decodificação integral e autorização de recurso; persistência atômica
de metadata/ETag no Neon descartável, compensação de falhas e testes
de revogação. Separar o adaptador Blob dos use cases herdados do R2
para que nenhum cliente receba ticket S3.

Fontes oficiais:
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/docs/vercel-blob/private-storage
