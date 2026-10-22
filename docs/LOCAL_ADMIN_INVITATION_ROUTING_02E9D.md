# Swim Flow — 02E-9D | Integração administrativa de convites locais

## Objetivo

Adicionar um caminho administrativo opcional para realizar convites usando
PostgreSQL/Neon e Resend, **sem redirecionar a rota Supabase atual**
`POST /api/auth/invitations`. Esta etapa NÃO ativa envio real.

## API preparada

`POST /api/auth/local-invitations`

- JWT emitido pela API, papel e permissão admin verificados pelo servidor.
- `LocalAdminInvitationsService` faz uma segunda validação da identidade
  local do administrador no PostgreSQL: somente admin com e-mail confirmado,
  hash de senha existente e sem bloqueio pode convidar.
- DTO estrito: `{ email, fullName?, role? }`, papel opcional padrão
  `user`. Não aceita `redirectTo` ou URL arbitrária do cliente.
- Resposta genérica `{data:{success:true}}`, `Cache-Control: no-store`.
  Nenhum token, URL de convite ou ID de usuário é retornado em JSON.

## Travas independentes de implantação

Para o endpoint responder, ambas as variáveis de **servidor** precisam
ser definidas explicitamente como `true`:

1. `SWIMFLOW_LOCAL_INVITATION_API_ENABLED=true` — libera apenas a rota
   HTTP administrativa de convites.
2. `SWIMFLOW_LOCAL_INVITES_ENABLED=true` — libera o entregador interno;
   o adaptador ainda exige `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   e `SWIMFLOW_AUTH_APP_ORIGIN` (HTTPS exata).

**Nenhuma delas é ativada por este PR ou adicionada ao Blueprint.**
É proibido ligar essas chaves antes de validar o endpoint de aceite da
API PR #36 e a rota no dashboard PR #13, as migrations no Neon staging e
a sessão do administrador local.

## Testes executados pela CI

- Testes E2E HTTP: sem uma das flags há resposta 503, nenhuma entrega
  de e-mail, e somente administradores com permissão podem emitir convites.
- DTO não aceita redirects/fields extras e papel desconhecido.
- Banco PostgreSQL 16 descartável: solicita convite via HTTP usando
  perfil/role realmente persistidos, captura e-mail falso (sem rede externa),
  verifica criação pendente, consome token e valida login da identidade local
  por bcrypt. Rejeita convite repetido para identidade já confirmada.
- Teste bloqueado por ambiente: valida **ambas** `DATABASE_URL` e
  `DIRECT_URL` como `swimflow` local antes de conectar.

## Dependências para habilitar em staging

- PR #36 da API e PR #13 do dashboard integrados e revisados;
- aplicação autorizada da migração local de identidades no banco Neon staging;
- criação manual e conferência da identidade admin de staging;
- painel Vercel e origem HTTPS de callbacks de convite testados;
- remetente Resend verificado e limites do plano revisados;
- teste HTTP real contra Render/Neon staging, revogação, rate limits e
  monitoramento sem registrar tokens ou credenciais.

Não incluir segredo Resend no Vercel, no GitHub ou em resposta HTTP.
O componente Google ainda usa Supabase até o cutover geral.
