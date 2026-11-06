# Colocações registradas por competição — primeira etapa

## Por que não usar o ranking histórico

`GET /api/results/ranking` é um ranking de melhores marcas individuais
entre eventos. Ele **não** representa posições de uma prova específica.

`GET /api/results/competition-placements` devolve posições **registradas**
em `pool_results.position` para uma prova individual de piscina.
Não recalcula posição pelo tempo, não seleciona melhor marca anterior
e não afirma homologação oficial que o banco ainda não armazena.

## Duas formas independentes de identificar o evento

A pesquisa oferece dois modos **mutuamente exclusivos**:

- **Vinculado:** `eventId` UUID, sem `competition` ou `date`.
  Filtra no PostgreSQL pelo `pool_results.event_id` exato.
- **Legado:** `competition` e `date` como antes, sem `eventId`.
  Passa a exigir `event_id IS NULL`, para nunca misturar eventos
  com o mesmo nome e data que tenham vínculo explícito.

Os filtros de categoria, sexo, estilo, distância e metragem de piscina
continuam necessários em ambos os modos. A resposta inclui
`eventId` (`null` para registros legados) e os snapshots originais
de competição e data do próprio resultado. A posição nunca é recalculada.

É HTTP 400 tentar combinar `eventId` com nome/data, deixar os dois
escopos incompletos ou fornecer UUID inválido.

Exemplo vinculado:

`/api/results/competition-placements?eventId=88888888-8888-4888-8888-888888888888&category=Petiz%202&gender=Feminino&style=Livre&distance=50m&poolLengthMeters=20`

## Filtros obrigatórios do modo legado

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
O filtro por `Event.id` distingue eventos vinculados homônimos, mas não
identifica provas/baterias dentro do mesmo evento. Registros legados sem
vínculo ainda podem ter nomes e datas iguais; não inferir a identidade
desses eventos por texto nem recalcular posições. Homologação e identidade
de prova precisam de evolução separada.

Águas abertas (percursos, largadas e gênero), revezamentos por equipe,
ausência de sexo de prova no snapshot e critérios oficiais de empate
permanecem fora desta primeira entrega. Não misturar com a consulta
de melhores marcas históricas. Não preencher resultados antigos.
