# Swim Flow — 02E-17D | Blob x R2 e foto ativa por cadastro

## Objetivo

Preparar o Neon para guardar **apenas fotos privadas processadas e ativas**,
sem confundir o ciclo de vida de URLs de upload assinadas do S3/R2 com
uploads feitos dentro da API pelo Vercel Blob.

**Zero alterações em Neon real, Render, Vercel ou Supabase Storage.**
A API não registra controllers/providers HTTP novos, não lê tokens e não
envia nem apaga fotos reais. Tudo permanece opt-in/inativo.

## Migração incremental (append-only)

`20261025020000_private_blob_binding_lifecycle`:
- Adiciona `storage_provider NOT NULL DEFAULT 'R2'`. Todos os registros
  históricos, se existirem, são conservados como R2.
- Torna `ticket_expires_at` opcional e substitui somente a constraint de
  ciclo de vida: R2 continua exigindo ticket real, enquanto BLOB exige
  `ticket_expires_at IS NULL`, `status='VERIFIED'` e `verified_at`.
- `PrivateMediaObject` preserva os metadados e ETag verificáveis do PR64.
- Introduz `private_media_active_bindings` com **uma única foto ativa por
  (target,resource_id)** e um único recurso por `media_id`.
- Chave estrangeira composta relaciona `media_id + target + resource_id +
  storage_provider + status` ao registro original. O banco recusa vincular
  foto de outro aluno, imagem pendente, S3/R2, imagem rejeitada ou inexistente.
  `storage_provider='BLOB'` e `status='VERIFIED'` são protegidos por CHECK.
- Não muda colunas `photo`/`avatar_url` legadas, URLs ou dados de usuários.

## Troca atômica de referência

`AssignPrivateBlobImageUseCase` verifica permissão **atual** e mídia
BLOB VERIFIED antes de chamar o repositório.

`assignActiveVerifiedBlob` usa comparação otimista:
- `expectedMediaId=null`: cria **apenas** se o recurso ainda não possui
  vínculo (P2002 => conflito, sem substituir silenciosamente).
- `expectedMediaId=UUID`: `UPDATE ... WHERE media_id=UUID`.
  Se outra troca venceu a corrida, retorna conflito HTTP futuro (409).
- A FK do PostgreSQL protege a integridade mesmo com concorrência.
- A foto anterior **não é apagada** no momento da troca. A exclusão ficará
  para fluxo futuro, com retenção, auditoria, prevenção de órfãos e DELETE
  condicional por ETag. Não há cron nesta etapa.

`ReadPrivateBlobImageUseCase` consulta o vínculo ativo para impedir que
um identificador antigo continue servindo foto substituída. O fluxo S3/R2
é rejeitado para linhas BLOB e permanece isolado.

## Testes

- Jest: papel revogado, foto de outro usuário, BLOB x R2, CAS stale,
  concorrência simulada e rejeição de leitura de foto inativa.
- PostgreSQL local descartável: migração incremental, FK composta, CHECK,
  mudança de provedor proibida, referência estrangeira negada, CAS de troca
  e persistência de BLOB sem ticket fictício.
- `scripts/neon-local-auth-staging.cjs --check`: 5 SQL migrations travadas
  por checksum, sem credenciais nem acesso ao banco; aplicação pelo antigo
  runner segue aposentada e bloqueada.

## Pré-requisitos para eventual ativação

1. Decidir quando vincular imediatamente após o upload no fluxo HTTP.
   Atualmente o upload interno salva VERIFIED, mas **não ativa sozinho**
   a foto no cadastro. O novo caso de uso faz a vinculação explícita.
2. Desenvolver reconciliação de BLOB órfão, retenção e processo de remoção
   idempotente. O cleanup legado não toca nos registros BLOB.
3. Provar limites de upload e rate limit HTTP, autorização e revogação,
   streaming seguro e preview correto no dashboard.
4. Confirmar token servidor no Render **sem colar segredos** no código
   ou no frontend, e revisar limites/termos de uso do plano gratuito.
5. Não remover URLs antigas nem o SDK Supabase antes da migração gradual.
