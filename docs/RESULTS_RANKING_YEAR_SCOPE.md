# Ranking histórico — ano da prova e integridade das categorias

## Contrato da consulta

`GET /api/results/ranking` aceita o parâmetro **opcional** `year` (inteiro de 1900 a 2100). Quando informado, os candidatos são filtrados pelo **ano civil de `PoolResult.heldOn`**, no intervalo UTC inclusivo em 1º de janeiro e exclusivo em 1º de janeiro do ano seguinte.

- Ausência de `year`: comportamento histórico atual, incluindo todos os anos.
- `year=2026`: somente resultados de 2026, antes da seleção da melhor marca de cada atleta, cálculo de empates e paginação.
- `gender` e demais critérios esportivos continuam combináveis; categoria usa `PoolResult.categorySnapshot`, não a categoria atual do cadastro.
- Valores inválidos, fracionários ou fora dos limites são rejeitados pelo contrato HTTP. Sem alterações no banco ou nos resultados.

## Diferença importante: ano civil NÃO é temporada

A tabela `Season` possui datas `startsOn` / `endsOn` e pode representar períodos que não coincidem com o calendário. `PoolResult.seasonId` é opcional, e o CRUD de resultados ainda não vincula a temporada ao registro.

**Não** anunciar o filtro `year` como uma temporada esportiva oficial. Não inferir `seasonId` pelo ano da prova, não reclassificar `categorySnapshot` e não migrar ou preencher dados anteriores automaticamente.

## Próximas entregas, separadas

1. Definir CRUD/consulta autorizada das temporadas e critérios para vínculo explícito de resultados, inclusive edições e provas entre dois anos.
2. Associar resultados a `Season` com validações de data, autoria e integridade histórica, preservando registros sem vínculo.
3. Implementar consulta por `seasonId` somente quando houver temporadas e vínculos confiáveis; manter `year` com rótulo **Ano da prova**.
4. No Dashboard, oferecer filtro por ano sem chamá-lo de temporada oficial. Revisar categorias históricas antes de criar um filtro de temporada regulamentar.
