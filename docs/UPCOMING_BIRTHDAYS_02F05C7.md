# Swim Flow — 02F-05C7 | Aniversários próximos sem catálogo integral

## Diagnóstico

O Navbar do dashboard mantém `useStudents()` ativo em todas as rotas apenas para identificar aniversários. Como este hook carrega todas as páginas da listagem, o custo aumenta com o número de alunos. A tela de Resultados já não depende da lista para renderizar (02F-05C5), mas o cabeçalho segue consultando-a por notificações.

## API adicionada

`GET /api/students/upcoming-birthdays` — requer token, `students:read` e papel `admin` ou `teacher`.

Resposta: `{ "data": [{ "id": "<uuid>", "name": "Aluno", "birthDate": "2015-10-27" }] }`.

- Retorna somente `id`, `name`, `birthDate`; **nunca** contato, CPF, responsável, turma, nível ou outros dados.
- Somente alunos `Ativo` com data de nascimento.
- SQL parametrizado retorna somente pessoas cujo **mês/dia** ocorre entre **ontem e cinco dias à frente (UTC)**. O navegador continua responsável por selecionar a janela local de aniversários entre hoje e três dias à frente.
- Inclui 29/02 como possibilidade em 01/03 de anos não bissextos, para preservar a regra atual do JavaScript usada pelo dashboard. Janela cruza 31/12 e 01/01 sem consultas em todas as páginas.
- Para usuários `teacher`, a consulta exige vínculo a uma turma **atualmente ativa para o aluno** (`student_classes.to_date IS NULL`), ligada a um professor **ativo** cujo `profile_id` corresponde ao perfil autenticado. Não é possível indicar outro professor por query string.
- Somente leitura; consulta não adiciona caches próprios para evitar resultados desatualizados após mudança de papel ou turma.

## Segurança e integridade

- Guardas JWT, papel e permissão herdados do StudentsController.
- Não altera contratos de escrita, tabelas, migrações Prisma, dados ou scripts de deploy.
- Filtragem ocorre **no PostgreSQL** com placeholders de Prisma SQL, não por download da coleção completa ao processo Node.
- A expressão `to_char(birth_date, 'MM-DD')` utiliza a coluna existente sem índice funcional dedicado. Avaliar índice em migração revisada apenas caso métricas reais demonstrem necessidade.

## Testes

- Use case: janela UTC, virada do ano, bissexto, alunos inativos e passagem do escopo.
- Repositório: campos mínimos, SQL parametrizado, filtro ativo e restrição da turma para professor.
- E2E: retorno do endpoint com formato mínimo; CI Prisma/build/Jest + PostgreSQL descartável.

## Integração futura do dashboard (02F-05C8)

- Implementar `useUpcomingBirthdays` com React Query, Cache curto ou refresh em mudança de dia local.
- Substituir apenas `useStudents()` no `useNotifications`, mantendo eventos/treinos e estados lidos/dispensados.
- Fazer rollout depois da API estar implantada no Render. Nenhuma consulta total deve ser removida antes de validar que a nova rota está acessível e protege a visibilidade de professores.
