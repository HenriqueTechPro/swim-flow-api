# Swim Flow — Auditoria 02E-9S | JWT, refresh, logout e permissões

## Contexto e comprovações

O primeiro administrador ativou sua identidade local por convite no Neon.
A API staging foi publicada no Render e o dashboard está na Vercel.

Testes funcionais realizados manualmente pelo responsável:
- Login válido entra; senha incorreta é recusada.
- F5 e fechar/reabrir o navegador restauram a sessão.
- Logout retorna à página de login.
- GET sem Bearer em `/api/auth/access-profiles` retorna 401:
  `Missing bearer token`.

Esses testes comprovam a operação **básica**, mas não provam isolamento
entre papéis, resistência a concorrência de refresh ou revogação instantânea.

## Achados e alterações nesta PR

1. **Rotação não atômica de refresh** (corrigido): `ApiAuthService.refresh`
   criava a sessão sucessora antes de revogar a anterior, em duas escritas.
   Duas requisições simultâneas poderiam emitir sessões sucessoras distintas
   a partir do mesmo refresh token. Agora, o repositório usa transação
   PostgreSQL, `SELECT ... FOR UPDATE` do registro original, revalida
   identidade local ativa, expiração e hash dentro da transação, cria
   a nova sessão e marca a antiga revogada com ID sucessor no mesmo commit.
   A segunda requisição recebe 401 e **não** emite novo JWT.
2. **Identidade proveniente de JWT** (endurecido): `JwtAuthGuard` rejeita
   payloads vazios/malformados e obtém `id`/`email`/`sessionId` da sessão
   validada no repositório, não de atributos desatualizados do JWT.
3. **Logout e replay** (testes): logout revoga a sessão correspondente,
   impedindo seu JWT anterior de acessar rotas, mesmo se a assinatura e
   o prazo ainda forem válidos. Reuso detectado de refresh token
   previamente rotacionado mantém revogação global das sessões desse
   usuário como já acontecia antes desta PR.
4. **Papéis e permissões** (testes): `RolesGuard` busca o papel atual do
   banco, não confia no papel implícito ou anterior do token; mesmo que
   um `teacher` receba permissões arbitrárias em um objeto de teste,
   `PermissionsGuard` cruza as permissões com a allowlist do papel atual.
5. **PostgreSQL real** (teste de regressão): cenário em CI descartável
   cria um usuário fictício, duas requisições sobrepostas para o mesmo
   refresh token, verifica exatamente um sucessor sem sessão órfã, JWT
   anterior invalidado, sucessor autorizado, replay rejeitado e logout
   invalidando o último JWT.

## Escopo/limites

- NÃO modifica schema/migrations, contas reais, tokens atuais no Neon,
  dados de atletas nem configurações em Render/Vercel.
- NÃO ativa Google OAuth, convites públicos, reset legado ou S3.
- As rotas administrativas reais já exigem `JwtAuthGuard`,
  `RolesGuard`, `PermissionsGuard`. Os testes de permissões aqui usam
  usuários *mockados* e os E2E existentes exercitam os guardas reais
  com roles persistidas em PostgreSQL descartável.
- Não existe ainda teste manual com **login real de um professor**.
  Isso exige um convite de professor em etapa posterior, não criação
  informal de usuários privilegiados.
- **Recuperação local de senha** é independente do reset legado:
  continuar desativada até entrega Resend/testes completos do fluxo.
- Uma conta admin no staging funciona; antes de usar dados reais de
  menores, auditar dependências, privacidade, MFA e isolamento por clube.
- A sessão é armazenada no banco e o JWT assinado apenas identifica sua
  sessão. Alterações de papel são carregadas nas operações protegidas.

## Validação/rollout

1. Revisar CI Node 22: build, lint, Prettier, Jest, E2E.
2. Confirmar quality gate com PostgreSQL descartável incluindo cenário
   `verify-auth-session-rotation.cjs`.
3. Revisão Codex e merge **manual**.
4. Deploy manual da `main` no Render staging com variáveis atuais,
   sem criar novo usuário nem alterar `JWT_ACCESS_SECRET`.
5. Retestar /health, /health/ready, login, refresh após F5, logout e
   `GET /api/auth/access-profiles` sem JWT = 401.
6. Em seguida, PR independente para auditoria de reset de senha local
   e convite de professor restrito, usando conta não administrativa
   de teste, validando 403 em rotas admin.

Evitar testes destrutivos de replay com a sessão real do único
administrador: replays intencionais podem revogar todas as sessões
ativas conforme política de segurança.
