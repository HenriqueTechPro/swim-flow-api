# Swim Flow — 02E-9F: recuperação local via HTTP

## Novos endpoints, sem alterar o fluxo Supabase

- `POST /api/auth/local-password-reset/request`: recebe somente `email` e responde `{ "data": { "success": true } }`. O serviço só envia a endereços confirmados previamente associados a contas locais ativas. O retorno não informa existência de conta, e não aceita redirect.
- `POST /api/auth/local-password-reset/confirm`: recebe `token` de 256 bits em base64url e `password` (12–72 bytes UTF-8); troca o hash bcrypt, consome o token e revoga sessões existentes na mesma transação. O token expira em 30 minutos e é de uso único. Não cria cookie nem token de sessão.
- Respostas com `Cache-Control: no-store` e payloads validados por Zod com `.strict()`.

## Segurança e flags (não ativar ainda)

A API só libera as rotas se **ambas** forem `true`:
`SWIMFLOW_LOCAL_PASSWORD_RESET_API_ENABLED` (roteamento) e
`SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED` (envio). Continuam ausentes
do `render.yaml`, portanto desligadas por padrão.

O HTTP exige um cabeçalho `Origin` exato da lista
`API_CORS_ORIGIN`, mesmo com cookie SameSite=lax. A origem é apenas
uma defesa adicional para navegadores, não identidade de clientes.

O rate limit é de 3 pedidos por IP/15 min e 5 confirmações por
IP/15 min, sem usar o e-mail na chave (evita bypass por troca
de destinatário). O limitador existente é por instância, em
memória; antes de escalar em produção será necessário
armazenamento compartilhado e também controles antispam
por identidade/destinatário, sem enumeração.

## Pendências

- [ ] Build, lint, Prettier e Jest unitários/E2E em GitHub Actions.
- [ ] PostgreSQL descartável CI.
- [ ] Revisão de segurança Codex.
- [ ] Merge manual.
- [ ] Tela `/auth/reset-local-password` na Vercel, lendo o token do fragmento `#token=...`.
- [ ] Aplicar e verificar a migration incremental de identidades no Neon staging (a baseline já existe).
- [ ] Só então considerar ativar o e-mail Resend e os endpoints no Render staging.

Nenhuma operação foi feita no Neon real, Render ou provedor de e-mail nesta etapa.
