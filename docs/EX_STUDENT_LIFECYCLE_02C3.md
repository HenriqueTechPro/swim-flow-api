# Etapa 02C-3 — histórico de desligamentos sem exclusão destrutiva

## Propósito
Cada período de desligamento é um registro histórico imutável após seu
encerramento. O aluno continua existindo na tabela `Student`, com histórico
de resultados, avaliações, turmas e categorias preservado.

## Ciclo de vida
- `ExStudent` com ambos `reactivatedAt` e `voidedAt` nulos é um
  **desligamento vigente**; `Student.status = Inativo`.
- **Reativação** informa `reactivatedAt` e devolve o aluno a Ativo,
  preservando o histórico. Não deleta o desligamento.
- **DELETE /api/ex-students/:id** agora significa **anular registro feito por
  engano**; informa `voidedAt`, devolve o aluno a Ativo, não executa
  exclusão física. Histórico anulado permanece auditável.
- Após retorno, outro desligamento do mesmo aluno cria **outro registro**.
- A atualização só pode modificar o desligamento **vigente**, não históricos
  concluídos.
- Todas as mudanças de status e de desligamento são transacionais. O
  `updateMany` condicional em Student impede arquivar ou reativar duas
  vezes o mesmo estado lógico. O índice único parcial PostgreSQL
  `ex_students_one_current_departure_idx` completa a proteção à concorrência.

## Dados legados eliminados
- `categorySnapshot`, `levelSnapshot` e `responsibleSnapshot`
  duplicavam `category`, `level` e `responsible` dentro de ExStudent.
  Esses campos restantes continuam sendo **retratos históricos legítimos**.
- `birthYear` foi removido do banco; é derivado de `birthDate`, ou
  `null` quando desconhecido.
- `ExStudent.studentId` tornou-se obrigatório; o vínculo impede remover
  fisicamente um aluno cujo histórico de desligamento existe. Exclusão do
  cadastro requer política de privacidade/retenção apropriada.
- A exclusão de Parent faz `parentId = NULL`, mas não apaga a
  string `responsible` registrada historicamente.

## Contratos
- A rota `GET /api/ex-students` retorna somente desligamentos vigentes.
- Para acessar registros anteriores, um administrador usa:
  `GET /api/ex-students?includeHistory=true&studentId=<uuid>`.
  Sem `studentId`, o parâmetro mostra histórico geral (paginado).
- As respostas incluem `reactivatedAt` e `voidedAt`, com valor nulo
  quando o evento não ocorreu.
- O módulo de desligamentos foi limitado a **admin** até implementar
  autorização de professor por turma/aluno. Isso evita a consulta global
  de desligamentos de crianças por qualquer professor.
- Outras rotas de aluno, pais, resultados e frequência **ainda requerem
  autorização por registro**. Esta PR não declara essas rotas seguras.

## Bloqueios pré-Neon
1. Incorporar `prisma/sql/pre_neon/02c3_departure_history.sql` ao SQL
   versionado inicial. Não confiar em `prisma db push` para índices parciais.
2. Testar as transações e índices em PostgreSQL descartável, incluindo
   corrida de duas requisições de arquivamento/reativação.
3. Testar o dashboard contra os novos campos e semântica de DELETE.
4. Decidir política formal de retenção/anonimização e direito de exclusão.
5. Criar políticas de autorização `teacher -> class -> student` nas
   consultas e mutações restantes, por padrão negando vínculo ausente.

Nenhum dado existente foi modificado, não houve deploy nem migration aplicada.
