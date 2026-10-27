# Swim Flow — 02F-05C11 | Leituras individuais

## Contexto
As páginas de detalhes do dashboard usam `/students/:id`, `/teachers/:id` e `/classes/:id`. A API de produção anterior expunha somente listagens paginadas, provocando download de todos os registros para localizar um UUID.

## Contrato aditivo
- `GET /api/students/:id`: JWT, role admin/teacher, `students:read`, UUID válido; projeção idêntica à listagem, incluindo `classIds` das matrículas atuais. O filtro do professor é aplicado pelo Prisma, com vínculo em turma e professor ativo.
- `GET /api/classes/:id`: JWT, role admin/teacher, `classes:read`, UUID válido; vínculo de professor ativo validado no Prisma.
- `GET /api/teachers/:id`: somente admin e `teachers:read`. Projeção de professor com `assignedClasses` e `studentsCount`.
- Ausente ou fora de escopo retorna 404; UUID inválido retorna 400. Sem varredura de tabelas no Nest ou cache de perfil do professor.
- Preserva todos os endpoints de listagem e escrita.

## Ordem de rollout
1. Validar Jest unit/e2e, formato, lint, build e gate PostgreSQL.
2. Integrar e publicar a API no Render.
3. Validar os três GETs como admin; validar como teacher atribuído/não atribuído (403 para teachers; 404 para aluno/turma não vinculados) e sem sessão (401).
4. Só depois fazer merge/deploy da PR do dashboard dependente, evitando 404 enquanto a API antiga ainda estiver no Render.

Nenhuma migration Prisma nem escrita de dados reais é necessária.
