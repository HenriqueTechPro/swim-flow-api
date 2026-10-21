# Swim Flow API — 02E-3 | Provisionamento e auditoria somente leitura no Neon

Data: 21/10/2026 (UTC-3). **Ambiente: staging, não produção.**

## O que foi realizado

- Projeto Neon criado: `swim-flow-staging`.
- Região: AWS `us-east-1` (Virgínia), PostgreSQL 17.
- Branch default: `staging`; database: `swimflow`.
- Inspeção via conexão do Neon, **somente leitura**, mostrou:
  - zero tabelas, views, sequences ou demais relações de usuário em `public`;
  - zero enumerações no schema `public`;
  - `public._prisma_migrations` inexistente;
  - somente o schema `public` listado entre schemas de usuário;
  - catálogo de tabelas do Neon vazio.
- Nenhum dado de aluno, professor ou responsável foi exportado do Supabase.
- **Nenhuma migração Prisma foi executada.**
- Nenhuma credencial do Neon foi copiada para Git, CI, docs ou chat.

## Como evitar aplicar SQL ao destino errado

Antes de uma escrita real, o operador deverá:
1. Reconferir a conta, o projeto `swim-flow-staging`, a branch `staging`
   e o database `swimflow` no console do Neon.
2. Obter a URL **pooled** para `DATABASE_URL` (runtime) e a URL
   **direct** para `DIRECT_URL` (migrations), sempre com TLS.
3. Armazenar ambas somente em ambiente/gerenciador de segredos seguro.
4. Rodar `npm ci`, `npm run prisma:validate`,
   `npm run prisma:generate`, `npm run neon:preflight` e
   `npm run neon:inspect`; revalidar as contagens antes da escrita.
5. Executar `node scripts/create-neon-baseline.cjs --check` para
   confirmar a baseline congelada e revisar o SQL versionado.
6. Obter aprovação explícita para aplicar schema no staging identificado.
7. Executar **somente então** `npm run prisma:migrate:deploy` e
   verificar `prisma migrate status`, constraints e índices.
8. Depois validar `GET /health/ready` e fluxos HTTP de teste no Render.

## Importante

O resultado de hoje é uma fotografia pontual: antes de migrar,
revalidar o mesmo banco/branch. Um banco sem tabelas em `public`
não autoriza apagar outros dados nem executar scripts destrutivos.

API hospedada futuramente no Render; dashboard mantido na Vercel;
Supabase Auth/Storage ativo apenas como compatibilidade transitória.
Storage S3 gratuito continua etapa posterior.

## Estado da etapa

- [x] PR #25 integrada à `main`.
- [x] Projeto Neon staging provisionado em us-east-1.
- [x] Database `swimflow` e branch `staging` identificados.
- [x] Inspeção de metadados exclusivamente leitura realizada.
- [x] Evidências básicas de ausência de tabelas/migrations registradas.
- [ ] Revisão da PR documental e merge.
- [ ] Aprovação explícita para a **primeira migração de schema no Neon**.
- [ ] Aplicação da baseline e verificação pós-migration.
- [ ] Deploy da API no Render.
