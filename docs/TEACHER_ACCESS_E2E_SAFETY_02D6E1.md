# Swim Flow — 02D-6E.1 | Follow-up obrigatório da PR #17

A revisão Codex da PR #17 identificou P2: `test/setup-e2e.ts`
sobrescrevia `NODE_ENV=production` com `test` antes de
`assertDisposableDatabase()`. Assim a suposta barreira de produção não
funcionava quando o suite era inicializado pelo Jest.

## Correção
- A rotina compartilhada de setup agora chama `prepareE2EEnvironment()`.
- Esta função **lança uma exceção** se `NODE_ENV=production` antes de qualquer
  sobrescrita. Em demais ambientes, retorna `test` para preservar setup prévio.
- Testes unitários verificam production, test, development e undefined.
- A dupla proteção do banco PostgreSQL mantém as verificações independentes:
  `SWIMFLOW_DISPOSABLE_DB=yes`, `DATABASE_URL` e `DIRECT_URL` em host
  loopback com path `/swimflow`.

## Checklist da PR
- [x] Isolamento da correção: somente setup de testes, testes e documentação.
- [x] Teste de regressão que falha caso ambiente de produção seja aceito.
- [ ] API CI verde.
- [ ] PostgreSQL HTTP CI verde.
- [ ] Revisão de código aprovada.
- [ ] Merge antes de considerar concluída a validação de 02D-6E.

**Atenção:** não executar testes de integração contra bancos remotos ou reais.
