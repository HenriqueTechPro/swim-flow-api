# Etapa 02C-1 — Temporadas e integridade de alunos (pré-Neon)

## Escopo

Sem dados definitivos a migrar, o objetivo é modelar corretamente períodos e
histórico antes de gerar a primeira migration Neon. **Este PR não acessa nenhum
banco nem executa SQL**.

### Temporadas

- `Season`: ano competitivo, rótulo, intervalo inclusivo (`startsOn`/`endsOn`),
  estado PLANNED/ACTIVE/CLOSED. Ano é único. O PostgreSQL vai limitar uma
  temporada ACTIVE por meio de índice único parcial.
- `StudentSeasonCategory`: categoria do aluno **naquele ano**, com índice
  único `[studentId,seasonId]`; permite consultar o histórico sem reclassificar
  resultados antigos ao mudar de ano.
- `Event`, `PoolResult` e `OpenWaterResult`: FK opcional para `Season`,
  preservando compatibilidade com registros independentes.
- `StudentProfilePolicy` aceita o ano da temporada ACTIVE via dados de
  referência. Sem temporada cadastrada, usa o ano UTC atual como fallback
  temporário; rejeita datas ISO impossíveis/futuras.
- Criação/atualização do aluno passa a registrar ou atualizar a categoria da
  temporada ativa, quando existente. Os relatórios anteriores continuam
  consumindo `Student.categoryId` por compatibilidade. A sincronização
  em lote na virada do ano será uma etapa própria; **criar uma nova temporada
  não reclassifica automaticamente alunos existentes**.

### Segurança dos históricos

- Arquivamento de ex-aluno passa a usar nomes reais das relações
  `Student.category` e `Student.level` (não rótulos denormalizados e
  potencialmente vazios); preserva snapshot do desligamento.
- `birthYear` agora admite NULL se a data de nascimento não existe, sem
  inventar 2026 ou outro ano.
- Filtro de alunos por categoria consulta a FK real, não a string
  `Student.categoryLabel`.
- `StudentClass.fromDate` passa a ser obrigatório, com default data atual.
- `prisma/sql/pre_neon/02c_seasons_enrollments.sql` é somente o complemento
  SQL proposto da **primeira migration versionada**. Nunca usar `db push`
  para tentar reproduzir índices parciais: esse SQL deve ser concatenado à
  migration inicial e testado em PostgreSQL descartável.

### Decisões reservadas aos próximos PRs

1. `Student.categoryLabel`, `Student.levelLabel` e `ExStudent` ainda
   contêm campos legados usados por outros contratos. Substituí-los em todas
   as rotas antes de remover colunas da baseline.
2. Revisar regulamento real por competição/temporada: `Pre-Master`,
   `Senior` e faixas Master não devem ser alteradas apenas por suposição.
3. Matrículas antigas mantêm histórico e não devem ser removidas ao transferir
   aluno; verificar operações de remoção/reativação e compatibilidade
   com índices únicos antes de executar SQL.
4. Substituir `Student.parentId` por relações N:N de responsáveis com vínculo
   de principal/contato sem perder dados atuais; fase específica.
5. Vincular `Teacher` ao `Profile` para limitar autorização por turma.
6. Implementar atualização explícita de ano ativo e rollover de categorias
   em transação, com testes de concorrência.
7. Preparar primeira migration Neon com **todos** os CHECKs e índices parciais,
   CI de banco temporário e validação de constraints.

### Dados antigos

O projeto permanece parado e seus registros anteriores são de teste. É
aceitável criar o Neon vazio, mas **não apagar automaticamente o banco Supabase
ou dados pessoais que eventualmente estejam lá**. Descarte depende de uma
operação separada, explícita e limitada ao ambiente de teste.
