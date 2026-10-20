# Swim Flow — Etapa 02D-5: HTTP NestJS com banco PostgreSQL real

## Objetivo

Garantir que uma requisição HTTP percorra o NestJS **de verdade**:
controlador, Zod, casos de uso, repositórios Prisma e o PostgreSQL 16
descartável. As suítes HTTP anteriores substituíam repositórios por mocks.

A suite `test/postgres-http.integration-spec.ts` possui configuração
Jest própria: `test/jest-postgres-http.json`. Ela só é executada na
workflow `.github/workflows/database-quality.yml`, depois do
`prisma migrate deploy`, dos testes de integridade e dos testes de
concorrência. Os testes E2E convencionais continuam independentes do DB.

## O que é real e o que é simulado

- **Real**: `AppModule`, `PrismaService`, tabelas/migrations, repositórios,
  controladores, validação HTTP, `RolesGuard`, `PermissionsGuard`,
  `TeacherAttendanceScopeGuard` e consultas dos perfis de acesso.
- **Simulado**: exclusivamente a verificação criptográfica do token JWT.
  Os tokens fictícios `Bearer admin` e `Bearer teacher` são mapeados
  para dois `Profile` de teste **persistidos** no banco descartável.
  Os tokens fictícios NÃO funcionam na aplicação fora dessa suíte.
- **Não exercitado**: autenticação Supabase, assinatura JWT real,
  upload de arquivos, envio externo de mensagens, integração Render,
  nem ambiente Neon.

## Fluxos HTTP cobertos

1. Anônimo recebe 401; professor autenticado recebe 403 para
   responsáveis, resultados e histórico de ex-alunos; URL antiga
   de resultados públicos também exige autenticação.
2. Administrador cria um responsável e um aluno via HTTP.
   Prisma comprova responsável principal, matrícula e categoria histórica
   da temporada vigente.
3. Transferência via `PUT /api/students/:id` encerra a matrícula antiga
   e cria nova matrícula primária. Tentativa de associar responsável
   inexistente devolve 409 **sem modificar nome, responsável ou turma**.
4. Professor com conta realmente vinculada à turma enxerga seu aluno;
   acesso à turma anterior é negado. Frequência persistida via HTTP
   aparece na tabela `attendance_records`.
5. Resultados de piscina e águas abertas são lançados via HTTP e
   persistidos em tabelas independentes. Tempo ausente em resultado
   classificado é recusado.
6. Revogar o vínculo `Teacher.profileId` retira a visibilidade do aluno
   no próximo GET e bloqueia consulta de frequência com 403.
7. Arquivar e reativar um aluno via HTTP preserva o desligamento no
   histórico. Tentar excluir um aluno com resultados retorna 409.

## Guardas contra uso acidental em banco real

O `beforeAll` testa `SWIMFLOW_DISPOSABLE_DB=yes` e exige que
**ambas** `DATABASE_URL` e `DIRECT_URL` apontem para
`localhost`/`127.0.0.1` no DB `/swimflow`; caso contrário aborta.
A CI fornece somente credenciais fictícias.

Esta suíte altera dados de uma temporada temporária no PostgreSQL do CI,
portanto não deve ser executada contra staging compartilhado nem Neon.

## O que ainda precisa de validação antes de produção

- Endpoints de avaliações antropométricas e técnicas ainda não são
  abordados por esta suíte HTTP; os modelos e suas FKs foram testados
  com Prisma real em 02D-2/02D-3, não pelo controlador HTTP.
- A autorização de publicação de resultados de menores continua
  negada por padrão.
- A troca de Supabase Auth/Storage e o deploy Render/Neon são etapas
  separadas. O fluxo real de JWT assinado precisará de testes próprios.
- A sincronização do dashboard com os contratos alterados requer
  validação específica antes da disponibilização a usuários.

Nenhuma migration nova foi criada neste PR; a inicial permanece imutável.
