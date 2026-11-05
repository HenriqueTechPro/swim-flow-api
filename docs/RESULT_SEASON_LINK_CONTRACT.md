# Vínculo explícito de resultados às temporadas

## Objetivo

Permitir que resultados de piscina e águas abertas sejam vinculados a uma
temporada esportiva **já cadastrada**, sem deduzir `seasonId` pelo ano
civil, alterar resultados legados ou reclassificar categorias históricas.

## Contrato de escrita

`POST /api/results` e `PUT /api/results/:id` aceitam `seasonId`
opcional (UUID válido ou `null`).

- **Criação sem `seasonId`**: registro permanece sem temporada.
- **Criação com `seasonId`**: a temporada deve existir e a data da prova
  deve pertencer ao intervalo `[startsOn, endsOn]`, inclusivo.
- **Edição sem `seasonId`**: mantém o vínculo anterior; se a data mudar,
  ela ainda precisa pertencer ao intervalo da temporada vinculada.
- **Edição com UUID**: troca de temporada de forma explícita; a data precisa
  ser compatível com o novo intervalo.
- **Edição com `seasonId: null`**: desvincula explicitamente, sem apagar
  o resultado ou seu `categorySnapshot`.

A validação ocorre antes de persistir; vínculo inexistente ou data fora
do intervalo gera erro 422. Status PLANNED/ACTIVE/CLOSED não altera a
possibilidade de registrar provas históricas: o critério do vínculo é o
intervalo de datas, não o estado atual da temporada.

## Garantias

A categoria do resultado continua sendo o snapshot informado em
`categorySnapshot`. Não há reclassificação automática com base na idade
atual, em `Student.categoryId`, ou em `StudentSeasonCategory`.
O vínculo não modifica as colocações oficiais, melhores marcas, empates ou
rankings anteriores. O esquema Prisma já contém `seasonId` opcional para
`PoolResult` e `OpenWaterResult`; nenhuma migration é necessária.

A resposta HTTP de resultados inclui `seasonId` para permitir que
consumidores identifiquem a temporada efetivamente armazenada.

## Pendências de próximas PRs

1. Implementar gestão e listagem autorizada de temporadas existentes.
2. Disponibilizar seletor de temporada no Dashboard, sem enviar ou sobrescrever
   o vínculo de forma implícita ao editar um resultado.
3. Auditar a regra de categoria histórica por regulamento e modalidade,
   incluindo temporadas que atravessam anos civis.
4. Implementar ranking filtrado por `seasonId` somente após confirmar que
   os dados relacionados são completos e confiáveis.

**Não** executar backfill automático, alterações de data ou migrações de
resultados antigos para associá-los a temporadas por suposição.
