# Swim Flow — Etapa 02E-8B: primeiro administrador no Neon staging

Este PR entrega somente um CLI manual de bootstrap. Não executa migrations, não cria usuário automaticamente e não ativa login PostgreSQL enquanto Supabase continua como provider.

## Segurança

- Necessita do argumento --apply e confirmação SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL.
- Confere NEON_PROJECT_ID, NEON_BRANCH_ID e os dois endpoints do staging (DIRECT_URL e DATABASE_URL) com hosts/banco exatos.
- Exige migration 20261021000000_local_auth_identity_foundation já aplicada.
- Recusa contas existentes em profiles, local_auth_identities ou auth_sessions.
- Usar uma transação com advisory lock impede múltiplos administradores por chamadas concorrentes.
- Senha exclusiva lida somente de stdin, nunca de argv/env; bcrypt custo 12; 12–72 bytes UTF-8.
- Não existe endpoint HTTP, seed, senha padrão ou backdoor.

## Antes de executar

Faça merge e revisão dos PRs aplicáveis, valide o status das migrations no Neon staging, confira backup e verifique que as tabelas estão vazias. Não copie strings de conexão ou senhas para chats, GitHub e logs. **O PR não executa nada no Neon.**

## Procedimento manual (Bash, somente staging)

```bash
export NEON_PROJECT_ID='raspy-breeze-33258358'
export NEON_BRANCH_ID='br-gentle-wildflower-b7qrnd74'
export SWIMFLOW_BOOTSTRAP_ADMIN_APPROVAL='BOOTSTRAP_SWIM_FLOW_STAGING_ADMIN_ONCE'
export SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL='seu-email@dominio.com'
export SWIMFLOW_BOOTSTRAP_ADMIN_NAME='Administrador Swim Flow'
# Carregue DATABASE_URL e DIRECT_URL do gerenciador local de segredos, sem publicar valores.
read -r -s -p 'Senha exclusiva do primeiro admin: ' ADMIN_PASSWORD; echo
printf '%s\n' "$ADMIN_PASSWORD" | npm run bootstrap:first-admin -- --apply
unset ADMIN_PASSWORD
```

Se o comando rejeitar a operação, pare e investigue o estado do banco; nunca force uma inserção direta manual.

## Verificações

- npm run bootstrap:first-admin:test: alvos errados, aprovação, entrada segura, migração ausente, usuários existentes.
- CI PostgreSQL descartável: testa simultaneidade, unicidade, hash da senha e limpeza dos registros criados.
- Nenhuma alteração no Render, no dashboard nem no Supabase nesta etapa.
