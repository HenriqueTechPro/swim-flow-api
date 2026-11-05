# Swim Flow — consulta segura do histórico de categorias por temporada

## Contrato

`GET /api/students/:id/season-categories`

Exige JWT, papel **admin** e permissão `students:read`. O `:id`
deve ser um UUID válido de um estudante existente.

Resposta `{ "data": [...] }` com somente associações efetivamente
gravadas em `student_season_categories`, ordenadas por ano da
temporada decrescente e data de associação decrescente:

- `seasonId`, `year`, `seasonLabel`, `seasonStatus`;
- `startsOn`, `endsOn` (datas civis `YYYY-MM-DD`);
- `categoryId`, `category` (rótulo esportivo);
- `assignedAt` (instante UTC em ISO 8601).

Sem associações: `data: []`. Aluno inexistente: `404`.
A resposta não inclui contatos, nascimento, endereço, responsável nem
resultados pessoais. A rota é exclusiva de administração; professores
não podem acessar o histórico via esta operação.

## Integridade e limites

A consulta não insere ou altera temporadas, categorias, alunos ou resultados.
O campo `Student.categoryId` continua representando a categoria cadastral
corrente e não deve ser inferido como histórico esportivo. A associação por
`studentId + seasonId` representa a categoria registrada naquela temporada.

Não é correto gerar categorias anteriores a partir do nascimento, extrapolar
o período pelo ano civil ou preencher registros históricos automaticamente.

## Sequência planejada

1. Revisar o histórico registrado no Dashboard por atleta (somente leitura).
2. Definir explicitamente a política para correções de categoria de uma
   temporada que já possui provas, incluindo proteção de resultados.
3. Planejar um processo **pré-visualizável e auditável** de virada de
   temporada; nenhuma atualização em lote ocorre nesta entrega.
