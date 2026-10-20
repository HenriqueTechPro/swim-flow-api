# Etapa 02C-2 — relações de responsáveis, identidade e limpeza de dados

## Escopo concluído no schema (pré-Neon)

- Substituir `Student.parentId` por `StudentGuardian` com FK para aluno e
  `Parent`, unicidade `[studentId,parentId]`, atributo `isPrimary`,
  relação familiar tipada e `canReceiveUpdates=false` por padrão.
- O índice parcial SQL `student_guardians_one_primary_idx` permite vários
  responsáveis secundários, mas **no máximo um responsável principal**.
- O endpoint de alunos mantém `parentId` e `responsible` como *projeções
  do vínculo principal*, não como colunas duplicadas.
- Edição de um aluno troca o responsável principal de forma transacional,
  sem excluir relações secundárias. `null` remove a indicação de principal;
  não apaga automaticamente outras relações.
- A edição do responsável sincroniza **somente os vínculos daquele adulto**.
  Relacionar um novo adulto a uma criança que já tem principal cria vínculo
  secundário; não rouba o papel principal. IDs de crianças inexistentes
  invalidam a transação inteira.
- `Teacher.profileId` opcional e único referencia a conta autenticada. O
  banco **não** faz associação automática por endereço de e-mail. É preciso
  fluxo futuro de ADMIN autenticado e autorização professor–turma/aluno.
- Eliminados os campos redundantes `Student.categoryLabel`,
  `Student.levelLabel` e `Student.lastCompetition`. O domínio usa as
  FKs `categoryId` e `levelId` como fontes de verdade.

## Privacidade e regras de acesso

`StudentGuardian.canReceiveUpdates` começa como **false** e indica apenas
uma futura preferência/autorização explícita de comunicação. **Não** concede
acesso ao portal do aluno. Esse controle dependerá de autenticação, validação
do vínculo e autorização específica.

O relacionamento de parentesco `GuardianRelationship` não comprova guarda
legal. A aplicação não deve inferir autoridade de pai/mãe ou autorizar acesso
por e-mail, nome ou informação fornecida no cadastro sem verificação.

`Teacher.profileId` fornece rastreabilidade da identidade, não muda RBAC
por si só. Um professor deve conseguir acessar apenas turmas e alunos
atribuídos a ele após implementar políticas explícitas de autorização.

## Compatibilidade temporária

A resposta HTTP ainda expõe `parentId` como identificador do principal para
atender o frontend existente. O formulário atual de responsáveis passa
`childrenIds` sem papel familiar detalhado; novos vínculos são registrados
como `OTHER` e só podem receber comunicações depois de consentimento
adequado. Interface de múltiplos responsáveis detalhados é trabalho futuro.

O modelo histórico `ExStudent` mantém `parentId` e retrato do responsável
**no momento do desligamento**. Não é uma relação atual da criança.
Um PR posterior poderá consolidar o esquema legado de desligamentos,
sem eliminar os fatos históricos.

## Antes de criar Neon

1. Incorporar `prisma/sql/pre_neon/02c2_guardians_identity.sql` na primeira
   migração SQL versionada e verificar os índices em PostgreSQL temporário.
2. Executar testes de concorrência para trocas de principal. O índice parcial
   protege a invariante mesmo diante de duas requisições simultâneas.
3. Criar política de autorização por professor/aluno e um endpoint ADMIN
   autenticado para associar `Teacher.profileId`.
4. Revisar todas as respostas públicas (alunos são menores) e as permissões
   de consulta dos responsáveis.
5. Confirmar tipagem/contratos do dashboard e fluxos de múltiplos responsáveis.
6. Não usar `prisma db push` como substituto para a baseline com SQL manual.

Este PR **não cria banco**, **não aplica migrações** e **não deleta dados do
Supabase**. Não foi feita migração de registros legados, pois a estratégia é
iniciar o banco Neon vazio.
