# Swim Flow — Etapa 02E-9J | Primeiro administrador no Neon staging

## Estado validado em 22/10/2026

- Projeto Neon `swim-flow-staging` (`raspy-breeze-33258358`), branch
  `staging` (`br-gentle-wildflower-b7qrnd74`), banco `swimflow`.
- Migrações `20261020000000_init_neon` e
  `20261021000000_local_auth_identity_foundation` concluídas.
- Tabelas `profiles`, `local_auth_identities`, `auth_sessions`
  e `local_auth_action_tokens` sem registros.
- A criação do primeiro admin **não foi executada** nesta PR.

## Como usar (no GitHub pelo celular)

Após revisão e merge desta PR, vá ao repositório
`HenriqueTechPro/swim-flow-api` → **Settings → Environments** →
`swimflow-neon-staging`. Confirme que o ambiente permite **apenas a branch
main** e, quando disponível, requer aprovação de um revisor independente.

Os dois secrets de conexão **já configurados para a migração** continuam
válidos e devem ser preservados:

- `SWIMFLOW_STAGING_DATABASE_URL` — URL pooled (TLS, schema=public).
- `SWIMFLOW_STAGING_DIRECT_URL` — URL direct (TLS, schema=public).

Crie **mais três environment secrets**, com os nomes exatos:

| Environment secret | Valor |
| --- | --- |
| `SWIMFLOW_STAGING_FIRST_ADMIN_EMAIL` | E-mail que você deseja usar para o administrador de staging |
| `SWIMFLOW_STAGING_FIRST_ADMIN_NAME` | Nome de exibição do administrador |
| `SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD` | Senha **nova e exclusiva para staging**, com 12 a 72 bytes UTF-8; prefira 16+ caracteres aleatórios |

**Não forneça essas credenciais no chat, formulário de workflow_dispatch,
commit, log, screenshot, issue ou PR.** Crie a senha num gerenciador de
senhas. Não reutilize senha pessoal, de outros serviços, de produção nem a
senha do próprio banco Neon. O GitHub permite editar os segredos, mas não
exibe o valor após salvar.

Depois vá a **Actions → Bootstrap first Swim Flow staging administrator
(manual) → Run workflow**; escolha `main` e digite exatamente no único
campo de confirmação:

```text
BOOTSTRAP_SWIM_FLOW_STAGING_ADMIN_ONCE
```

O workflow rejeita outras branches, outros repositórios, novo attempt,
ausência de confirmação ou secrets. Usa `environment: swimflow-neon-staging`
com suas proteções, `permissions: contents: read` e um grupo de
concorrência compartilhado com o workflow de migration.

### Tratamento das credenciais

- `npm ci`, testes e geração do Prisma Client **não recebem** segredos reais.
- Somente a etapa final recebe as duas URLs privadas e os 3 dados do admin.
- O wrapper Node em `scripts/bootstrap-first-admin-github.cjs` valida
  o projeto, branch, host, TLS, database e `schema=public`, e transforma
  a senha temporária em stdin para o script existente.
- Senha **não passa por argv**, não é enviada ao subprocesso pelo ambiente,
  não aparece em stdout/stderr e nunca é salva em arquivo ou no Git.
- `bootstrap-first-admin.cjs` utiliza bcrypt custo 12 e transação com
  lock consultivo; só cria um perfil admin com identidade local se a
  migração já estiver concluída e o banco de usuários/sessões estiver vazio.
- A repetição da ação após sucesso deve falhar por banco não vazio; não
  rodar novamente à força.

## Conferir o resultado e descartar secrets temporários

Após a execução, conferir:
- GitHub Actions com status `Success`.
- Neon staging: exatamente **1** registro em `profiles`, com role
  `admin`, e **1** em `local_auth_identities`, vinculados pelo mesmo UUID.
- `password_hash` armazenado como hash bcrypt (nunca exibir o valor
  nem a senha).
- `auth_sessions` e `local_auth_action_tokens` com **zero** registros.
- As duas migrações Prisma continuam concluídas e inalteradas.

Em seguida **exclua o secret**
`SWIMFLOW_STAGING_FIRST_ADMIN_PASSWORD` do GitHub Environment (e, se
não precisar reutilizá-los, também os temporários de e-mail e nome).
**Mantenha** as duas URLs Neon secretas para as etapas seguintes.

Não exponha dados pessoais em logs, prints ou capturas do painel.

## O que isso NÃO faz

- O script não cria tokens de sessão, endpoints nem OAuth.
- **O login local ainda não está ativado.** Não tente usar essa conta no
  frontend até terminar e testar o cutover da autenticação.
- Não liga Render, não muda Supabase Auth/Storage, não importa alunos
  antigos, não configura bucket S3 nem realiza deploy de produção.

A etapa seguinte será auditar o admin criado e preparar o Render staging,
seguida de teste de login local e, posteriormente, migração Google/S3.

Se o job falhar, **não o reexecute** sem verificar o estado no Neon com
consultas somente-leitura; não use `migrate reset` ou limpeza de tabelas
para contornar os bloqueios.
