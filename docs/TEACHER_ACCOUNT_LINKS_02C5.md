# Swim Flow — 02C-5 / Vinculação administrativa de contas dos professores

## Objetivo

A role `teacher` não comprova por si só que uma conta pertence a um professor
cadastrado. A autorização de 02C-4 depende da associação oficial
`Profile.id -> Teacher.profileId` junto com `ClassTeacher` e
`StudentClass`. A associação só pode ser atribuída por administrador.

## Endpoints (Bearer JWT + @Roles('admin') + permissões)

- `GET /api/teachers/:teacherId/account` com `teachers:read`
- `PUT /api/teachers/:teacherId/account` com `teachers:write`, JSON
  `{ "profileId": "<uuid de um Profile com role teacher>" }`
- `DELETE /api/teachers/:teacherId/account` com `teachers:write`

As respostas contêm somente `{teacherId, profileId}`. Não fornecem
dados de login, sessão, documentos pessoais ou detalhes de autorização.

## Garantias

1. O administrador é revalidado no PostgreSQL dentro da transação, além
   dos guards HTTP; jamais confiar em role enviada no payload.
2. A conta escolhida precisa existir e ter role `teacher`.
3. O professor escolhido precisa existir e estar `Ativo` para vincular.
4. `Teacher.profileId @unique` impede que a mesma conta seja usada por
   dois professores. Outro `Profile` não pode substituir um vínculo sem
   desvinculação explícita.
5. `updateMany` faz *compare-and-set* do valor atual, impedindo
   substituição silenciosa por ações concorrentes; os conflitos `P2002`
   e `P2034` são tratados como `409`.
6. Vinculação e desvinculação inserem evento em
   `TeacherAccountLinkEvent` **na mesma transação**. Inclui professor,
   conta, administrador autor da alteração, tipo e timestamp.
7. Repetir exatamente a vinculação ou desvinculação já realizada é
   idempotente e não cria eventos duplicados.
8. Os eventos guardam UUIDs históricos sem FKs, para sobreviver à exclusão
   dos perfis/cadastros. A política de retenção e acesso aos eventos será
   definida antes de dados reais.

O sistema **não** tenta reconhecer a identidade por nome, e-mail ou CPF.
A checagem documental/organizacional é uma obrigação do administrador antes
de escolher a conta. É possível associar conta convidada ainda não utilizada
desde que exista o `Profile` com role teacher.

## Operação planejada

1. Criar o cadastro do professor e convidar a conta via fluxo de autenticação.
2. Confirmar manualmente a identidade do profissional.
3. Verificar que o perfil possui a role teacher.
4. Usar o endpoint de vinculação com os dois UUIDs explícitos.
5. Atribuir turmas via `ClassTeacher`, também como admin.
6. Ao encerrar o vínculo laboral, desvincular a conta e retirar atribuições.

## Limites / bloqueios da produção

- O Neon e as migrations ainda não foram criados. Inserir o enum e tabela
  de auditoria na **primeira migração versionada**, testada em PostgreSQL.
- A API não fornece ainda uma interface gráfica de associação no dashboard.
- Antes de abrir acesso de professores, testar PostgreSQL real e revogação
  imediata ao desvincular `Teacher.profileId`.
- Mudanças de role de `Profile` não criam, por si mesmas, um novo vínculo;
  autenticação/guard de 02C-4 consulta a role atual. Revisar o fluxo de
  suspensão/desligamento e o histórico administrativo antes de produção.
- **Privacidade de menores:** `/api/public/results` permanece aberto e
  expõe nomes/identificadores de atletas. Rever a publicação (consentimento
  explícito ou divulgação pública desativada) em um PR próprio antes de
  colocar dados reais.
- Guardar histórico de eventos não significa conceder acesso a eles ao
  professor; qualquer rota futura de auditoria deve ser exclusivamente admin.

Não foram criados banco, migração aplicada ou dados reais nesta etapa.
