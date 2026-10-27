# Swim Flow — Etapa 02F-05C6 | Projeções relacionais paginadas (API)

## Motivação

Auditoria cruzada de `swim-flow-dash` e `swim-flow-api` após merge do PR #30:
- `/api/students?page=...` já devolve `responsible` e `parentId`, mas a tela de Alunos ainda chama `useParents()` integralmente porque faltava o telefone do responsável principal.
- `/api/teachers?page=...` devolve `studentsCount`, mas a lista de Professores carrega **todas as turmas** somente para exibir nome da turma e papel de `head_coach` / `assistant_coach`.
- O navbar usa `useStudents()` integralmente para aniversários. Esse caso precisa de endpoint resumido, separado para manter cálculo de datas, ano bissexto e escopo do professor sem regressões.

## Contratos novos (aditivos)

- `GET /api/students`: acrescenta `guardianPhone?: string` (telefone da relação `studentGuardians` **isPrimary**, ou ausente quando não houver responsável principal). Mantidos `phone`, `responsible`, `parentId` e todos os campos antigos. Seleção Prisma acrescenta só `parent.phone` à relação já carregada.
- `GET /api/teachers`: acrescenta `assignedClasses: {classId,name,role}[]` com `role` igual a `head_coach` ou `assistant_coach`. Vem do vínculo `classTeachers.swimmingClass.name`, **sem carregar alunos, schedules ou lista completa de turmas**. `studentsCount` existente permanece.
- Os mesmos presenters são usados nos retornos de criação/atualização, mantendo formato consistente.

## Integridade/cache/segurança

- Nenhuma migration, seed, SQL, mudança de permissões ou endpoint público.
- `GET /api/students` preserva filtro de escopo de professor já existente; `/api/teachers` continua restrito a `admin`.
- O cache de `teachers:list:` passa a ser invalidado sempre que as turmas mudam, inclusive nome, papel de professor e vínculo, evitando mostrar dados relacionais antigos após edições.
- O cache de `students:list:` já é invalidado quando responsáveis mudam; portanto, alterações no telefone principal não devem deixar listagens stale durante o TTL.
- Os relacionamentos são **somente leitura**: nenhum DTO de escrita ou semântica de vínculo muda.

## Migração planejada do dash (não neste PR)

1. Consumir `guardianPhone` ao lado de `responsible` na lista paginada de Alunos, preservando fallback de contato quando não existe responsável.
2. Consumir `assignedClasses` em Professores para exibir turma e função, sem `useClasses()` integral.
3. Testar manualmente os papéis de turmas, múltiplos vínculos, telefones e alunos com responsáveis secundários.
4. Etapa 02F-05C7: endpoint protegido de aniversários futuros **com projeção mínima**, para retirar leitura integral do Navbar com o escopo de professor correto.

## Validação

- TypeScript/Prisma/Nest build, testes unitários e e2e do workflow.
- `PrismaStudentMapper` testa telefone apenas do principal; `PrismaTeacherMapper` testa função, nome e lista vazia; presenters testam compatibilidade do contrato.
- Smoke após merge: comparar uma página de Alunos e Professores com o banco Neon/Render em ambiente permitido, sem exportar ou expor dados pessoais.

**Atenção:** o ganho de redução de requisições no front virá quando o dashboard adotar estes campos; esta entrega prepara o contrato seguro.
