# Temporadas — consulta autorizada para cadastro de resultados

## Rota

`GET /api/results/seasons?page=1&perPage=25`

A consulta é **somente leitura**, protegida pelos mesmos guardas de
autenticação que os resultados: JWT, papel `admin` e permissão
`results:read`. Não é uma rota pública e não expõe dados de alunos.

Parâmetros:
- `page`: inteiro positivo, padrão 1.
- `perPage`: inteiro de 1 a 100, padrão 25.
- Requisições com números inválidos retornam HTTP 400.

Resposta:
```json
{
  "data": [
    {
      "id": "88888888-8888-4888-8888-888888888888",
      "year": 2026,
      "label": "Temporada 2025/2026",
      "startsOn": "2025-09-01",
      "endsOn": "2026-08-31",
      "status": "ACTIVE"
    }
  ],
  "meta": { "page": 1, "perPage": 25, "total": 1 }
}
```

Ordenação: `year DESC, id ASC`. Datas são datas ISO civis da tabela
`Season`, sem conversão por fuso horário no Dashboard. A consulta usa
`select` restrito aos seis campos exibidos e `count` para paginação,
sem carregar resultados, vínculos de alunos ou outras relações.

Quando não há temporadas cadastradas, responde `data: []` e
`meta.total: 0`; não cria uma temporada falsa usando o ano atual.

## Compatibilidade e integridade

Não altera `Season`, `StudentSeasonCategory`, `PoolResult` ou
`OpenWaterResult`. Nenhuma migração, criação, reclassificação, backfill
ou associação automática de `seasonId` é executada.

Esta etapa **não** implementa CRUD de temporadas. O Dashboard só deve
oferecer temporadas realmente retornadas pela API e deve lidar com
a lista vazia. A criação e manutenção de temporadas e os filtros
esportivos por vínculo explícito serão etapas independentes.
