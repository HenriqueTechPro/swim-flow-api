# Swim Flow — 02E-17C | Imagens privadas processadas na API

Base: PR #63 integrado. A API continua no Render, o dashboard permanece na
Vercel, metadados no PostgreSQL/Neon e o Vercel Blob privado ja foi criado.
**Esta PR NAO habilita upload em producao, nao cria rotas e nao consulta token.**

## Processamento de imagens

`SharpPrivateBlobImageProcessor` recebe bytes **em memoria** somente apos
verificacao do tamanho (max. 5 MiB) e autorizacao inicial. Usando Sharp
com `limitInputPixels: 16_000_000` e `failOn: 'warning'`, ele exige
imagem JPEG, PNG, WebP ou GIF declarada corretamente, dimensoes finitas,
ate 10 mil pixels por eixo e **uma unica pagina/frame**. Faz orientacao
conforme EXIF, reduz ate 2048px e converte para JPEG de qualidade 82,
**sem preservar metadados GPS, EXIF ou XMP**. Os bytes originais nunca
sao escritos no Blob.

O recurso usa native bindings de `sharp`; o CI Node 22 Linux garante
instalacao e teste. Na producao, acompanhar consumo de RAM/CPU do Render.
Esta etapa nao e endpoint HTTP e nao testa limites de multipart/Express.

## Caso de uso de upload (somente interno)

`StorePrivateBlobImageUseCase`:
1. Verifica IDs, tipo e tamanho antes de qualquer leitura de perfil.
2. Confere papel atual do solicitante no repositorio de perfis.
3. `profile-avatar` apenas do proprio perfil; para fotos de alunos,
   professores e responsaveis, somente `admin` e recurso existente.
   Professor sem escopo de turma permanece bloqueado.
4. Processa a imagem completamente e **reconfere** a permissao.
5. Gera pathname aleatorio `private/<alvo>/<id>/<uuid>.jpg`, faz PUT
   privado sem overwrite pelo adaptador oficial, valida metadata e ETag.
6. **Reconfere** permissao antes de criar a linha PostgreSQL VERIFIED
   com etag, tamanho, tipo JPEG e ID auditavel em uma unica transacao
   `INSERT`.
7. Se gravacao no banco ou ACL pos-upload falhar, tenta compensar com
   DELETE condicional ao ETag verificado. Se o DELETE falhar, a operacao
   falha fechada e um objeto orfao deve ser investigado.
8. Responde somente `uploadId` e `status`; nao retorna pathname, Blob
   URL, token ou nome original.

## Caso de uso de leitura (somente interno)

`ReadPrivateBlobImageUseCase` exige status VERIFIED, etag forte, papel
atual e existencia do recurso. Somente entao pede stream privado ao
adaptador, compara pathname/etag/MIME/tamanho e fornece os headers
`Cache-Control: private, no-store` e `nosniff`. Nenhuma URL do Blob
e disponibilizada ao React.

## Persistencia, testes e divida tecnicas

A tabela existente `private_media_objects` foi criada para URLs PUT
S3 de curta duracao e ainda exige `ticket_expires_at > created_at`,
mesmo para um Blob gerado integralmente pelo servidor. O repositorio
reusa a tabela para registrar imediatamente `VERIFIED` e grava o prazo
legado de um dia **apenas para satisfazer a constraint historica**.
Ele nao representa uma URL PUT existente e nunca habilita cleanup do
status VERIFIED. A proxima migracao **aditiva** deve separar o ciclo
de vida Blob de tickets S3, sem alterar as migracoes existentes.

O teste CI valida insercao real de uma imagem sintetica como VERIFIED
no PostgreSQL descartavel e bloqueia exclusao pelas transicoes S3.
Jest cobre revalidacao de papeis, recusa professor, remocao de EXIF,
re-encode JPEG, casos de erro, compensacao e revogacao de leitura.

**Limitacoes que impedem ativar o recurso agora:**
- Sem controller/DI Nest, sem rate limit/multipart streaming; nenhum
  endpoint novo e acessivel. Flag `SWIMFLOW_PRIVATE_BLOB_ENABLED` off.
- O token `BLOB_READ_WRITE_TOKEN` existe apenas na Vercel. Render
  necessita uma copia configurada pelo administrador em secrets quando
  houver politica de upload revisada; nao expor via `VITE_*`.
- Em falhas na confirmacao do PUT/HEAD dentro do SDK, objeto remoto pode
  existir sem retorno seguro de etag; exige reconciliacao oufao robusta.
- O papel pode ser revogado imediatamente apos a ultima verificacao:
  futuras leituras sempre revalidam ACL, e middleware autentica usuarios.
- Politica de retencao, associacao da foto ao campo do aluno e
  substituicao/remoção das fotos antigas nao estao implementadas.
- Antes de qualquer foto real verificar os termos do plano Hobby e
  protecao legal aplicavel a imagens infantis.
- Nao remover Supabase Storage, codigo S3 legado ou suas variaveis ainda.

Fontes tecnicas: https://sharp.pixelplumbing.com/ ;
https://vercel.com/docs/vercel-blob/using-blob-sdk .

**Proxima etapa**: melhorar esquema de metadata para estado de upload
servidor, associacao da imagem ao aluno com troca atomica de referencia,
reconciliacao dos orfaos, depois controller autenticado e testes do
Render em ambiente descartavel.
