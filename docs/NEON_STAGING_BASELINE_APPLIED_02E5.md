# Swim Flow — Neon staging: baseline de estrutura aplicada (02E-5)

Data: **21/10/2026**. Estado: **schema de staging criado, sem dados de aplicação**.

## Ambiente verificado

- Neon projeto: `swim-flow-staging`.
- ID: `raspy-breeze-33258358`.
- Branch: `staging`, ID `br-gentle-wildflower-b7qrnd74`.
- Banco: `swimflow`, PostgreSQL 17, AWS us-east-1 (Virgínia).
- Banco recém-criado em branco, sem nenhuma importação de Supabase.
- Pooler habilitado apenas no staging.

## Origem da estrutura

Arquivo congelado:
`prisma/migrations/20261020000000_init_neon/migration.sql`

Git blob SHA:
`a400e1c412e875cc33a766939c1dfcb5b8ccb8bb`

SHA-256 **do conteúdo exato do arquivo**:
`e98a2c3c9940e55344fc39c7a551979c7b2b20362783e2ddf44ab01b40fc3e80`

A migração foi inicialmente executada e validada na branch de
Neon `validation-prisma-baseline-20261021`, ID
`br-restless-field-b7oz99tj`, criada a partir do staging ainda vazio.
Essa branch de validação **não é produção** e deve ser removida depois
que o responsável autorizar a limpeza.

## Mecanismo de aplicação — distinção essencial

Na sessão atual, o conector Neon permitiu transações SQL, mas
**não estava disponível um executor Node conectado ao banco
para rodar o comando Prisma CLI**.

Para cumprir a autorização do usuário de criar a estrutura do banco
sem importar registros antigos, aplicou-se:

1. Transação PostgreSQL com lock consultivo e verificação do nome de
   banco e inexistência de objetos de usuário/migration prévia.
2. O conteúdo exato das **184 instruções SQL versionadas**,
   sem alterações nem instruções DML na baseline.
3. Tabela `_prisma_migrations` no layout esperado pelo Prisma 6 e
   inserção de **um único registro de baseline** concluído, com
   checksum SHA-256 exato do arquivo.
4. COMMIT único, seguido de consultas SQL de verificação.

Isso estabelece **um histórico compatível com Prisma**,
mas **não equivale a dizer que `prisma migrate deploy` foi executado**.
Antes do deploy Render deve-se rodar `prisma migrate status` com a
versão Prisma 6 do repositório, conectado com TLS ao Neon por segredo
privado. Se houver divergência, investigar **sem rodar db push,
migrate resolve ou reaplicar a baseline às cegas**.

## Evidência após a escrita no staging principal

| Verificação | Resultado |
| --- | ---: |
| Tabelas de aplicação | 31 |
| Tabela de histórico Prisma | 1 (adicional) |
| Tipos enum | 24 |
| Chaves estrangeiras | 47 |
| Constraints CHECK | 20 |
| Índices (inclui PKs/uniques) | 103 |
| Índices parciais de negócio exigidos | 6/6 |
| CHECKs de negócio nomeados e validados | 14/14 |
| Campos `duration_ms` opcionais nas modalidades | 2/2 |
| Registros em `_prisma_migrations` | 1 |
| Registro da baseline com checksum correto | 1 |
| Registros em `profiles`, `students`, `teachers` | 0 |
| Registros em `parents`, `classes`, `events` | 0 |
| Registros em `auth_sessions` | 0 |

A SQL versionada contém apenas `CREATE`/`ALTER`; o único INSERT
da operação foi a entrada no histórico do Prisma. **Não há dados
de alunos ou usuários transferidos do Supabase**.

As duas pipelines do repositório permanecem aprovadas. A PR #28
corrige um defeito de contagem no executor original: eram
31 tabelas de aplicação e 24 enums, não 32 e 25. Essa PR deve ser
integrada antes de qualquer novo procedimento dependente do executor.

## Próximos passos

1. Concluir merge da PR #28, que corrige a pós-validação de inventário.
2. Em ambiente Node seguro com `DATABASE_URL` pooled e `DIRECT_URL`
   direct, rodar apenas `prisma migrate status` e conferir o histórico.
3. Configurar **Render staging** com segredos somente no backend:
   conexão Neon, CORS de Vercel, JWT, cookies HTTP-only e adaptações
   Supabase ainda ativas para Auth/Storage.
4. Executar `GET /health` e `GET /health/ready` contra o Render,
   seguidos de CRUD de teste com dados fictícios e limpeza segura.
5. Escolher bucket S3 compatível e gratuito e substituir Storage
   posteriormente; frontend segue Vercel.

## Não fazer

- Não executar o script de primeira baseline novamente neste banco
  (agora ocupado e com histórico).
- Não cadastrar dados reais de alunos ou responsáveis antes de revisar
  autenticação, autorização, privacidade e backups.
- Não expor URL de conexão ou senha em GitHub/Vercel cliente/chat.
- Não excluir nem resetar a branch principal de staging para
  "corrigir" eventuais diferenças de schema.
