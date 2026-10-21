# Swim Flow API — Etapa 02E-4 | Primeira migração Prisma, com bloqueios de segurança

**Data de preparação:** 21/10/2026. **Estado:** baseline versionada preparada; **ainda não aplicada** ao Neon.

## Ambiente real verificado
- Projeto `swim-flow-staging`, Neon AWS us-east-1, PostgreSQL 17.
- Projeto ID `raspy-breeze-33258358`; branch staging ID
  `br-gentle-wildflower-b7qrnd74`; banco `swimflow`.
- Endpoint direto: `ep-old-lake-b7qha3a0.c-13.us-east-1.aws.neon.tech`.
- Endpoint pooled: `ep-old-lake-b7qha3a0-pooler.c-13.us-east-1.aws.neon.tech`.
- O pooler estava inicialmente desligado e foi habilitado nesta etapa
  **somente no staging** (sem nenhuma tabela alterada).
- Consultas em 21/10/2026 retornaram zero tabelas e ausência de
  `public._prisma_migrations`. O destino deve ser **rechecado imediatamente
  antes da escrita**, pois esse resultado é temporal.

## Por que não executar a baseline como SQL direto
O arquivo `prisma/migrations/20261020000000_init_neon/migration.sql`
contém **31 CREATE TABLE**, **24 CREATE TYPE** e constraints/índices
customizados. Aplicar isso com `run_sql` no console do Neon não registra
automaticamente o histórico da migração versionada em
`public._prisma_migrations`. O deploy tem que usar
`prisma migrate deploy` do mesmo repositório/revisão que foi testado,
não `db push`, SQL arbitrário nem scripts de seed de produção.

## Executor seguro de uso único
Novo comando: `npm run neon:staging:migrate -- --apply`.

O executor **não roda em CI, build, startup, push ou merge**. Um operador
com acesso autorizado ao staging precisa:

1. Finalizar revisão e merge da PR desta etapa.
2. Selecionar explicitamente o projeto, branch e banco descritos acima
   no console Neon; conferir que são **de staging**.
3. Exportar `DATABASE_URL` (pooled) e `DIRECT_URL` (direct) no ambiente
   privado, com usuário/senha protegidos e `sslmode=require` ou superior.
   **Não compartilhar essas URLs pelo GitHub, chat, CI sem segredo protegido,
   logs, prints ou commit**.
4. Definir `NEON_PROJECT_ID=raspy-breeze-33258358`,
   `NEON_BRANCH_ID=br-gentle-wildflower-b7qrnd74` e
   `SWIMFLOW_NEON_STAGING_APPROVAL=APPLY_SWIM_FLOW_STAGING_BASELINE`
   somente na sessão em que a operação for explicitamente autorizada.
5. Rodar `npm ci && npm run prisma:generate`, seguido de
   `npm run neon:preflight`, `npm run neon:inspect` e
   `node scripts/create-neon-baseline.cjs --check`, antes da aplicação.
6. Executar **somente após aprovação específica**:
   `npm run neon:staging:migrate -- --apply`.

O executor interrompe antes de migrar se:
- Não houver **tanto** o argumento `--apply` quanto a confirmação
  específica e os IDs exatos do projeto e da branch;
- As URLs não apontarem para os **hosts diretos/pooled específicos**,
  banco `swimflow` e TLS;
- O arquivo SQL ou inventário de migrations mudar em relação à baseline
  congelada e versionada;
- O Prisma não conseguir reproduzir a baseline;
- A inspeção SQL detectar objetos já existentes, histórico de migrations,
  falha de conexão ou incoerência entre as duas URLs.

Quando tudo estiver correto, invoca a CLI **Prisma 6 versionada** com
`migrate deploy`, uma única vez e sem comando SQL interpolado, e confere:
- 31 tabelas de aplicação (a tabela `_prisma_migrations` é adicional);
- 24 tipos de enumeração;
- uma única entrada concluída em `public._prisma_migrations`;
- `prisma migrate status` sem migrações pendentes.

Em caso de erro, as mensagens para stdout/stderr são genéricas, evitando
exposição de strings de conexão. **Não repetir o comando às cegas depois
de uma falha ou migração parcial**: é necessário inspecionar o schema
e o histórico com o proprietário do banco.

## Validação automatizada sem Neon de verdade
- `npm run neon:staging:migrate:test` usa respostas simuladas e cobre
  target incorreto, falta de consentimento explícito, TLS, banco ocupado,
  migração prévia, baseline alterada, ordem de operações e pós-verificação.
- O pipeline `API quality gate` executa esses testes, mas nunca passa
  as credenciais do Neon e **nunca roda o comando de deploy**.
- O pipeline `PostgreSQL baseline quality gate` continua aplicando SQL
  versionado somente em PostgreSQL descartável com Prisma, testando HTTP,
  constraints, transações, status e idempotência.

## Próxima etapa (após aprovação da primeira escrita)
Com a primeira migração aprovada e executada, revalidar o resultado no
Neon via queries somente-leitura, conferir tabelas, PKs, FKs, CHECKs,
índices e a entrada oficial `_prisma_migrations`. Somente então publicar
a API em **Render staging** usando secrets do ambiente e endpoint
`/health/ready`.

O frontend permanece na Vercel e Supabase Auth/Storage continua até
substituição dedicada, com bucket S3 gratuito em etapa posterior.

## Checklist
- [x] Projeto, branch e banco staging revalidados por leitura no Neon.
- [x] Pooler do staging habilitado.
- [x] SQL histórico congelado; estrutura prevista inspecionada.
- [x] Executor `--apply` com travas e saída sem segredos implementado.
- [x] Testes simulados de segurança e pós-validação adicionados à CI.
- [ ] CI API e PostgreSQL aprovadas nesta PR.
- [ ] Revisão Codex sem achados importantes.
- [ ] Merge manual desta PR.
- [ ] **Autorização explícita** de primeira escrita em staging.
- [ ] Aplicação de `prisma migrate deploy` no banco Neon e verificação real.
