# Swim Flow — 02E-9B | Convites administrativos locais (fundação)

## Situação

A implementação desta etapa é **interna e inativa na API pública**.
Os endpoints /api/auth/invitations e de recuperação de senha continuam ligados
ao provider Supabase até a substituição completa dos contratos, telas e entregador.

## Mudanças

- `LocalAdminInvitationsService` exige o papel `admin` persistido no
  PostgreSQL e identidade local confirmada, com senha configurada e sem bloqueio.
- Valida e normaliza e-mail e nome, define o papel explicitamente.
- Na primeira criação, insere perfil, identidade pendente e token de convite
  (somente SHA-256) na mesma transação.
- Não há cadastro público, criação automática de administrador, retorno do
  token em JSON ou e-mail confirmado sem aceite do convite.
- Para uma identidade *ainda pendente*, reenviar preserva o ID e o papel
  originais e usa `LocalAuthActionTokensService` para invalidar links antigos.
- Contas ativadas, bloqueadas ou tentativas de mudar o papel em reenvio
  são rejeitadas.
- Um provedor de e-mail indisponível pode deixar conta pendente sem mensagem;
  o mesmo administrador pode reenviar com segurança mais tarde.

## Adaptador de entrega Resend

Implementamos a integração HTTPS POST `https://api.resend.com/emails`
sem SDK adicional. Só ficará ativa com **todas** as condições:

- `SWIMFLOW_LOCAL_INVITES_ENABLED=true`: desligado por padrão.
- `RESEND_API_KEY`: segredo exclusivamente do Render/servidor.
- `RESEND_FROM_EMAIL`: endereço de remetente validado pelo provedor.
- `SWIMFLOW_AUTH_APP_ORIGIN`: origem HTTPS exata, sem caminho, consulta,
  fragmento nem usuário na URL.

O corpo da mensagem usa uma rota fixa e guarda o token **no fragmento**:
`/auth/accept-local-invitation#token=...`.
A página correspondente **ainda não existe** no dashboard; portanto
**não habilite a flag**, não envie links reais e não modifique as variáveis
do Render neste PR.

O adaptador jamais registra o token ou o erro HTTP bruto do provedor
(e-mails e segredos podem aparecer neles). Acesso em rede limitado por timeout,
e erros de entrega viram uma falha genérica. Aceite do provedor não significa
confirmação de entrega no inbox.

## Segurança e testes

- Jest: entrega bloqueada, configuração incompleta, validação de origens,
  contrato HTTP do provedor (mock) e tratamento genérico de erros.
- PostgreSQL 16 descartável: administrador autorizado, rejeição de não admin,
  criação pendente e hash do token, reenvio seguro, invalidação do token anterior,
  ativação do convidado e recusa de administrador bloqueado.
- Ambos `DATABASE_URL` e `DIRECT_URL` precisam apontar para o PostgreSQL local
  de CI antes de abrir conexão de testes.
- Nenhuma migration adicional, nenhuma senha real, nenhum acesso ao Neon real.
- Frontend e endpoints de login públicos inalterados.

## Próxima fatia — 02E-9C

Implementar página pública de aceitação e formulário de senha segura,
conectar o endpoint de confirmação local ao backend com proteções de rate
limit/CSRF e validar a transição sem interferir no login em produção.
Só então iniciar habilitação controlada do entregador e do cadastro admin local,
com E2E de ponta a ponta e alertas para falhas.
