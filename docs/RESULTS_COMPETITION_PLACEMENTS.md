# Colocações registradas por competição — primeira etapa

## Por que não usar o ranking histórico

`GET /api/results/ranking` é um ranking de melhores marcas individuais
entre eventos. Ele **não** representa posições de uma prova específica.

`GET /api/results/competition-placements` devolve posições **registradas**
em `pool_results.position` para uma prova individual de piscina.
Não recalcula posição pelo tempo, não seleciona melhor marca anterior
e não afirma homologação oficial que o banco ainda não armazena.

## Filtros obrigatórios

`competition`, `date` (YYYY-MM-DD válido), `category`, `gender`
(Masculino/Feminino), `style`, `distance` e `poolLengthMeters`
(incluindo 20 m). `page` e `perPage` opcionais, limites 1–100.

Exemplo:

`/api/results/competition-placements?competition=Festival%20Interno&date=2026-03-31&category=Petiz%202&gender=Feminino&style=Livre&distance=50m&poolLengthMeters=20`

Somente `CLASSIFIED` com `position > 0` e duração positiva,
formato `INDIVIDUAL`. Ordenado por **posição gravada**, duração
e ID; ties, lacunas e posições repetidas são preservadas, nunca
corrigidas de forma implícita. Sem resultados: lista vazia. Retorno
paginado `{ data: [...], meta: { page, perPage, total } }`.

Segurança: JWT, admin, permissão `results:read`. Nenhum dado de contato,
nascimento ou responsável. Consultas Prisma são filtradas/paginadas
no PostgreSQL; a operação não modifica dados.

## Limitações e sequência

Esta é uma consulta de **colocações lançadas**, não uma ata homologada.
`competitionSnapshot` e `heldOn` podem não identificar univocamente
um evento com sessões homônimas. Um futuro fluxo deverá vincular resultados
a `Event.id`, prova, categoria regulamentar, bateria e status de
homologação auditável. Não se deve inferir isso a partir de nomes
ou recalcular colocações.

Águas abertas (percursos, largadas e gênero), revezamentos por equipe,
ausência de sexo de prova no snapshot e critérios oficiais de empate
permanecem fora desta primeira entrega. Não misturar com a consulta
de melhores marcas históricas. Não preencher resultados antigos.
