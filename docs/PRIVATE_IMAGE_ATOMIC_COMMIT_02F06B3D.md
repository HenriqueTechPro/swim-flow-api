# 02F-06B3D — Commit atômico de imagem privada e retirada segura

## Endpoint novo — sem ativação automática

`POST /api/uploads/private-images/commit` (JWT, uploads:write, ACL atual revalidada no domínio, flag Blob habilitada)

Body estrito:

```json
{
  "target": "student-photo",
  "resourceId": "UUID da entidade (avatar: UUID do próprio usuário)",
  "newMediaId": "UUID novo ou null para remover",
  "expectedMediaId": "UUID anterior ou null para primeiro vínculo",
  "expectedLegacyUrl": "URL legada exata ou null"
}
```

Resposta `{ "data": { "mediaId": "UUID|null", "status": "ACTIVE|REMOVED" } }`.
Não retorna URL privada, storage key, ETag nem token.

### Regras

- Ao ativar: a mídia nova deve ser VERIFIED, BLOB, ETag forte e corresponder exatamente ao target/recurso autorizado.
- Ao remover: é obrigatório informar o ID privado ativo anterior; `newMediaId=null`. A API não apaga bytes de Blob e não deixa o valor legado antigo ressurgir após remover.
- `expectedLegacyUrl` é obrigatório e deve corresponder ao que o cliente leu na ficha. A transação Prisma compara `photo/avatarUrl` e zera o campo público; depois cria, substitui ou remove o vínculo com CAS. **Se qualquer etapa falhar, a transação inteira é desfeita.**
- Erro `409`: campo legado mudou, imagem anterior mudou ou outro cliente ativou antes. Cliente deve recarregar a ficha e a referência ativa antes de tentar novamente.
- Recurso ausente, acesso revogado, mídia não verificada ou de outra entidade: `404`; dados incorretos `400`; armazenamento não configurado `503`.
- O FK composto existente preserva VERIFIED/BLOB e associação exata do mediaId. Não há alteração de schema ou migração.
- O antigo `POST /private-image/:id/activate` continua intacto por compatibilidade, mas não faz CAS sobre a URL legada; **o novo fluxo de CRUD deve usar somente /private-images/commit**.
- A limpeza remota continua em processo GC separado e auditado; liberar um vínculo NÃO autoriza exclusão imediata.

### Limites atuais e próximo corte

- `photo` e `avatarUrl` continuam sendo campos legados na API. Atualizações antigas concorrentes que ocorram **após** a transação de commit ainda podem escrever uma nova URL; o frontend e as rotas legadas precisam ser migrados ou bloquear essas escritas na próxima etapa.
- Esta etapa **não** ativa a flag no Render, não modifica Supabase Storage, não altera o frontend e não migra dados existentes. Evita quebrar cadastros enquanto verificamos o contrato.
- Próximo corte: consumir /commit no dashboard em um fluxo piloto, com gestão de concorrência, novo avatar privado como fonte preferencial e caminho de remoção, mantendo fallback seguro quando não houver vínculo.
