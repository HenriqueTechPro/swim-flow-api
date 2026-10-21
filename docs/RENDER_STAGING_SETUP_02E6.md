# Swim Flow API — Etapa 02E-6 | Render staging (Neon + Vercel)

## Estado confirmado

- PRs #28 e #29 integradas ao repositório `HenriqueTechPro/swim-flow-api`;
  Codex concluiu ambas sem apontamentos.
- Banco Neon **staging**: projeto `swim-flow-staging`, branch `staging`,
  database `swimflow`, PostgreSQL 17, AWS `us-east-1` (Virgínia).
- Schema inicial presente: 31 tabelas de aplicação, 24 enums e histórico
  `_prisma_migrations` registrado com checksum; os registros de aplicação
  permaneceram vazios após a implantação, sem importação do Supabase.
- O schema foi aplicado por transação SQL versionada com registro manual
  compatível com Prisma, **não pela CLI Prisma Migrate**. É obrigatório
  executar `prisma migrate status` num runtime seguro e confirmar
  consistência antes de habilitar o app para usuários.
- Frontend existente na Vercel: `swim-flow-dash`, domínio publicado
  `https://swim-flow-dash.vercel.app`.
- Render **ainda não conectado/implantado** nesta etapa. Conectar conta
  GitHub ao Render e preencher segredos exige ação do responsável.

## Dois tipos de conexão: não confundir

1. **Render com GitHub**: permite criar/deployar o Web Service com o
   código de `HenriqueTechPro/swim-flow-api`.
   - Vá ao [Render Dashboard](https://dashboard.render.com/) e entre.
   - Abra **Account Settings → Git Deployment Credentials → Add credential**
     e escolha **GitHub**; autorize o acesso ao repositório.
   - Se o repo não aparecer, confira em GitHub → Settings → Applications →
     Installed GitHub Apps → Render → Configure → Repository access. Garanta
     que `HenriqueTechPro/swim-flow-api` esteja permitido.
2. **Render com ChatGPT**: app/plugin Render no ChatGPT, independente do
   GitHub. Se disponível para a conta, instale/conecte em **Settings →
   Plugins → Render** ou no catálogo pela barra lateral. O usuário
   precisa concluir pessoalmente a autorização dessa integração; isso
   não impede criar o Web Service diretamente pelo Render Dashboard.

## Opção recomendada: Render Blueprint (`render.yaml`)

1. Faça merge da PR da etapa 02E-6 após CI e revisão Codex.
2. No Render Dashboard vá em **New → Blueprint** e escolha
   `HenriqueTechPro/swim-flow-api` (branch `main`).
3. Selecione o arquivo `render.yaml` no diretório raiz.
   Ele descreve **um único Web Service** `swim-flow-api-staging`,
   runtime Node 22, plano free, região `virginia`,
   `healthCheckPath: /health`.
   **Não cria banco Render** nem roda migrações automaticamente.
4. Preencha os secrets solicitados na tela inicial do Blueprint
   (variáveis `sync: false`). Copie-os diretamente dos painéis
   protegidos dos provedores: não envie valores privados pelo chat.
5. Confira os valores e inicie a sincronização inicial.
   A criação inicial pode iniciar o **primeiro build/deploy** mesmo
   com `autoDeployTrigger: off`. A opção `off` bloqueia futuros
   deploys automáticos em commits, não dispensa validação inicial.
6. No Render, confirme **Environment**, **Deploys** e **Logs**
   (cuidado ao compartilhar logs; podem conter dados sensíveis).
7. Acesse `https://<dominio-real-do-servico>.onrender.com/health`
   e `/health/ready`: ambos devem responder HTTP 200.
   **Nunca invente a URL**; use o endereço dado pelo Render.
8. Configure o Vite frontend na Vercel com `VITE_API_URL` apontando
   para a URL HTTPS real da API; redeploy da Vercel quando
   estiver preparado para testar integração.
9. Teste em Chromium/Android PWA login, refresh, logout, cookies
   httpOnly, CORS e permissões com **dados fictícios**.

## Segredos e configurações

| Nome | Origem / valor esperado |
| --- | --- |
| `DATABASE_URL` | Neon → Connect → **pooled URL** da branch staging, DB swimflow, SSL |
| `DIRECT_URL` | Neon → Connect → **direct URL**, mesmo banco/role, SSL |
| `API_CORS_ORIGIN` | `https://swim-flow-dash.vercel.app` (origem exata, sem barra final) |
| `JWT_ACCESS_SECRET` | Gerado automaticamente pelo Render Blueprint, guardar privado |
| `VITE_SUPABASE_URL` | Supabase URL atual usada pela autenticação de transição |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável atual do Supabase |
| `SUPABASE_SECRET_KEY` | Chave **secreta do servidor** usada nos fluxos legados Auth/Storage |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `SWAGGER_ENABLED` | `false` |
| `AUTH_COOKIE_SAME_SITE` | `none` |
| `AUTH_SECURE_COOKIES` | `true` |
| `AUTH_COOKIE_PATH` | `/api/auth` |

`SUPABASE_SERVICE_ROLE_KEY` é um fallback legado: **não configure duas
chaves administrativas** se `SUPABASE_SECRET_KEY` funcionar no projeto.

**Não** colocar `DATABASE_URL`, `DIRECT_URL`,
`SUPABASE_SECRET_KEY`, `JWT_ACCESS_SECRET`, cookies privados ou
outras credenciais em `VITE_*`, em `.env` versionado, nas opções
públicas da Vercel ou no repositório.

O endereço Vercel e o Render `onrender.com` são de **sites
diferentes**; cookies `SameSite=None; Secure` podem ser bloqueados
por restrições do navegador a third-party cookies. Se isso ocorrer,
planejar domínios de mesma propriedade (ex. app.example.com,
api.example.com) antes de liberar usuários reais. Não reduzir as
proteções do cookie para contornar bloqueios.

## Opção alternativa: criar Web Service manualmente

Se a importação de Blueprint falhar por permissão de GitHub:
- Render → **New → Web Service → Git Provider → Connect**;
- Repositório `HenriqueTechPro/swim-flow-api`, branch `main`;
- Runtime Node, plano `Free`, região `Virginia`;
- Build: `npm ci && npm run prisma:generate && npm run build`;
- Start: `npm run start:prod`;
- Health Check Path: `/health`;
- Environment: preencher as mesmas variáveis da tabela acima;
- Auto Deploy: desabilitado para este estágio inicial.

Não confundir `/health` (processo) com `/health/ready`
(acesso real ao PostgreSQL).

## Limitações do plano gratuito e aceite

- Render Free pode suspender um Web Service depois de 15 min sem
  tráfego; a retomada no primeiro acesso pode ser lenta.
- O Neon tem sua própria política de compute ocioso.
- Não use serviço free como ambiente de produção com dados reais.
- A API ainda tem adaptação Supabase Auth/Storage **ativa**;
  a migração de banco não removeu esses provedores.
- Não executar `prisma migrate deploy`, `prisma db push` ou seeds
  automaticamente no build/start do Render.
- Há uma verificação de consistência Prisma CLI ainda pendente.
- O Render pode exigir autorização GitHub ou escolha do workspace
  para habilitar a integração; isso deve ser resolvido na conta.

## Checklist

- [x] Configuração `render.yaml` isolada e sem segredos.
- [x] Node 22 / Node process 0.0.0.0 / Render PORT priorizado.
- [x] Health check /health e readiness /health/ready existentes.
- [x] CORS e cookies definidos para HTTPS inter-site staging.
- [x] Não cria PostgreSQL Render, nem migra schema automaticamente.
- [x] Testes de Blueprint incluídos no quality gate da API.
- [ ] API quality gate + PostgreSQL baseline gate desta PR aprovados.
- [ ] Revisão Codex, merge manual.
- [ ] Render conectado ao GitHub e secrets configurados pelo responsável.
- [ ] `prisma migrate status` confirmado com credenciais Neon em ambiente privado.
- [ ] Build/deploy Render saudável; /health e /health/ready em 200.
- [ ] Integração dashboard Vercel e fluxos críticos testados.
