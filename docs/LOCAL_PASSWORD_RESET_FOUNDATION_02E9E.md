# Swim Flow API — 02E-9E | Preparação da recuperação local de senha

## Objetivo
Eliminar a dependência do Supabase Auth na recuperação de senha, sem
antecipar o corte de autenticação nem expor endpoints incompletos.

### Situação do projeto
- PRs #31–35 incorporadas à main: identidade local, bcrypt, tokens de
  uso único e convites administrativos internos.
- PRs #36 (aceite de convite) e #37 (rota administrativa) já
  integradas à `main`, após testes e revisão.
- Dashboard já possui tela de aceite de convite (PR #13 integrada).
- Banco Neon staging **ainda não tem** a migração incremental das
  tabelas de identidade; não conectar fluxos locais ao Neon antes
  de aplicar/verificar `prisma migrate status`.
- Supabase Auth/Storage continuam em uso no backend e no frontend.
- Render Blueprint continua em preparação, sem deployment aprovado.

## Conteúdo desta etapa
- `LocalPasswordResetService`: orquestra solicitação de recuperação
  somente para identidade local **existente, confirmada, habilitada
  e com senha**.
- Reutiliza `LocalAuthActionTokensService.issueForIdentity` com
  propósito `PASSWORD_RESET`: token criptográfico de 256 bits,
  armazenado apenas como SHA-256, expiração de 30 minutos e
  invalidação de links anteriores.
- A mensagem só será enviada ao email **já verificado no banco**,
  nunca ao email livremente informado sem correspondência.
- Retorna `{ success: true }` mesmo para contas ausentes, inválidas,
  bloqueadas ou sem confirmação, sem vazar o estado do cadastro.
- `ResendPasswordResetMailSender`: entrega via endpoint HTTPS fixo,
  sem imprimir logs do provedor, tokens ou chaves. O link usa fragmento
  `#token=...` (e não query string) na rota **futura**
  `/auth/reset-local-password`.
- `SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED` precisa ser `true`
  para a entrega funcionar. **Não habilitar ainda**: a rota e a
  tela de redefinição local ainda não foram implementadas.
- Testes unitários da orquestração e da integração HTTP com Resend
  totalmente simulada; zero chamadas externas nos testes.
- Serviços injetados no `AuthModule`, mas nenhuma rota pública ou
  login foi modificado.

## Requisitos obrigatórios para habilitar mais tarde
1. Revalidar os contratos dos endpoints de convite das PRs #36/#37
   já integradas à API e a tela de aceite do dashboard.
2. Rodar a migration incremental de identidade no Neon staging
   por Prisma 6 e revisar o histórico, sem alterar a baseline.
3. Construir um endpoint novo de solicitação com rate limiting,
   origin validation e resposta uniforme; não reaproveitar
   o formato Supabase de tokens.
4. Construir um endpoint de consumo com token de uso único e
   `redeemWithPassword(..., 'PASSWORD_RESET', ...)`, que revoga
   sessões anteriores na mesma transação que troca a senha.
5. Implementar a tela de reset na Vercel que lê o fragmento e
   o elimina do navegador depois do consumo, com testes.
6. Configurar Resend com remetente validado e armazenar a chave
   **somente no Render**, sem enviar tokens/logs para o chat.
7. Testar e2e rejeições de token usado, expirado, inválido,
   reutilizado, senha fraca e conta bloqueada.
8. Somente então habilitar `SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED`
   em staging e substituir gradualmente o fluxo Supabase.

## Gates
- [x] Sem alterações de schema nem dados.
- [x] Sem novos endpoints públicos ou exposição de segredos.
- [x] Serviço fail-closed por flag desabilitada.
- [x] Anti-enumeração em forma de resposta uniforme.
- [x] E-mail HTTPS com link de fragmento e host configurado.
- [ ] Build, TypeScript, lint, testes unit/E2E e PostgreSQL CI.
- [ ] Codex revisão da PR.
- [ ] Merge manual pelo responsável.
