# Swim Flow API — 02D-9 | Padronização incremental de código

## Decisão
A PR #20 foi integrada à `main` com **273 testes da API aprovados**
(223 unitários + 50 E2E), testes PostgreSQL descartáveis e revisão Codex
sem achados. Ativou lint semântico, mas encontrou um legado de mais de mil
erros de formatação. Reformatar toda a API ao mesmo tempo tornaria difíceis
a revisão de regras de negócio e a auditoria de segurança.

Esta fase evita que a dívida visual aumente **sem alterar comportamento,
contratos HTTP, schema Prisma ou autenticação**.

## Novo gate de PR
- `scripts/check-changed-prettier.cjs` enumera via
  `git diff --name-only -z --diff-filter=ACMR` apenas arquivos
  TypeScript `src/**/*.ts[x]`, `test/**/*.ts[x]` e `scripts/**/*.ts[x]`
  alterados entre commits da PR.
- Os refs base/head exigem hashes Git completos (40 caracteres); os nomes
  são passados como argumentos diretos a processos, sem execução via shell.
  Arquivos removidos, JSON, SQL, imagens e documentos não são enviados
  acidentalmente ao Prettier.
- Quando há arquivos TypeScript modificados, o CI roda Prettier 3
  (o **mesmo pacote instalado pelo `npm ci`**), apenas em modo
  `--check`. Não há `--write` nem alterações automáticas no CI.
- Quando não há TypeScript alterado, o comando não executa Prettier.
- `scripts/check-changed-prettier.test.cjs` cobre seleção por diretório,
  nomes com espaços, arquivos repetidos, refs inválidos e casos vazios.
- `API quality gate` continua com lint semântico global. A regra visual
  `prettier/prettier` permanece desabilitada no lint global até
  a remoção gradual do legado.

## Como usar em uma futura PR
1. Execute `npm ci` na sua máquina.
2. Faça suas alterações e commits em uma branch.
3. Para formatar apenas arquivos que a PR mudou, use:
   `npm run format:changed -- <SHA_BASE> <SHA_HEAD> --write`.
4. Revise o diff e faça um novo commit de formatação.
5. O CI sempre roda `--check` na comparação base/head atualizada.
6. Para formatar somente um arquivo, use
   `npx prettier --write src/caminho/arquivo.ts`.

**Observação:** `format:changed` compara versões já commitadas;
alterações não commitadas precisam ser incluídas no commit ou
formatadas via CLI por caminho. `npm run format` antigo ainda
formata `src` e `test` **inteiros**: não o use indiscriminadamente
em PRs de regra de negócio.

## Limites e backlog
- O gate impede regressões visuais em arquivos TypeScript tocados;
  **não significa que todos os arquivos antigos ficaram formatados**.
- Padronizar arquivos legados por módulo em PRs isoladas, sem mudanças
  semânticas; priorizar componentes pequenos e depois repositórios de
  Prisma e testes, sempre com diff visual e os dois CI verdes.
- A futura migração para Neon terá PR própria com preflight de conexão,
  `DATABASE_URL` / `DIRECT_URL`, TLS e autorização explícita.
- Render/Vercel/S3 continuam conforme a arquitetura acordada;
  não houve deploy nem operações em bancos neste passo.

## Checklist
- [x] PR #20 integrada, revisão Codex sem findings.
- [x] Escopo de arquivos formatáveis e segurança de SHA testáveis.
- [x] CLI manual `--write` e CI read-only `--check`.
- [x] Testes com `node:test` sem dependências adicionais.
- [x] Proteção semântica ESLint preservada.
- [ ] API CI de build / teste / gate incremental aprovada nesta PR.
- [ ] PostgreSQL baseline CI aprovada nesta PR.
- [ ] Revisão Codex desta PR concluída.
- [ ] Merge pelo responsável.

**Próximo marco:** preparar o preflight controlado do Neon e o ambiente
staging do Render, enquanto qualquer limpeza visual residual permanece
em PRs pequenas sem afetar o caminho crítico da migração.
