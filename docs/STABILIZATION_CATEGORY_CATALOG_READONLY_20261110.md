# Swim Flow — estabilização 01: reconciliação de categorias (somente leitura)

**Conferido em 10/11/2026. Escopo: staging Neon, API Render, GitHub.**
Este documento não autoriza executar migrações, modificar Neon, alterar Render ou publicar em produção.

## Evidência observada (Neon staging, consulta SELECT)

- Projeto: `swim-flow-staging`, branch default `staging`.
- 28 registros em `categories`, com 28 nomes distintos; somente 27 posições distintas de ordenação.
- `Sênior`: `sort_order=11`, enquanto a migração versionada define 12.
- `Master B`: `sort_order=12`, enquanto a migração versionada define 15.
- `_prisma_migrations`: 10 migrações concluídas, sem falhas; a migração `20261108130000_complete_swimming_category_catalog` **não está registrada**.
- 6 professores cadastrados, 1 com CREF preenchido; nenhum registro foi modificado nesta auditoria.

## Por que apenas reaplicar o catálogo não resolve tudo

A migração da PR API #124 faz `INSERT ... ON CONFLICT (name) DO NOTHING`.
Ela preenche categorias faltantes sem trocar IDs, mas **não corrige sort_order de registros existentes**.
O Neon já contém todas as categorias; o problema restante é o registro pendente da migração
no histórico Prisma e a divergência de metadados de ordenação.

**Não** editar a migração já versionada (checksum e rastreabilidade), não executar SQL manual
para marcar a migração como aplicada e não usar `prisma db push` ou `migrate dev` em staging.

## Ferramenta somente leitura proposta nesta PR

```bash
npm run catalog:readonly:test   # utiliza respostas fictícias; sem rede e sem credenciais
npm run catalog:readonly:audit  # exige DATABASE_URL + DIRECT_URL corretamente configuradas
```

O comando de auditoria conecta apenas no endpoint direct validado, confere o banco selecionado,
lê as categorias e o histórico Prisma com três comandos `SELECT` fixos e fecha a conexão.
Retorna JSON somente com catálogo, discrepâncias e status de migração; não imprime credenciais,
endereços de banco, IDs de alunos/professores ou dados pessoais. Código de saída 2
indica divergência; código 1 indica falha de inspeção.

Para inspecionar manualmente, sem credenciais na saída, executar em conexão administrativa
aprovada apenas as consultas abaixo:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM public._prisma_migrations
WHERE migration_name = '20261108130000_complete_swimming_category_catalog';

SELECT name::text, age_min, age_max, sort_order
FROM public.categories
ORDER BY sort_order, name::text;
```

## Etapa seguinte — **exige aprovação separada**

1. Desativar o auto-deploy efetivo do Render staging antes de uma sequência de migrações (a configuração efetiva ainda estava `autoDeployTrigger=commit` em 10/11, embora `render.yaml` defina `off`).
2. Confirmar no painel protegido que a conexão do Render aponta para o **mesmo banco e branch** do Neon staging, sem compartilhar URL ou segredos.
3. Fazer backup/branch de segurança conforme a política do projeto e testar o rollout em PostgreSQL descartável.
4. Após autorização expressa, executar o fluxo versionado Prisma `migrate deploy` para registrar a migração pendente. O SQL existente é idempotente, mas conferir novamente seus efeitos antes da execução.
5. **Separadamente**, propor uma nova migração revisada para corrigir metadados de ordenação existentes (e demais divergências apontadas pelo auditor); nunca modificar IDs ou vínculos históricos de categorias, professores, alunos e resultados.
6. Executar auditoria novamente e somente depois aprovar deployment manual Render, smoke `/health`, `/health/ready` e CRUD de professores com grupos Júnior, Sênior e Master.

## Observação Render e CI

Em 10/11, Render `swim-flow-api-staging` estava **live** no commit
`c058c6c63f0a56b77c72af1b461d55ccd26999e7` (PR #124), com `autoDeploy=yes`,
`autoDeployTrigger=commit` e `healthCheckPath` vazio. O `render.yaml` já prescreve
`autoDeployTrigger: off` e `healthCheckPath: /health`. Reconciliar a **configuração
real pelo painel**, não por um merge especulativo; esta PR não muda o YAML nem chama a API de deploy.

Esta PR só acrescenta auditoria, testes offline e documentação. **Não executar
`catalog:readonly:audit` em CI com credenciais reais**. Os pipelines executam
exclusivamente `catalog:readonly:test` com mocks.
