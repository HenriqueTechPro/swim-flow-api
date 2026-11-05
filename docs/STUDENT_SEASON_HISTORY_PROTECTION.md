# Swim Flow — integridade da categoria histórica no cadastro do atleta

A edição do cadastro calcula a categoria associada à temporada **ACTIVE**.
O histórico em `StudentSeasonCategory` é distinto da categoria atual
(`Student.categoryId`) e do retrato da categoria de cada resultado
(`PoolResult.categorySnapshot` / `OpenWaterResult.categorySnapshot`).

## Proteção adicionada

Quando uma edição propõe **alterar** o `categoryId` de uma associação já
existente em `StudentSeasonCategory`, o repositório consulta, dentro da
transação, os resultados do atleta que apontam à temporada de forma direta
(`result.seasonId`) ou por evento (`result.event.seasonId`).

- Se houver resultado vinculado, a atualização é rejeitada com **409**,
  antes de escrever o cadastro, vínculos familiares ou a categoria.
- Se a categoria é a mesma, o cadastro continua editável.
- Se não houver resultado vinculado, permite-se corrigir a categoria da
  temporada ativa pelas regras já existentes do cadastro.
- Sem temporada ativa, não se inventa associação com temporadas antigas.
- Nenhum registro de resultado é recalculado ou reclassificado.

## Limites e próximos passos

Esta é uma proteção da operação de edição do aluno, **não** uma garantia
de imutabilidade global diante de escritas concorrentes. Resultados sem
`seasonId` e sem evento vinculado à temporada não estão cobertos por esse
bloqueio. As regras de concorrência exigem transação/locking revisados em
uma futura etapa independente.

A virada de temporada com atualização em lote continua **desabilitada**:
antes de implementá-la é necessário um preview explícito de categorias,
auditoria das exceções por regulamento esportivo, confirmação administrativa
e rollback testável. Nenhum backfill é autorizado por esta PR.
