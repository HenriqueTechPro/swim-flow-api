# Swim Flow — Etapa 02B / resultados de piscina × águas abertas

## Implementação da Etapa 02B-2 — antes do Neon

A partir do PR #4, o `PrismaResultsRepository` acessa somente as tabelas
`pool_results` e `open_water_results`. A tabela `Result` legada foi
removida de `schema.prisma`, junto ao mapper legado e ao seed antigo.

**Ainda não geramos nem executamos migration SQL, tampouco criamos o banco
Neon.** O projeto em execução com banco legado é incompatível com esse schema
até concluir a nova baseline. Fazer merge de código não migra o banco.

### Compatibilidade de saída

As rotas antigas `/api/results` e `/api/public/results` foram mantidas
temporariamente. O repositório converte o armazenamento normalizado para os
rótulos antigos no presenter, e devolve `durationMs` e `poolLengthMeters`
para consumidores novos. `timeInSeconds=0`, `time=""` e `position=0`
ainda são representações **legadas** para duração/posição não informadas;
os valores físicos verdadeiros permanecem `NULL`. Migrar os contratos de
apresentação para `null` diretamente antes de uso real é recomendado.

O frontend antigo aceita as categorias de `courseType` 25m/50m; piscina
de 20m usa a propriedade numérica `poolLengthMeters`. Consultas de ranking
e evolução têm esse filtro opcional. Quando não há contexto suficiente, a API
não inventa equivalência de resultados: retorna conjunto vazio para evolução
comparativa, e o ranking de águas abertas não é calculado.

`personalBest` e `improvement` enviados pelo navegador não são gravados.
Resumo deriva PBs de piscina individuais comparáveis, apenas para registros
incluídos no filtro. Flags por resultado ainda retornam valores neutros por
compatibilidade; só substituir quando houver política de cálculo por atleta
na camada de apresentação.

### Pendências antes de produção

- Validar CRUD/estatísticas e os filtros com um PostgreSQL temporário, usando
  migration SQL definitiva versionada com `CHECK` para duração, status e
  valores positivos.
- Confirmar o consumo das respostas do dashboard Vercel, incluindo `null`.
- Melhorar paginação combinada para volumes elevados: a consulta de página N
  atualmente carrega até `N × perPage` registros de cada tabela e ordena em
  memória, embora seja limitada por página e não carregue o dataset completo.
- Não expor informações pessoais de menores sem uma revisão específica de
  autorização, finalidade e privacidade dos endpoints públicos.
- Definir resultados de revezamento por equipe/membros, com tempos individuais
  somente quando houver parcial homologada.
- Confirmar se os resultados esportivos impedem exclusão física de alunos
  ou se serão abrangidos por uma política formal de retenção.
- Revisar as denominações de status e categorias com o frontend antes de
  substituir o contrato HTTP.
- Revisar cenários de busca e recordes para percursos personalizados e
  garantir que resultados de águas abertas não sejam comparados por tempo
  como se tivessem condições idênticas.

---
## Situação

Etapa 02B-1 introduziu modelos separados e uma política de comparação.
Na Etapa 02B-2, o repositório Prisma, os seeds e os contratos de entrada
passaram a usar somente `PoolResult` e `OpenWaterResult`. O antigo modelo
`Result` foi removido antes da primeira migration Neon.

**ATENÇÃO:** o schema atual ainda não deve ser implantado sobre o banco legado.
Não há SQL inicial gerado/aplicado e não há escrita dupla. O próximo trabalho
é revisar as restrições nativas do PostgreSQL e os contratos do dashboard.

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

## Próximas validações

Concluir a padronização dos contratos frontend, preparar a baseline SQL
com restrições `CHECK`, índices parciais e executar testes completos contra
um PostgreSQL descartável. Só depois configurar Neon e Render.
