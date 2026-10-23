# Swim Flow API — Checklist de deploy (Render + Neon + Vercel)

> Atualizado em 22/10/2026: **33 tabelas de aplicação e duas migrações**
> Prisma estão aplicadas ao Neon staging, sem registros de aplicação. A API no Render
> ainda não foi publicada e o banco de produção não existe.
> Supabase Auth e Storage continuam temporariamente ativos.

## 1. Antes do deploy: checks sem acessar serviços externos

- [ ] Revisar os commits aprovados e a migration inicial versionada.
- [ ] `npm ci`
- [ ] `npm run prisma:validate`
- [ ] `npm run prisma:generate`
- [ ] `node scripts/create-neon-baseline.cjs --check`
- [ ] `npm run build`
- [ ] `npm run test:all`
- [ ] Confirmar CI `API quality gate` e `PostgreSQL baseline quality gate` verdes.
- [ ] Nunca versionar `.env`, URLs de banco, segredos de JWT ou credenciais S3.

## 2. Neon — PostgreSQL (somente após aprovar a API)

- [x] Criar banco PostgreSQL staging em Neon AWS us-east-1, sem importar dados legados (21/10/2026).
- [x] Obter `DATABASE_URL` **pooled** (conexões de runtime) e `DIRECT_URL`
      **direct** (Prisma Migrate), com TLS/SSL.
- [ ] Revisar os SQLs da pasta `prisma/migrations` e confirmar ambiente
      correto antes de escrever. Os testes CI são protegidos para banco
      descartável local; **nunca** executar ferramentas de verificação
      destrutivas sobre Neon.
- [x] Aplicar a baseline SQL versionada `20261020000000_init_neon`
      ao staging em transação, com pré-verificação de banco vazio.
      A operação foi realizada via conector Neon (não pela CLI Prisma),
      registrando `_prisma_migrations` com o checksum SHA-256 exato
      da migração original. Ver `docs/NEON_STAGING_BASELINE_APPLIED_02E5.md`.
- [x] Em 22/10/2026, executar `npm run prisma:migrate:status` com Prisma 6
      e credenciais privadas no Windows: **2 migrations found** e
      **Database schema is up to date!**. Não executar novamente o executor
      **de primeira baseline** no banco agora ocupado. Em migrações
      posteriores, utilizar Prisma Migrate CLI.
- [x] Confirmar via queries Neon as constraints, FKs, índices,
      enumerações, tabelas e checksum no histórico Prisma.
- [x] Confirmar `prisma migrate status` pela CLI Prisma 6 em ambiente
      seguro conectado ao staging (concluído em 22/10/2026).
- [ ] Não usar `prisma db push` ou `prisma migrate dev` no deploy.

## 3. Render — Serviço Web NestJS

**Etapa 02E-6:** o serviço de staging está definido no `render.yaml`.
A configuração é **somente para staging**, plano free, Virgínia, Node 22,
sem criar outro PostgreSQL nem aplicar migrations no startup.
Antes de criar o Web Service, seguir
`docs/RENDER_STAGING_SETUP_02E6.md` para vincular GitHub ao Render e
preencher secrets via interface protegida. O Render ainda não foi publicado.


- [ ] Conectar repositório `HenriqueTechPro/swim-flow-api`.
- [ ] Node 22, build `npm ci --include=dev && npm run prisma:generate && npm run build`.
- [ ] Start `npm run start:prod`; Render fornece `PORT`, API escuta `0.0.0.0`.
- [ ] `NODE_ENV=production`.
- [ ] Configurar `DATABASE_URL` e `DIRECT_URL` como segredos, **somente no backend**.
- [ ] Configurar `JWT_ACCESS_SECRET` aleatório, >=32 caracteres;
      `AUTH_COOKIE_SAME_SITE=none` e `AUTH_SECURE_COOKIES=true`
      quando frontend e API estão em sites distintos HTTPS.
- [ ] Ajustar `API_CORS_ORIGIN` à(s) origem(ns) exata(s) da Vercel;
      habilitar credenciais somente para essas origens.
- [ ] Configurar `SWAGGER_ENABLED=false` em produção.
- [ ] Staging Neon-only: **não** configurar variáveis Supabase no Render.
      A API inicializa e a conectividade PostgreSQL pode ser verificada,
      mas endpoints legados de Auth/Storage retornam 503 até o cutover.
      O login e os uploads devem ser testados apenas após os adaptadores
      PostgreSQL/S3 estarem plenamente substituídos e validados.
- [ ] Confirmar `GET /health` retorna 200 **no Render** (processo vivo).
      No ambiente local, ambos os endpoints já retornaram HTTP 200.
- [ ] Confirmar `GET /health/ready` retorna 200 **no Render** (round-trip PostgreSQL).
- [ ] Sob indisponibilidade de PostgreSQL, `/health/ready` deve retornar
      503 sem detalhes de conexão; `/health` permanece diagnóstico de processo.
- [ ] Para a verificação automática de vida do Render, preferir
      `/health` em vez de executar consultas frequentes no Neon.
- [ ] Testar primeiro acesso após período ocioso (cold start) no plano gratuito.

## 4. Vercel — Frontend

- [ ] Manter `HenriqueTechPro/swim-flow-dash` na Vercel.
- [ ] Configurar `VITE_API_URL=https://<domínio-da-api-no-render>`.
- [ ] Validar CORS, cookies httpOnly, login/refresh/logout e permissões
      entre Vercel e Render em navegadores reais.
- [ ] Testar operações CRUD de atletas, professores, turmas, frequência
      e resultados com **dados fictícios**.
- [ ] Não usar `DIRECT_URL`/`DATABASE_URL` nem tokens privados no Vite.

## 5. Posteriormente: retirar os legados Supabase

- [ ] Substituir login, convite e recuperação de senha do Supabase Auth por
      fluxos apropriados e auditados da API.
- [ ] Selecionar um bucket **compatível com S3 com plano gratuito** para
      fotos de alunos, professores, responsáveis e avatares.
- [ ] Migrar uploads/downloads com URLs assinadas e limites de tamanho.
- [ ] Eliminar SDKs/envs Supabase somente após os fluxos substitutos
      estarem em produção e testados.

**Fonte técnica detalhada:** `docs/RENDER_NEON_MIGRATION.md`.
