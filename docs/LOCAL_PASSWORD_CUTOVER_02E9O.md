# Swim Flow — 02E-9O | Cutover controlado de login PostgreSQL

## Objetivo

Preparar o endpoint já existente `POST /api/auth/login` para autenticar
somente identidades locais de `local_auth_identities`, sem SDK Supabase.
Preservar o contrato do dashboard (JWT de acesso + cookie httpOnly de refresh)
e a arquitetura DDD por meio de `AuthDirectoryRepository`.

**Esta PR não cria usuário, não aplica migrations e não ativa login
automaticamente no Render.**

## Entregas

- O provider `AuthDirectoryRepository` passa a usar
  `LocalAuthDirectoryService`; a verificação de senha real é delegada ao
  `LocalPasswordIdentityService`, já testado com bcrypt.
- `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED` aceita somente `true`/`false`
  (default `false`). Enquanto desabilitado, `POST /api/auth/login`
  retorna HTTP 503 **sem consultar credenciais**.
- Quando habilitado, só aceita email verificado, conta não desabilitada,
  senha bcrypt válida e perfil existente. Nunca cria usuário pelo login.
- Consultas de sessões utilizadas por JWT e refresh exigem vínculo a
  `LocalAuthIdentity` com `disabledAt = null`,
  `emailConfirmedAt IS NOT NULL` e `passwordHash IS NOT NULL`.
  Sessões legadas sem identidade local não recebem acesso.
- Endpoints legados de Google OAuth, convite, recuperação de senha,
  diretório e exclusão de contas respondem HTTP 503 via este adapter,
  independentemente de haver chaves antigas Supabase na configuração.
  Os endpoints locais de convite/reset com gates próprios permanecem separados.
- Storage Supabase e o SDK antigo continuam no código até o trabalho S3.
  Esta PR não ativa upload de fotos.

## Procedimento seguro de implantação

1. Revisar CI (API e PostgreSQL descartável), Codex e fazer **merge manual**.
2. No Render staging, publicar a `main` usando deploy manual.
   Manter `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=false` ou variável ausente.
3. Conferir `GET /health` e `GET /health/ready` em HTTP 200 e
   `POST /api/auth/login` em HTTP 503 (gate desabilitado).
4. **Em etapa separada**, revisar e executar o CLI de primeiro administrador
   `scripts/bootstrap-first-admin.cjs` (ou workflow GitHub manual
   opcional PR #43, após revisão e merge). O staging Neon já contém as duas
   migrações, mas ainda não havia admin criado na auditoria anterior.
   Não executar seed padrão ou cadastro público.
5. Verificar privadamente a existência e a consistência do admin;
   configurar segredos exclusivos de produção/staging e revisar
   `JWT_ACCESS_SECRET`, que deve ser renovado se já foi exposto.
6. Somente após testes de autenticação em staging, no Render → Environment,
   definir `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=true`. O serviço foi
   criado como Web Service manual, então `render.yaml` **não altera
   automaticamente** o Environment existente.
7. Com dados fictícios, testar login, cookie Secure/HttpOnly/SameSite,
   `/api/auth/me`, refresh, logout, tentativas inválidas, bloqueio de
   identidade e permissões. Testar também em Chromium/Android PWA.
8. Se precisar voltar a bloquear **novos logins**, usar `false`.
   Para invalidar **sessões já emitidas**, revogar sessões explicitamente
   (ou rotacionar o JWT secret durante incidente); desligar o gate sozinho
   **não** revoga sessões prévias.

## Gates de segurança

- Sem link Google aceito pelo adapter local antes de verificar ID Token
  (assinatura, issuer, audience e email_verificado).
- Sem convites/cadastro ou recuperação de senha no endpoint legado.
- Sem credenciais nem tokens em logs, commits ou conversas.
- Não utilizar o ambiente de staging gratuito com dados reais de crianças.
- Migrações e primeiros usuários nunca são criados no build/start do Render.
- Auditar `npm audit` antes de liberar dados reais.

## Próximas PRs

1. Provisionamento do primeiro admin via fluxo auditado/manual.
2. Migração de convites, recuperação e diretório administrativo para
   os serviços locais já preparados.
3. Login Google sem Supabase, com validação server-side.
4. Upload de fotos via bucket S3-compatible, depois remoção definitiva
   de SDK, envs e arquivos legados Supabase.
