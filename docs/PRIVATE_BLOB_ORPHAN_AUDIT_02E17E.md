# Swim Flow — 02E-17E | Auditoria conservadora de arquivos Blob sem foto ativa

## O que mudou

Esta etapa introduz um **inventário somente-leitura (DRY_RUN)** de
imagens armazenadas como Vercel Blob no PostgreSQL, sem apagar objetos,
registros ou associações. Não há controller, job, cron, endpoint, DI
do Nest, nem credenciais de acesso ao Vercel Blob.

A base é o PR #65 (vinculação de **uma imagem ativa por recurso**).
O banco Neon real não é acessado nesta etapa.

## Política de classificação — não é autorização para excluir

`AuditUnboundPrivateBlobImagesUseCase` aplica retenção fixa de **30 dias**:
uma foto só entra no inventário quando a data de criação **e** a data
de verificação são anteriores ao limite. A consulta Prisma usa:

- `storageProvider = 'BLOB'` (não inclui S3/R2 ou imagens legadas);
- `status = 'VERIFIED'` e `ticketExpiresAt = null`;
- `verifiedAt <= limite` e `createdAt <= limite`;
- `activeBindings: { none: {} }`, com a relação PostgreSQL efetiva;
- `take <= 26`, ordenação determinística por `verifiedAt, id`;
- somente ID interno, categoria, tamanho e instante verificado, **sem**
  selecionar `objectKey`, ETag, URL ou qualquer conteúdo da foto.

A resposta apresenta no máximo 25 candidatos, estimativa de espaço,
totais por categoria, `hasMoreCandidates`, limite temporal e
`mode: 'DRY_RUN'` / `deletedObjects: 0`. **Não** revela IDs internos,
nomes de alunos, chaves, caminhos nem tokens. Não é uma estimativa
completa de armazenamento se `hasMoreCandidates=true`.

## Por que a exclusão física permanece bloqueada

Uma foto ausente da tabela de vínculos durante `SELECT` pode ser
vinculada por outra transação logo depois. Portanto, uma lista de
candidatos **nunca** pode ser entregue diretamente a `Blob.delete`:
isso criaria perda de dados se o upload fosse ativado futuramente.

Antes de implementar GC, precisamos de uma migração aditiva com claim
atômico, estado protegido por constraints e FK, retenção, registros de
auditoria e rechecagem do ETag; a exclusão remota precisa ser idempotente.
A recuperação após falha da operação remota deve ser explícita e testada.

Também existem arquivos **sem qualquer linha no banco** (ex.: PUT no
Blob concluiu mas houve timeout antes do INSERT). Eles **não aparecem**
neste inventário SQL. Futuramente é necessário comparar inventário
privado do provedor com metadados do banco, exclusivamente no backend,
sem baixar fotos ou publicar URLs.

A etapa **não adiciona execução agendada**, nem migração nova, nem
rotas HTTP, nem leitura remota das fotos. O histórico e as imagens
existentes no Supabase Storage continuam inalterados.

## Testes

- Unitários: política de retenção de 30 dias, consulta limitada,
  tratamento de datas/candidatos inválidos, proibição de retornar
  identificadores/URLs e **zero chamadas de exclusão**.
- Repositório Prisma: filtro de provedor/estado, data e relação vazia,
  projeção mínima e limite estrito.
- PostgreSQL descartável: duas imagens antigas sem vínculo são
  candidatas; uma terceira ativa não; ao trocar vínculo, o resultado do
  inventário também muda. Esse teste comprova que a listagem é apenas
  um retrato transitório, não um lock de exclusão.
- O cleanup S3/R2 continua separado; transição `PENDING -> REJECTED`
  também exige `storageProvider='R2'`.

## Próxima etapa proposta

02E-17F: modelar **claim atômico para retenção de mídia não vinculada**,
sem conectar controllers e sem execução de DELETE real, seguido por um
teste de falhas/concor­rência no PostgreSQL descartável. Só depois
implementar exclusão remota assistida e reversível quando aplicável.
