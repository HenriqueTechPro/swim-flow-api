# Swim Flow — 02E-9C | API de aceite de convites locais

## Entrega

- `POST /api/auth/local-invitations/accept`: endpoint público **somente para quem recebeu o token**, com token e senha enviados no corpo JSON, jamais na URL.
- `PublicAuthRateLimitGuard` limita tentativas de aceite por endereço IP (5 a cada 15 minutos por instância). `TrustedOriginGuard` aplica o controle de origem em configuração cross-site com cookies.
- Validação Zod estrita: token base64url de 43 caracteres (32 bytes aleatórios), senha de 12 a 72 caracteres e no máximo 72 bytes UTF-8 para bcrypt.
- Resgate via `LocalAuthActionTokensService.redeemWithPassword` usa transação PostgreSQL para consumir token uma vez, criar hash bcrypt, confirmar identidade e revogar sessões.
- Resposta `{data:{success:true}}` não devolve dados da conta, token, senha nem access/refresh token.
- `Cache-Control: no-store`. Nenhuma sessão é aberta automaticamente: usuários só entram no fluxo de login local no cutover.
- Não altera `AuthDirectoryRepository` ou as rotas atuais de Supabase/Google. Não cria contas públicas.
- Testes HTTP: token inválido, senha curta, limite em bytes, rejeição de campos extras, replay/expiração e limite de tentativas.

## Coordenação com o dashboard

A tela pública `/auth/accept-local-invitation#token=...` deve extrair e **limpar imediatamente o fragmento**, solicitar senha+confirmação, chamar a rota acima e levar o usuário à tela de login com indicação de que a ativação foi concluída. O dashboard só exibirá a entrada por senha local depois do cutover; nunca prometer autenticação antes disso.

O transportador de e-mail Resend continua desativado até aceite pelo frontend e revisão conjunta. `SWIMFLOW_LOCAL_INVITES_ENABLED` não deve ser ajustado neste PR.

## Gates

- [ ] Typecheck, lint, Prettier, unitários, HTTP E2E.
- [ ] PostgreSQL 16 descartável.
- [ ] Revisão Codex sem findings.
- [ ] Merge manual após revisão.

Não executar migrations no Neon e não habilitar Resend ou deploy neste PR.
