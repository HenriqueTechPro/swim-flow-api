# Swim Flow v1.2 — Runbook para API de produção isolada

> **Status (16/11/2026):** somente preparação revisável; criar e ativar o Render production e aceitar cobrança são operações posteriores, com aprovação expressa. O arquivo `render-production.yaml` **não** é importado automaticamente: Render continua usando `render.yaml` para o staging.

## Evidências da etapa Neon
- Neon production: `swim-flow-production`, project `round-bonus-30138797`, branch `br-tiny-mud-bb79ybtx`, DB `swimflow`, PostgreSQL 17.
- Migrações do Prisma: 12 concluídas (16/11/2026, 10:33 UTC); 41 tabelas.
- Dados importados: **zero** alunos, professores, perfis, responsáveis, turmas, presenças, resultados, imagens e sessões. Há 28 categorias de catálogo introduzidas pelas migrações.
- Neon staging preservado (60 alunos, 6 professores). Não copiar dados ou contas do staging.

## Pré-requisitos — Render
1. Validar custo do plano. O arquivo opcional de Blueprint especifica `starter`, que **gera cobrança ao provisionar**. O Render Free é compartilhado com a instância staging (750h por workspace/mês), sujeito a suspensão; não é adequado como backend oficial com usuários reais.
2. Somente com aceite do custo, criar o serviço **swim-flow-api-production** no mesmo workspace do Render, Node 22, Virginia, origem `HenriqueTechPro/swim-flow-api`, branch `main`, **Auto Deploy = Off**. Não vincular ao banco antigo.
3. Configurar Build: `npm ci --include=dev && npm run prisma:generate && npm run build`; Start: `npm run start:prod`; Health Check Path: `/health`. Não executar `migrate deploy` no build/start (schema já migrado via GitHub Actions).
4. Configurar secrets e parâmetros **exclusivos**:
   - `DATABASE_URL`: conexão **pooled** do novo Neon production, obrigatoriamente TLS
   - `DIRECT_URL`: conexão **direct** do novo Neon production, TLS, mesma role e DB
   - `JWT_ACCESS_SECRET`: valor aleatório distinto do staging, 32+ chars
   - `API_CORS_ORIGIN`: somente a origem HTTPS autorizada do frontend de produção (`https://swim-flow-dash.vercel.app` inicialmente, além de qualquer domínio oficial explicitamente homologado)
   - `NODE_ENV=production`, `NODE_VERSION=22`, `AUTH_COOKIE_SAME_SITE=none`, `AUTH_SECURE_COOKIES=true`, `AUTH_COOKIE_PATH=/api/auth`, `SWAGGER_ENABLED=false`
   - `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=false`, `SWIMFLOW_LOCAL_INVITES_ENABLED=false`, `SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED=false` até a homologação do bootstrap e do frontend
   - `SWIMFLOW_PRIVATE_BLOB_ENABLED=false`, `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED=false`, `SWIMFLOW_R2_STORAGE_ENABLED=false` até o armazenamento privado **isolado** ficar configurado
5. **Não usar secrets nem stores do staging**. Não expor valores em logs/issue/PR/chat. Os secrets do GitHub Environment usados para migrar Neon **não são copiados automaticamente** para o Render.
6. Realizar deploy manual de um SHA aprovado. Conferir `/health` (processo) e `/health/ready` (Neon PostgreSQL), sem credenciais na resposta. Ambos precisam retornar status saudável; não considerar somente `health` prova de banco.

## Bootstrap exclusivo de produção
O script histórico `scripts/bootstrap-first-admin.cjs` tem guards fixos de **staging**. Nunca alterá-los para contornar a proteção. Para produção utilizar **somente** `node scripts/bootstrap-production-first-admin.cjs --apply` após teste e autorização, com:
- `NEON_PROJECT_ID=round-bonus-30138797` e `NEON_BRANCH_ID=br-tiny-mud-bb79ybtx`
- `DATABASE_URL` e `DIRECT_URL` do novo Neon, SSL, banco `swimflow`, mesma role/senha
- `SWIMFLOW_PRODUCTION_BOOTSTRAP_ADMIN_APPROVAL=BOOTSTRAP_SWIM_FLOW_PRODUCTION_ADMIN_ONCE`
- `SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED=true`
- `SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL` e `SWIMFLOW_BOOTSTRAP_ADMIN_NAME` configurados **privadamente**
- Serviço de email Resend pronto (`SWIMFLOW_LOCAL_INVITES_ENABLED=true`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SWIMFLOW_AUTH_APP_ORIGIN` apontando para o frontend HTTPS de produção)
- **Antes** de enviar convite, confirmar que a página `/auth/accept-local-invitation` realmente implementa ativação e que o provedor de email está homologado.

O fluxo compartilha a lógica de convite/ativação já testada, não aceita senha inicial, cria uma identidade *pendente*, exige banco vazio, e envia token somente por email. Se o email falhar, verificar pendência e usar `--resend` com os mesmos dados, após aprovação. Não executar esse bootstrap como parte de build, start ou deploy.

## Dados, autenticação e mídia privada
- Banco de produção começa sem contas; login não funciona até bootstrap e ativação.
- Não copiar nem reutilizar JWT key, cookies, Resend token, Blob broker/shared key, media objects ou stores de staging.
- Configurar store e broker **de produção** e homologar upload/download/controle de acesso antes de liberar flags. Testar que as mídias de staging não podem ser lidas em produção.
- Validar 401 anônimo, sessão/refresh/logout, permissões admin/professor e CORS exato do frontend oficial.
- Validar PDF, cadastro, turmas, chamada, avaliações, eventos/resultados e comportamento sem dados.

## Cutover de Vercel (SEPARADO e somente após Go/No-Go)
- Não alterar `swim-flow-dash-staging`.
- Promover o código aprovado de frontend ao canal principal, com commit/versão verificável.
- Alterar apenas `VITE_API_URL` do projeto `swim-flow-dash` (target production) para a URL da nova API, fazer redeploy do artefato aprovado e verificar rotas/credenciais/CORS/login/PWA.
- Preparar rollback de frontend e backend; **não** usar staging como fallback de produção após segregação de dados.

## Verificações locais sem efeitos
- `node --test scripts/bootstrap-production-first-admin.test.cjs`
- `node --test scripts/render-production.test.cjs`
- Ambos também rodam nos gates existentes `npm run bootstrap:first-admin:test` e `npm run render:blueprint:test`.

Rastreadores: [API #142](https://github.com/HenriqueTechPro/swim-flow-api/issues/142) e [Dashboard #70](https://github.com/HenriqueTechPro/swim-flow-dash/issues/70).
