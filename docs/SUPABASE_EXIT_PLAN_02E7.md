# Swim Flow — Saída do Supabase (02E-7)

**Decisão definitiva:** frontend React/PWA na Vercel, API NestJS no
Render, PostgreSQL no Neon e imagens em bucket S3-compatible com
camada de upload assinada. O Supabase será removido por completo,
mas **não basta apagar as variáveis do Blueprint**.

## Por que o Render ainda pede Supabase?

O `render.yaml` atual possui variáveis temporárias
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SECRET_KEY`. O backend realmente usa
`SupabaseAuthService` para login, login via Google, convites,
listagem/exclusão de usuários e recuperação de senha.
`SupabaseManagedUploadsRepository` usa Supabase Storage para
assinatura de uploads de fotos.

A API **falha na validação das variáveis obrigatórias** se
retirarmos essas variáveis antes de substituir os adaptadores. Isso
não significa que o PostgreSQL dependa do Supabase; apenas que a
camada atual de identidade e imagens ainda o utiliza.

## Etapa 02E-7: fundação para Auth no próprio PostgreSQL (esta PR)

- Acrescenta `LocalAuthIdentity` e `LocalAuthActionToken` ao
  modelo Prisma, sem mudar as tabelas existentes.
- Migração **incremental, append-only**
  `20261021000000_local_auth_identity_foundation` cria
  `local_auth_identities` e `local_auth_action_tokens`.
- Credenciais terão **apenas hash da senha** (nunca senha em claro).
  Os tokens de convite/reset terão apenas o **digest SHA-256**
  criptográfico, expiração, propósito e controle de consumo.
- Vincula identidade ao perfil por FK com cascade de exclusão, de modo
  que papéis e permissões existentes continuem no `profiles`.
- E-mails devem ser canônicos (lowercase + trim), com unicidade e
  constraint PostgreSQL para evitar duplicações inconsistentes.
- Não cria nenhum usuário, administrador, seed ou senha.
- O repositório usa `prisma migrate deploy` no banco **descartável**
  da CI, depois verifica FKs, índices e CHECKs.
- **Ainda não altera o provedor ativo de autenticação** nem o
  Blueprint; evita cortar login antes dos testes dos fluxos completos.

## Próximas fatias, antes de remover envs Supabase

### 02E-8 — Adapter de identidade PostgreSQL
- Criar `PrismaAuthDirectoryRepository` e substituir o provider
  `AuthDirectoryRepository` de forma atômica e testada.
- Implementar login com hash de senha bcrypt/Argon2id, verificação em
  tempo constante dentro dos recursos da biblioteca, estados
  bloqueado/pendente, proteção contra enumeração/brute-force,
  fechamento/revogação de sessões após troca de senha.
- Sem cadastro público: somente administradores autorizados poderão
  convidar novos usuários. Provisionar primeiro administrador através
  de comando protegido, único, auditável e nunca público.
- Cobrir concorrência, exclusão, sessões e perfis com testes em
  PostgreSQL real descartável.

### 02E-9 — Convites e recuperação por e-mail
- Criar tokens aleatórios de alta entropia, persistir **somente hash**
  e validar expiração/uso único.
- Substituir e-mails automáticos do Supabase por adaptador de entrega
  (provedor gratuito a escolher) sem alterar a segurança do token.
- Ajustar os endpoints e telas sem aceitar redirect externo arbitrário.
- Nunca exibir tokens em logs ou URLs de resposta da API.

### 02E-10 — Entrar com Google sem Supabase
- A API deve validar o **Google ID Token** diretamente no servidor,
  checando assinatura, issuer, audience, expiração e `email_verified`.
- Não confundir ID token do Google com token Supabase.
- Vincular apenas identidades previamente convidadas/autorizadas e
  impedir takeover por emails não verificados.
- Atualizar o frontend React/Vite e os testes do login Google.

### 02E-11 — Upload S3-compatible
- Escolher provedor com camada gratuita; configurar bucket/endpoint
  **somente no Render**.
- Usar assinatura limitada por usuário/objeto, tamanho, tipo de imagem,
  validade, visibilidade e política de acesso; evitar armazenar imagens
  sensíveis em bucket público inadvertidamente.
- Substituir endpoint assinado e qualquer fallback direto do frontend
  `src/lib/media/upload-image.ts` ao Supabase Storage.
- Validar avatars/fotos, upload, visualização, remoção e autorização.

### 02E-12 — Cutover final e limpeza
- Remover `@supabase/supabase-js` da API e do dashboard,
  `SupabaseAuthService`, `SupabaseManagedUploadsRepository`,
  envs Supabase em `env.ts`, `render.yaml` e frontend.
- Remover qualquer acoplamento e referências legadas não úteis.
- Testar login, sessão, refresh, logout, Google, convite, senha,
  controle de acesso por papel, fotos, CRUD, health/readiness,
  E2E HTTP e integração Vercel/Render/Neon.
- Garantir que os bancos Neon staging e produção recebam novas
  migrations **versionadas** após revisão e backups.
- Publicar Render somente depois das dependências obrigatórias
  estarem configuradas e do status Prisma validado.

## Estado das plataformas

- Neon: schema inicial em `swim-flow-staging/staging/swimflow`,
  sem dados importados do Supabase. Esta PR **não aplica ainda
  sua nova migration à branch real**.
- Render: o usuário está na tela inicial do Blueprint. **Não fazer
  Deploy Blueprint sem as configurações efetivas**.
- Vercel: permanece publicando o dashboard.
- Supabase: temporariamente necessário no código enquanto os
  substitutos passam por testes, mesmo que o objetivo seja zerar
  a dependência na versão definitiva.

## Gates desta PR
- [x] Prisma schema e SQL incremental (somente adições).
- [x] Constraints de email, propósito, validade e hash de tokens.
- [x] CI PostgreSQL descartável verifica integridade e banco sem identidades.
- [x] Sem remoção precipitada de login/upload atual.
- [ ] CI API e PostgreSQL aprovadas.
- [ ] Revisão Codex aprovada.
- [ ] Merge pelo responsável.
- [ ] Aplicação **autorizada** da migration incremental no Neon staging
      por Prisma 6, após `prisma migrate status`.
