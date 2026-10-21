# Swim Flow — Etapa 02D-6E — ciclo de vida de acesso do professor

## Escopo
Extende o gate de integração HTTP NestJS + Prisma real + PostgreSQL 16 descartável:
`test/postgres-teacher-access.integration-spec.ts` integra o fluxo administrativo
`POST /api/auth/invitations` (com entrega simulada), `GET/PUT/DELETE /api/teachers/:id/account`,
`GET /api/classes`, `GET /api/students`, `POST/GET /api/attendance` e `GET /api/attendance/summary`.

### Fonte de verdade e limites
- O PostgreSQL é real; Prisma, repositories, casos de uso, validação Zod,
  `RolesGuard`, `PermissionsGuard` e `TeacherAttendanceScopeGuard` são reais.
- **Somente validação criptográfica do JWT** é simulada por identidades de teste.
- O envio do convite via Supabase é substituído na fronteira `AuthSessionManager.inviteUser`.
  O teste verifica permissão/validação HTTP e o encaminhamento ao serviço substituído,
  **não** prova envio de e-mail, criação de usuário externo nem login real.
- Um `Profile` de role `teacher` criado no banco local simula o estado *após*
  aceitação do convite; não pressupõe que o convite tenha sido entregue.
- Todos os nomes e contatos são fictícios e o domínio `example.invalid` não recebe mensagens.
- Não reutiliza banco Render, Neon, Supabase nem credenciais reais.

## Cobertura adicionada
1. Convite exige role administrativa persistida; teacher/user/sem token recebem 403/401;
   payload inválido recebe 400; convite permitido delega ao serviço simulado.
2. Antes do vínculo, a identidade teacher não enxerga turmas nem alunos, mesmo que a
   entidade de professor esteja atribuída a uma turma; frequência dessa turma é 403.
3. Endpoints administrativos só permitem role admin. UUID inválido e campos extras são 400.
   Perfil user gera 422, perfil inexistente 404, professor inativo 409,
   professor inexistente 404 e conta já ligada a outro professor gera 409.
4. `PUT` vincula por `profileId` explícito; `GET` confirma o estado.
   Repetir o mesmo `PUT` é idempotente e não duplica o evento de auditoria.
5. Após o vínculo, o teacher enxerga **somente** turma e atleta atribuídos, consegue
   lançar e consultar chamada autorizada e recebe 403 em turma de outro professor.
6. `DELETE` revoga o vínculo sem excluir o perfil, nem apagar a frequência.
   Repetir `DELETE` não duplica evento; a chamada POST, GET e summary retornam 403
   para a identidade cujo vínculo foi removido, e turmas/alunos deixam de ser retornados.
7. `TeacherAccountLinkEvent` preserva LINK/UNLINK, ID do administrador e do perfil.

## Portas de segurança obrigatórias
O teste se recusa a executar se:
- `SWIMFLOW_DISPOSABLE_DB` não for `yes`;
- `NODE_ENV=production`;
- `DATABASE_URL` ou `DIRECT_URL` não apontarem para host loopback
  (`localhost`, `127.0.0.1` ou `::1`) e base **/swimflow**.

## Execução na CI
A etapa preexistente da workflow `database-quality.yml`, após `prisma migrate deploy`,
executa `npx jest --config ./test/jest-postgres-http.json --runInBand`.
A configuração agora inclui a suíte `postgres-http.integration-spec.ts` anterior e
a nova `postgres-teacher-access.integration-spec.ts`, de forma sequencial.

## Checklist antes de merge
- [x] Sem alterações Prisma, migrations ou endpoints de produção.
- [x] Suíte de contrato administrativo e autorização com repositórios reais.
- [x] Casos de revogação sem alteração direta da FK nos passos testados.
- [x] Testes adicionados ao gate de PostgreSQL existente.
- [ ] CI API (TypeScript, Jest e build) verde.
- [ ] CI PostgreSQL real verde.
- [ ] Revisar comentários automáticos, segurança e regressões.
- [ ] Conferir nenhum dado real/banco remoto e diff mínimo.

## Fora do escopo e próximos passos
Ainda faltam testes em ambiente de staging com envio/aceitação real do convite,
tokens válidos, cookies de refresh, execução visual do dashboard/PWA e integração
com provedor externo. Essa validação deverá acontecer somente em ambiente isolado,
com contas fictícias e consentimento/credenciais apropriados.

**Próxima etapa recomendada (02D-6F):** habilitar teste de contrato compartilhado
dashboard/API e revisar a experiência visual de convite, vínculo e revogação,
mantendo cada PR pequena.
