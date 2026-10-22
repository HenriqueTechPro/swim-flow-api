# Swim Flow — 02E-9I | Aplicação manual da migração local no Neon staging

**Estado:** automação preparada, **não executada no Neon principal**.

## Estado real conferido (22/10/2026)

- Projeto Neon `swim-flow-staging`, ID `raspy-breeze-33258358`.
- Branch principal `staging`, ID `br-gentle-wildflower-b7qrnd74`; database `swimflow`.
- 31 tabelas de aplicação; duas tabelas de auth local **ainda ausentes**.
- Só a migração `20261020000000_init_neon` consta em `_prisma_migrations`; nenhum perfil nem sessão.
- A migração incremental foi validada em uma **branch temporária separada** `br-mute-fire-b7rqfrhs`, não na principal.
- PR #41, contendo o executor Prisma com validações rígidas, foi mesclada à `main`.
- O workflow da PR desta etapa **não dispara por merge, push, PR ou agendamento**.

## Preparação obrigatória no GitHub (antes de clicar em Run workflow)

1. Faça revisão e merge da PR desta etapa.
2. Abra `HenriqueTechPro/swim-flow-api` → **Settings → Environments**.
3. Crie/configure o environment com o nome **exato** `swimflow-neon-staging`.
4. Configure **required reviewers** (aprovação manual por responsável, quando disponível) e
   **deployment branches = Selected branches: main**. Confirme que a proteção funciona.
5. Adicione as duas **environment secrets**, nunca repository variables ou arquivos versionados:
   - `SWIMFLOW_STAGING_DATABASE_URL`: conexão PostgreSQL **pooled** do Neon staging.
   - `SWIMFLOW_STAGING_DIRECT_URL`: conexão PostgreSQL **direct** do mesmo endpoint.
6. Ambas devem apontar ao banco **swimflow** do projeto/branch staging, usar
   `sslmode=require` ou mais forte e `schema=public`. Não publicar nomes de usuário,
   senhas, strings de conexão ou prints dos segredos.
7. Confirme que não há dados reais e que a aplicação não usa esse banco para tráfego ativo.

## Execução *somente com autorização específica*

1. Acesse GitHub → **Actions** →
   **Apply Neon staging local auth migration (manual)** → **Run workflow**.
2. Selecione **main**. No campo `confirmation`, digite exatamente
   `APPLY_SWIM_FLOW_LOCAL_AUTH_STAGING`.
3. Autorize o environment protegido, se a revisão for solicitada.
4. O job confere repo, branch, confirmação, URLs, IDs e checksums, e realiza
   `prisma migrate deploy` por meio do executor versionado
   `npm run neon:local-auth:staging -- --apply`.
5. Confere após a escrita: 33 tabelas de aplicação, duas migrações concluídas,
   9 constraints de auth local, zero identidades e zero tokens, mais
   `prisma migrate status` aprovado.

**Segredos reais são injetados só nas etapas de preflight e aplicação.**
A geração do Prisma Client usa URLs fictícias, sem conexão de rede.

## Acompanhamento e contingência

Se qualquer etapa falhar, **não executar novamente às cegas**. Conferir com
consultas somente-leitura a situação de `_prisma_migrations`, das duas tabelas,
constraints e índices, e investigar o erro antes de outra tentativa. O relatório
do executor suprime detalhes que poderiam conter URLs ou credenciais privadas.

Após sucesso, conferir diretamente na branch principal Neon:
- `_prisma_migrations` contém exatamente as migrations
  `20261020000000_init_neon` e `20261021000000_local_auth_identity_foundation`,
  com checksums completos, status concluído e sem rollback;
- `local_auth_identities` e `local_auth_action_tokens` existem e estão vazias;
- índices, CHECKs e FKs locais conferem com a migration SQL do Git;
- `profiles`, `students` e `auth_sessions` continuam sem dados importados;
- **não** criar usuários de verdade até testar login local, flags e CORS em staging.

## Dependências posteriores

1. Bootstrap seguro do primeiro administrador, somente após migration concluída.
2. Configurar Render staging e `/health/ready`, autenticação local, e-mail e CORS.
3. Validar em staging com usuários fictícios.
4. Desligar Supabase Auth e Storage apenas após substituições testadas, incluindo S3.

Branches de teste Neon `br-mute-fire-b7rqfrhs` e
`br-restless-field-b7oz99tj` continuam preservadas; sua exclusão
requer pedido/aprovação explícita.

**Limitação:** este PR cria o caminho de execução; não configura
automaticamente environments, reviewers ou secrets e não executa a migração real.
