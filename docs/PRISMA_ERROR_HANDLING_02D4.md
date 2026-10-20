# Swim Flow — Etapa 02D-4: erros de banco e retry transacional

## Escopo

A API usa `AppErrorFilter` global para todos os endpoints. O mapeamento
HTTP dos erros de banco agora é centralizado em
`src/infra/http/filters/prisma-error.mapper.ts`.

| Erro Prisma / PostgreSQL | HTTP | Motivo |
|---|---:|---|
| P2002 | 409 | Violação de unicidade, inclusive índices parciais |
| P2003, P2004, P2014 | 409 | Integridade referencial/relacional |
| P2034 | 409 | Deadlock ou conflito de transação não resolvido |
| P2025 | 404 | Registro requerido inexistente |
| P2024 | 503 | Pool de conexões indisponível |
| PostgreSQL CHECK (23514, via Prisma UnknownRequestError) | 422 | Dado viola regra estável de validação |
| Outros erros Prisma conhecidos | 422 genérico | Resposta sanitizada (revisar individualmente no futuro) |
| Outros erros inesperados | 500 | Resposta genérica sem SQL/valores pessoais |

Não devolver mensagem, `meta`, índice, SQL, tabela, coluna, nome de aluno
ou parâmetros do erro Prisma para o cliente. Os testes verificam isso tanto
na função de mapeamento quanto na resposta HTTP do NestJS.

## Retry limitado e explicitamente autorizado

`retryRolledBackTransaction` aceita uma **função que inicia e conclui uma
transação inteira**. Só repete depois que a primeira tentativa falhar com
`PrismaClientKnownRequestError.code === 'P2034'`, por no máximo **duas
tentativas totais**. Outras exceções são propagadas imediatamente.

Primeiro uso: `PrismaExStudentsRepository.create`, que faz leituras, troca
condicional de status e inserção de histórico em uma única transação Prisma.
Se o PostgreSQL abortar a transação, a operação será reiniciada desde a
primeira leitura. Invalidação de cache só ocorre depois de êxito completo.

**Não usar** o helper em operações que mandem mensagens, criem arquivos,
disparem webhooks, interajam com provedores externos, ou tenham efeitos
não transacionais. **Não repetir P2002, P2003, P2025, nem 409 de aplicação.**
Não implementar retry indiscriminado no filtro HTTP.

## Testes

- Testes unitários dos códigos Prisma e mensagens públicas seguras.
- Retry com sucesso, conflito persistente e falhas que não podem ser repetidas.
- Teste do repositório de desligamentos comprovando que o corpo da transação
  é invocado novamente no conflito e que o cache é invalidado uma só vez.
- E2E HTTP com repositório simulado lançando erros Prisma e uso do filtro
  real de exceções do NestJS.
- CI anterior continua executando PostgreSQL 16 real para a baseline,
  integridade e disputa de gravação.

## Limites

Esta etapa **não** altera a migração inicial nem cria novas tabelas,
**não** acessa banco Neon/Render/Supabase e **não** faz deploy.

Outros repositórios continuam sem retry intencional até comprovarem
atomicidade e ausência de efeitos externos. Depois será possível adicionar
retry caso a caso, com teste real no PostgreSQL descartável.
