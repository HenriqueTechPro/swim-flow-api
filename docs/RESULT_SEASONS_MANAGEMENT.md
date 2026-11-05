# Administração de temporadas oficiais

A API expõe uma referência de temporada (`Season`) com ano único, nome,
intervalo de datas e status. A temporada não é uma classificação automática:
um resultado só pode pertencer a ela quando possuir um `seasonId` explícito.

## Rotas

Todas exigem autenticação, papel `admin` e a permissão indicada:

| Operação | Rota | Permissão |
| --- | --- | --- |
| Listar (paginado) | `GET /api/results/seasons` | `results:read` |
| Criar | `POST /api/results/seasons` | `results:write` |
| Editar | `PUT /api/results/seasons/:id` | `results:write` |

O payload de criação/edição contém `year` (inteiro 1900–2100),
`label` (3–120 caracteres), `startsOn`, `endsOn` (datas civis ISO
`YYYY-MM-DD`) e `status` (`PLANNED`, `ACTIVE`, `CLOSED`).
O status é opcional na criação, com padrão `PLANNED`; na edição é obrigatório.

Exemplo:

```json
{
  "year": 2026,
  "label": "Temporada 2025/2026",
  "startsOn": "2025-09-01",
  "endsOn": "2026-08-31",
  "status": "PLANNED"
}
```

A resposta da escrita é `{ "data": { ... } }`, com `id` e os
campos originais. Nenhuma edição altera automaticamente os resultados.

## Regras de integridade

- `year` é único por constraint já existente no PostgreSQL; um segundo
  cadastro com o mesmo ano é rejeitado (`409`).
- `startsOn` e `endsOn` devem ser datas válidas, e o início não
  pode ser posterior ao fim (erro de validação `400`).
- A regra de aplicação rejeita períodos sobrepostos, com limites inclusivos,
  inclusive quando uma temporada atravessa dois anos civis (`409`).
- Quando uma temporada possui qualquer aluno/categoria, evento, resultado
  de piscina ou resultado de águas abertas vinculado, o seu **ano de
  referência e suas datas não podem ser modificados** (`409`).
  O nome e o status continuam editáveis.
- Temporada inexistente: `404`. Não há rota para exclusão nesta etapa.
- Alterar `status` não altera o status dos resultados, a categoria
  histórica, suas posições nem o período de realização da prova.

A verificação de sobreposição ocorre na aplicação, com unicidade do
ano garantida pelo banco. Em um cenário futuro com vários administradores
criando períodos simultaneamente, considerar constraint PostgreSQL de
exclusão/locking transacional para assegurar também não sobreposição
sob concorrência. Isso exigiria uma migração analisada separadamente.

## Próxima etapa

Criar no Dashboard uma interface de gestão de temporadas apenas para
administradores, com validação de datas, edição conservadora e estados de
erro/carregamento. Não preencher vínculos históricos automaticamente.
