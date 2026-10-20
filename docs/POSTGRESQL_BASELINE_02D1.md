# Etapa 02D-1 — baseline PostgreSQL versionada antes do Neon

## Por que esta migração é diferente

A base Supabase antiga contém registros de teste e não será migrada.
O banco Neon ainda **não existe**. Esta primeira migração destina-se
**exclusivamente a PostgreSQL vazio**, nunca ao Supabase antigo nem a
uma base com dados reais.

O esquema canônico de 31 tabelas, 25 enums e relacionamentos vem de
`prisma/schema.prisma`. O arquivo versionado definitivo é:

`prisma/migrations/20261020000000_init_neon/migration.sql`.

O gerador determinístico:
`node scripts/create-neon-baseline.cjs`

O verificador (não altera arquivos):
`node scripts/create-neon-baseline.cjs --check`

O gerador compara **todo** o schema + os quatro arquivos complementares.
Um SHA-256 dos insumos faz parte do cabeçalho da migração. O arquivo
versionado deve permanecer idêntico ao gerado sob o Prisma versionado em
`package-lock.json`. Nunca usar `prisma db push` como substituto de
migration versionada.

## Restrições nativas do PostgreSQL

Os SQLs em `prisma/sql/pre_neon/` compõem a migration **após** o DDL Prisma:

- 02C: um período ACTIVE, integridade de datas de temporada/matrícula,
  um professor principal por turma, uma matrícula primária ativa e
  proibição de pares aluno–turma atualmente duplicados.
- 02C-2: um responsável principal por aluno; outros adultos permitidos.
- 02C-3: somente um desligamento vigente por aluno; histórico preservado,
  sem encerramento simultaneamente anulado e reativado.
- 02D-1: provas de piscina e águas abertas com distância, tempo e
  colocação positivos; CLASSIFIED requer tempo; piscina com comprimento
  positivo; dimensões e peso antropométricos opcionais, mas positivos
  quando informados; pontuações não negativas.

A antiga restrição de saída `exit_date_at <= CURRENT_DATE` foi removida
do SQL porque depende da data de execução, o que não é apropriado para
uma constraint assumida estável no PostgreSQL. A API já rejeita datas
de desligamento futuras.

## Como testar sem tocar em dados reais

A workflow `.github/workflows/database-quality.yml` cria um PostgreSQL 16
efêmero, roda `npm ci`, valida Prisma, compara a migração com os insumos,
executa `prisma migrate deploy` e checa índices, CHECKs e campos NULL.
O teste insere dados fictícios no contêiner e exige falha para uma segunda
temporada ACTIVE, período invertido e piscina de tamanho zero.
A seguir, `prisma migrate deploy` roda novamente para provar que não
reexecuta alterações.

O teste HTTP/unidade da API permanece em `api-ci.yml`. A migração
**não** deve ser aplicada ao Neon se qualquer uma das duas CIs falhar.

## Pontos ainda não resolvidos para produção

- Regras de matrícula e avaliações exigem testes transacionais adicionais
  em Prisma/PostgreSQL, inclusive concorrência e integridade multi-tabela.
- Validar seed mínimo, autenticação e módulos críticos em um staging
  descartável antes de cadastrar alunos reais.
- Supabase Auth e Storage ainda precisam de substituição, mantendo os
  dados privados enquanto isso.
- Política LGPD, permissão de divulgação de resultados e isolamento de
  acesso a documentos pessoais devem ser auditados.
- Toda alteração futura de schema exige migration incremental **nova**,
  não edição da inicial depois de colocá-la em qualquer ambiente real.
- Para evitar riscos de perda de dados, conferir que a URL do
  banco de destino está vazia e que a execução ocorre no ambiente certo.

## Estado atual

- Migração criada: **sim, versionada**.
- Testes com PostgreSQL descartável: **automatizados** pela CI.
- Neon criado: **não**.
- Render conectado a Neon: **não**.
- Supabase antigo apagado: **não**.
