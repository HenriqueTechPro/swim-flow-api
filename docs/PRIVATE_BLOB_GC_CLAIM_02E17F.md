# Swim Flow — 02E-17F | Reserva transacional para limpeza de Blob

## Por que esta etapa existe

O PR #66 identificou fotos BLOB VERIFIED antigas sem vínculo ativo. Entretanto,
um SELECT de "órfãos" não impede que uma foto seja associada a um aluno
imediatamente após a consulta. Uma operação DELETE nessa janela poderia
apagar a foto ativa de uma criança. **Este PR não envia, lê nem remove
nenhum arquivo real no Vercel Blob.**

## Migração SQL aditiva

`20261026000000_private_blob_cleanup_claim`:
- adiciona `cleanup_claimed_at TIMESTAMPTZ(6) NULL`;
- admite apenas para BLOB o estado `GC_CLAIMED`, com
  `verified_at`, `verified_etag` forte e `cleanup_claimed_at >= verified_at`;
- exige `cleanup_claimed_at = NULL` para imagens VERIFIED e todo ciclo
  S3/R2, preservando tickets legados;
- permite reter ETag da versão exata enquanto GC_CLAIMED;
- mantém a FK composta do PR #65, que **só aceita o status VERIFIED**
  como foto ativa. Logo, a transição para GC_CLAIMED é recusada se
  houver um vínculo ativo.

O histórico de migrações anterior permanece intocado. O checksum da nova
migração é adicionado ao verificador local de arquivos; o antigo runner
de staging continua desativado para operações `--apply`.

## Algoritmo atomicamente seguro no PostgreSQL

`PrismaPrivateMediaObjectsRepository.claimUnboundVerifiedBlobForCleanup`:

1. Transação, `SELECT ... FOR UPDATE` para bloquear **a própria linha**
   de mídia, filtrando BLOB VERIFIED, sem ticket nem claim, com `created_at`
   e `verified_at` anteriores ao cutoff.
2. Em **novo comando após o lock**, consulta `private_media_active_bindings`
   pelo `media_id`. Se existir, retorna `false`.
3. Atualiza exclusivamente a mesma linha, de VERIFIED para GC_CLAIMED,
   registrando o horário, ainda dentro da transação.
4. O lock `FOR UPDATE` conflita com `KEY SHARE` obtido pela FK na
   inserção/atualização do vínculo. Se o vínculo venceu, o claim recusa.
   Se o claim venceu, o vínculo não consegue referenciar GC_CLAIMED.
   Essa propriedade impede "selecionou órfão, depois virou foto ativa"
   dentro da reserva da futura limpeza.

`ClaimUnboundPrivateBlobImageUseCase` aplica a retenção fixa de
**30 dias**, valida UUID/data e retorna `GC_CLAIMED` ou
`NOT_ELIGIBLE` com `deletedObjects:0`, sem pathname ou ETag.

## O que permanece explicitamente bloqueado

- Nenhum controller, DI Nest, job, cron, chamada `del()` ou token R/W.
- Claim em banco não apaga bytes. Ainda precisamos de DELETE remoto
  condicionado ao ETag, auditoria, idempotência, confirmação de exclusão
  e política de recuperação de falhas (inclusive quedas entre operação
  remota e atualização do PostgreSQL).
- `GC_CLAIMED` é propositalmente uma reserva persistente. Não é
  permitido restaurar uma foto automaticamente nem reduzir sua retenção
  sem um novo protocolo transacional e testes.
- Objetos que existem no Vercel Blob **sem linha no banco** não aparecem
  neste mecanismo e exigem uma reconciliação de inventário separada.
- Nenhum comando deste PR é executado no Neon real, Render, Vercel ou
  Supabase Storage. O transporte e as fotos continuam inativos no Render.

## CI

- Testes unitários do caso de uso, da ordenação dos locks e da recusa
  de operações com entrada inválida;
- PostgreSQL descartável: BLOB antigo órfão pode ser claimed uma vez;
  BLOB recente ou com vínculo ativo não pode; FK recusa reatribuição a
  GC_CLAIMED; SQL CHECK recusa claim sem timestamp;
- concorrência determinística com 2 conexões: uma transação segura o
  lock e associa a foto, enquanto a outra aguarda para reivindicar;
  a segunda observa a associação já confirmada e falha sem perda;
- schema/migrações Prisma drift-check, API build/lint/format/Jest.

## Próxima etapa

02E-17G: desenhar a reconciliação e fechamento do ciclo de exclusão
(pausável, auditável e idempotente) **antes** de habilitar o Vercel Blob
na API de produção. Continuaremos sem colocar cartão de crédito.
