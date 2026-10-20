# Swim Flow — 02C-4 / Escopo de professores por turma e aluno

## Modelo de confiança
A identidade autenticada é `request.user.id` (UUID de `Profile`).
A função `teacher` sozinha **não** autoriza acessar qualquer turma/aluno.
O banco valida a relação:
`Profile.id → Teacher.profileId (status Ativo) → ClassTeacher → SwimmingClass → StudentClass (toDate IS NULL) → Student`.

Não atribuir `Teacher.profileId` por correspondência de nome ou email.
A vinculação deverá ser efetuada por um fluxo administrativo autenticado
específico, após verificação da identidade do professor.

## Políticas implementadas

| Recurso | Administrador | Professor |
|---|---|---|
| GET alunos | Todos | Somente alunos com matrícula ativa em suas turmas |
| GET turmas | Todas | Somente turmas explicitamente atribuídas |
| GET alunos/reference-data | Permitido | Permitido (somente categorias e níveis) |
| CREATE/UPDATE/DELETE alunos e turmas | Permitido | **Negado** nesta etapa |
| Frequência GET (lista/resumo) | Todas | Requer `classId` atribuído; dados apenas de matrículas ativas |
| Frequência POST | Permitido | Confere todas as turmas e pares aluno/turma; falha tudo se houver um par inválido |
| Responsáveis, professores, resultados, treinos, eventos, piscinas | Permitido | **Negado** até haver escopo específico |
| Ex-alunos | Permitido | Negado (já protegido no PR #7) |

**Escopo da role**: a lista de permissões de `teacher` contém somente
`students:read`, `classes:read`, `attendance:read` e `attendance:write`.
O `PermissionsGuard` limita qualquer claim de permissões às regras do servidor.

### Defesa em profundidade

- Listas usam `WHERE` com relacionamentos Prisma, **antes** de `skip/take`
  e `COUNT`. Não filtrar resultados depois da paginação.
- Chaves de cache incluem `teacherProfileId`, evitando mistura entre
  visões de professores e administradores.
- O guard da frequência checa a relação real no banco antes de executar o
  caso de uso; consultas de frequência aplicam novamente filtros no Prisma.
- Uma associação sem `Teacher.profileId` retorna listas vazias, e não acesso
  global. Em frequência, é negada.
- Alunos transferidos (`StudentClass.toDate != NULL`) perdem acesso na
  visão do professor antigo, mesmo que exista um vínculo histórico.
- Professores não podem atribuir a si próprios turmas, nem alterar vínculo
  professor–turma por um endpoint de administrador.
- Testes E2E antigos possuem autenticação simulada; testes novos validam
  explicitamente o guard e os filtros dos repositórios, incluindo negativas.

## Pendências antes de dados reais

1. Criar endpoint administrativo explícito de vinculação/verificação
   `Teacher.profileId` e testes de autorização.
2. Criar escopos para operações de edição de aluno, atribuição de turma,
   responsáveis, resultados, treinos e relatórios, antes de permitir
   `teacher:*:write` nesses módulos.
3. **Auditar `/api/public/results`**: atualmente é uma rota pública de
   resultados que inclui nome/identificador de aluno. Exigir política de
   divulgação/consentimento antes de usar com dados de menores.
4. Restringir URLs de upload e objetos do storage ao proprietário/escopo
   autorizado; este PR não redesenha uploads.
5. Adicionar testes de integração PostgreSQL de filtragem, concorrência
   e revogação de vínculos (sem banco Neon criado).
6. Considerar RLS PostgreSQL como segunda camada para endpoints com dados
   pessoais, sem substituir autorização por registro no NestJS.
7. Revogar caches relacionados a turmas, professores e matrículas após
   alterações que mudem o escopo: a TTL atual pode manter visão antiga
   temporariamente. Enquanto a revogação não estiver completa, o endpoint
   sensível pode precisar evitar cache para garantir revogação imediata.

Nenhum SQL foi aplicado, e nenhum dado legado foi excluído neste PR.
