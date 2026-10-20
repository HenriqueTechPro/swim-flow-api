# Swim Flow — Etapa 02B / resultados de piscina × águas abertas

## Situação

Este PR introduz a persistência **canônica futura** `PoolResult` e
`OpenWaterResult` e uma política de comparação tipada e testada.

**ATENÇÃO:** a API em execução ainda usa a tabela legada `Result`.
**Não** publicar o schema, **não** gerar a baseline de Neon e **não** criar dados
nas novas tabelas antes que o próximo PR migre a API e elimine a tabela legada
do schema. As tabelas coexistem apenas temporariamente durante a remodelagem
na branch. Não há escrita dupla.

## Modelo físico

- `PoolResult` e `OpenWaterResult` têm chaves UUID próprias e FK para `Student`
  (exclusão restringida quando há histórico esportivo).
- `Event` é opcional em ambas: vínculo por FK, preservando um nome de competição
  como snapshot histórico quando não houver evento cadastrado.
- `distanceMeters Int` é distância em metros inteiros, inclusive distâncias
  não padronizadas. Nenhum texto `'1500m'`/ `'1.5km'`.
- `durationMs Int?` é tempo em milissegundos. `NULL` significa sem tempo medido;
  zero não é uma duração válida. O sistema formata a duração na apresentação.
- `position Int?` é a colocação, não zero como placeholder.
- `RaceResultStatus` contempla PENDING, CLASSIFIED, DISQUALIFIED,
  DID_NOT_START e DID_NOT_FINISH. Resultado classificado exige duração por
  política de domínio; classificado sem colocação é permitido até a apuração.
- `PoolResult`: `SwimmingStyle`, `PoolResultFormat` e
  `poolLengthMeters Decimal?`, preservando piscinas de 20/25/50m.
- `OpenWaterResult`: ambiente aquático opcional, `routeKey` opcional,
  `OpenWaterResultFormat`, `SwimmingStyle?` para casos atípicos.
- Campos `categorySnapshot` e `competitionSnapshot` são retratos históricos,
  evitando depender da categoria atual do atleta ou do título atual do evento.

## Comparação / recordes

- Melhores marcas automáticas serão calculadas apenas para **provas individuais
  de piscina com comprimento conhecido**, na mesma distância, estilo e tipo de
  piscina.
- Revezamentos não entram em recordes individuais.
- Provas de mar/rios/lagos não são comparadas automaticamente por tempo:
  condições do percurso mudam. Comparações por `routeKey` são **descritivas**.
- Nunca agrupar 50m e 100m no mesmo gráfico de melhores tempos.
- Sem tempo, sem posição, percurso desconhecido e estilo não aplicável ficam
  `NULL`, não `0` ou `''`.

## Regras pendentes para SQL baseline

Prisma valida tipos, FKs e índices, mas não descreve CHECKs nativos.
Adicionar e testar na primeira migration SQL, antes de Neon:

- `distance_meters > 0`, `duration_ms IS NULL OR duration_ms > 0`,
  `position IS NULL OR position > 0`, `pool_length_meters IS NULL OR
  pool_length_meters > 0`.
- Se status = CLASSIFIED, duração positiva é exigida.
- Se status != CLASSIFIED, posição deve ser NULL.
- Conferir semântica de revezamento, incluindo equipes, na etapa própria
  antes de publicar resultados por atleta.
- Revisar política de exclusão de `Student` / `Event` e proteção por professor.
- Definir unicidade e integridade para `routeKey` se a modalidade evoluir
  para uma entidade de percurso.

## Próximo PR (02B-2)

Atualizar contratos HTTP, presenters, PrismaResultsRepository, casos de uso,
ranking, recordes, estatísticas e gráficos. Unificar consultas públicas sem
fundir resultados físicos. Remover `Result` e sua persistência em texto
antes de criar o banco Neon. Validar com testes de integração PostgreSQL.
