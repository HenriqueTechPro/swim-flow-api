# Swim Flow — 02E-9A | Fundação de convites e recuperação local

## Entrega desta fatia

- Novo serviço interno `LocalAuthActionTokensService`, registrado no `AuthModule` sem alterar o provider público `AuthDirectoryRepository`, que continua Supabase.
- `issueForIdentity(userId, purpose)` emite token aleatório de 32 bytes (256 bits, base64url) e persiste apenas SHA-256 no PostgreSQL.
- `INVITATION`: válido por 24 horas e elegível somente para identidades pendentes sem senha.
- `PASSWORD_RESET`: válido por 30 minutos e elegível somente para identidades confirmadas com senha.
- Na reemissão, tokens anteriores ainda não usados do mesmo propósito são invalidados em uma transação.
- `redeemWithPassword(token, purpose, password)`: valida propósito, validade e uso único; grava hash bcrypt custo 12; bloqueia identidade desabilitada e revoga sessões ativas **na mesma transação**.
- Condição `updateMany` protege contra token consumido por requisições concorrentes e impede replay.
- Tokens **não** aparecem em payloads HTTP, logs, variáveis de ambiente nem no banco em claro.

## Mudanças de CI após review PR #33

- Corrigido o guard da integração do bootstrap: agora `DATABASE_URL` e `DIRECT_URL` devem apontar para PostgreSQL `swimflow` local descartável; isso resolve o apontamento P2 do Codex.
- Testes negativos do guard e teste de integração real de convites, reuso, reemissão, concorrência, hashing e revogação de sessões.
- Nenhum comando acessa Neon real; runners testam um PostgreSQL 16 descartável.

## Limites intencionais

- O novo serviço de tokens está isolado: **não** há endpoint novo e nenhum e-mail é enviado nesta PR.
- A criação da identidade do convidado será feita no futuro somente pelo fluxo admin autenticado.
- A adaptação do contrato de recuperação e das telas será feita junto com um provedor de e-mails e redirecionamentos estritamente validados.
- Google Login e armazenamento de imagens S3 ficam para próximas etapas.
- Nenhuma migration adicional foi necessária: a tabela `local_auth_action_tokens` vem da migration 02E-7. A migration continua pendente no Neon staging até autorização e validação do ambiente.
- Nunca enviar tokens reais, links secretos ou DATABASE_URL em comentários de PR.

## Critérios de aceite

- [ ] Build TypeScript, lint, Jest unitário/E2E (API quality gate).
- [ ] PostgreSQL descartável: testes de integração com concorrência e session revocation.
- [ ] Revisão Codex, correção de findings.
- [ ] Merge manual pelo responsável.

## Etapa seguinte: 02E-9B

Conectar a criação de identidades convidadas à API administrativa, escolher adaptador de entrega de e-mails com configuração segura e construir fluxo de recuperação no frontend. Não fazer cutover do Supabase antes de validar os fluxos completos.
