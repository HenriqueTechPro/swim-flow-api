# Swim Flow API — Checklist de deploy (Render + Neon + Vercel)

> Etapa 02D-7: preparação da API. Este documento **não** significa que
> Neon/Render já estejam provisionados ou que dados tenham sido migrados.
> Ainda usamos Supabase para Auth e Storage até PRs próprias de substituição.

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

- [ ] Criar banco PostgreSQL **vazio** para esta migração limpa.
- [ ] Obter `DATABASE_URL` **pooled** (conexões de runtime) e `DIRECT_URL`
      **direct** (Prisma Migrate), com TLS/SSL.
- [ ] Revisar os SQLs da pasta `prisma/migrations` e confirmar ambiente
      correto antes de escrever. Os testes CI são protegidos para banco
      descartável local; **nunca** executar ferramentas de verificação
      destrutivas sobre Neon.
- [ ] No contexto correto e autorizado: `npm run prisma:migrate:deploy`,
      **uma vez**, somente após validação da conexão e do banco de destino.
- [ ] Confirmar `prisma migrate status`, constraints e índices.
- [ ] Não usar `prisma db push` ou `prisma migrate dev` no deploy.

## 3. Render — Serviço Web NestJS

- [ ] Conectar repositório `HenriqueTechPro/swim-flow-api`.
- [ ] Node 22, build `npm ci && npm run prisma:generate && npm run build`.
- [ ] Start `npm run start:prod`; Render fornece `PORT`, API escuta `0.0.0.0`.
- [ ] `NODE_ENV=production`.
- [ ] Configurar `DATABASE_URL` e `DIRECT_URL` como segredos, **somente no backend**.
- [ ] Configurar `JWT_ACCESS_SECRET` aleatório, >=32 caracteres;
      `AUTH_COOKIE_SAME_SITE=none` e `AUTH_SECURE_COOKIES=true`
      quando frontend e API estão em sites distintos HTTPS.
- [ ] Ajustar `API_CORS_ORIGIN` à(s) origem(ns) exata(s) da Vercel;
      habilitar credenciais somente para essas origens.
- [ ] Configurar `SWAGGER_ENABLED=false` em produção.
- [ ] Temporariamente manter os valores do Supabase **somente enquanto**
      seus fluxos Auth/Storage ainda não tiverem substitutos revisados.
- [ ] Confirmar `GET /health` retorna 200 (processo vivo).
- [ ] Confirmar `GET /health/ready` retorna 200 (round-trip PostgreSQL).
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
