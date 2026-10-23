# Swim Flow — Primeiro administrador por convite (02E-9P)

## Decisão: alternativa B

O bootstrap com senha digitada ou armazenada no GitHub foi substituído no
script da API por um **convite de ativação do primeiro administrador**.
O primeiro administrador é criado pendente, com papel `admin`, mas com
`password_hash = NULL` e `email_confirmed_at = NULL`.
Não pode efetuar login antes de aceitar o convite.

Nenhuma conta é criada e nenhum e-mail é enviado durante build, CI,
merge ou deploy. O CLI só realiza escrita mediante ação manual explícita.

## Proteções

- Destino: APENAS Neon staging (project, branch, hosts direct/pooled, banco
  `swimflow`, TLS `sslmode=require`, `schema=public` e aprovação literal).
- Modo inicial `--apply`: exige `profiles`, `local_auth_identities` e
  `auth_sessions` vazias e a migração local concluída.
- Criação atômica de perfil `admin` e identidade pendente com token
  `INVITATION` de 32 bytes aleatórios, armazenado **somente como SHA-256**,
  uso único e expiração de 24 horas.
- Antes da transação o mailer já deve estar configurado. O convite vai
  exclusivamente ao endereço do administrador; o CLI não imprime token,
  endereço, senha, connection string nem resposta bruta do provedor.
- O e-mail chega com link de ativação em fragmento (`#token=...`), não
  em parâmetros de URL ou logs HTTP. O frontend deve extrair o fragmento,
  aceitar a senha e enviar token+senha por POST para
  `/api/auth/local-invitations/accept`.
- Após aceitar, o serviço grava bcrypt(12), confirma o e-mail e consome
  o token numa mesma transação. Não emite sessão automaticamente.
- A transação de bootstrap utiliza advisory lock. Repetir `--apply`
  não cria novo admin. O modo `--resend` exige exatamente uma identidade
  `admin` ainda pendente com o mesmo nome/e-mail e nenhuma sessão;
  invalida tokens anteriores e gera convite novo. Não reabre admin ativo.

## Validação de envio — sem criar administrador

Antes do bootstrap, a API fornece um teste totalmente independente do Neon:
`npm run resend:smoke`. Esse comando envia **uma única mensagem neutra**
sem token, senha ou link, exclusivamente ao destinatário informado
na variável local `SWIMFLOW_RESEND_SMOKE_TO`.
O remetente é fixo em `onboarding@resend.dev` e o domínio de testes
do Resend aceita apenas o e-mail cadastrado na conta do remetente.
O teste exige uma autorização manual explícita, não lê variáveis de banco,
não emite convites e não retorna o segredo nem o endereço do destinatário.

Veja `docs/RESEND_STAGING_DELIVERY_SMOKE_02E9R.md` para os comandos seguros
de execução em PowerShell. Executar primeiro o teste de CI sem credenciais:
`npm run resend:smoke:test`. Depois, verificar a entrega real na sua
caixa de entrada e no painel Resend.

## Pré-requisitos ANTES de executar

**NÃO executar este processo ainda.** Primeiro implementar e testar no
dashboard o endereço `/auth/accept-local-invitation`; preparar uma origem
HTTPS confiável, domínio remetente validado no Resend, chaves privadas e
verificar o e-mail realmente recebido. Não liberar dados reais nesta fase.
Antes de configurar o serviço de e-mail, revisar permissões do ambiente.

Para execução segura *somente quando a tela de ativação estiver pronta*:
- Separar variáveis `DIRECT_URL` e `DATABASE_URL` do Neon staging em
  gerenciador de segredos (nunca colocar valores reais no repositório).
- Informar `NEON_PROJECT_ID`, `NEON_BRANCH_ID`,
  `SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL`, `SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL`
  e `SWIMFLOW_BOOTSTRAP_ADMIN_NAME` apenas no ambiente privado de execução.
- Exigir `SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED=true` e
  `SWIMFLOW_LOCAL_INVITES_ENABLED=true`, além de `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`, `SWIMFLOW_AUTH_APP_ORIGIN` na execução.
- Instalar dependências de desenvolvimento para executar o sender
  TypeScript por ts-node (por exemplo, `npm ci --include=dev`).
- Nunca definir `SWIMFLOW_BOOTSTRAP_ADMIN_PASSWORD`. O CLI rejeita
  a variável e `validateAdminInput()` rejeita qualquer senha inicial.
- Manter `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=false` no Render até
  concluir a ativação e os testes de autenticação.

### Comandos, após preparo e autorização

```bash
npm run bootstrap:first-admin:invite
# Somente se a identidade estiver pendente e o primeiro envio falhou:
npm run bootstrap:first-admin:resend
```

O CLI valida a autorização, a conexão, a migração e o estado do banco
antes de enviar qualquer mensagem. `--resend` cria um novo token; o
anterior deixa de funcionar. Se uma entrega falhar, verificar o estado
no Neon **somente leitura** antes de reemitir; não apagar ou editar
registros manualmente e não executar `migrate reset`.

## Gates antes de ativar login

1. Verificar exatamente uma linha em `profiles` como `admin`, uma
   identidade local vinculada e um token `INVITATION` com hash.
2. Confirmar recebimento de e-mail, tela HTTPS, aceitação com token
   de uso único, senha válida e confirmação da identidade.
3. Verificar que token expirado, já utilizado e convite anterior
   após reemissão são rejeitados; sem link em logs.
4. Habilitar manualmente `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=true`
   no Render **somente** depois de todos os testes e do deploy da tela.
5. Validar POST login, JWT, refresh, logout, 401/403, roles, mobile/PWA
   e recuperação de senha antes de uso real.

## Evolução futura

O papel `admin` atual é global ao sistema; isolamento por clube/escola,
segundo administrador e recuperação de emergência serão definidos antes
de habilitar usuários reais/multitenancy.

A PR #43 (GitHub Action com senha inicial em secret) foi **fechada sem merge**.
Não ressuscitar esse fluxo, pois conflita com a decisão por convite.
