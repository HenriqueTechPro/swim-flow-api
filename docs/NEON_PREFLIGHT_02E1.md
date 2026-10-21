# Swim Flow API — Etapa 02E-1 | Pré-verificação segura do Neon

## Status e escopo
- PR #21 integrada, porém o Codex identificou um achado P2 pós-merge:
  o diff de arquivos alterados deve partir do merge-base, não comparar duas
  pontas divergentes. Esta etapa corrige isso e adiciona um preflight
  estritamente local, anterior a qualquer migração Neon.
- Nenhum banco foi provisionado, consultado ou modificado.
- A API continuará hospedada no Render, o PostgreSQL no Neon, o dashboard
  na Vercel. Supabase Auth/Storage permanecem operacionais até substituição
  específica; depois será escolhido bucket S3 gratuito.

## Hotfix da revisão da PR #21
- `scripts/check-changed-prettier.cjs` passou a usar `git diff base...head`,
  ou seja, diff do merge-base até o head da PR, evitando capturar alterações
  feitas somente na branch base depois da criação da feature.
- O teste de regressão cria um Git local temporário, altera um arquivo
  TypeScript somente na branch base e confirma que uma PR docs-only não
  exige formatação do arquivo alheio.
- O gate existente de Prettier não foi desabilitado.

## Preflight de URLs do Neon — somente leitura
- `npm run neon:preflight` inspeciona `DATABASE_URL` e `DIRECT_URL`
  exclusivamente no processo local (sem conexão de rede).
- `DATABASE_URL`: endpoint Neon **pooled** para o Prisma runtime.
- `DIRECT_URL`: endpoint Neon **direct** para Prisma Migrate.
- Ambas precisam ter PostgreSQL, usuário, senha, nome de database,
  hostname Neon e TLS explícito `sslmode=require` (ou mais forte).
- O validador rejeita banco diferente e endpoints incompatíveis.
- **Não imprime segredos nem URLs completas.** Mensagens de erro exibem
  apenas os nomes dos campos e o requisito descumprido.
- `npm run neon:preflight:test` executa testes apenas com URIs fictícias;
  a CI usa esse comando e nunca exige credenciais Neon reais.

## Sequência operacional quando o ambiente Neon estiver disponível
1. Criar um ambiente Neon vazio dedicado à validação; guardar as URLs
   exclusivamente em variáveis/secret manager do serviço.
2. Executar `npm run neon:preflight` no contexto privado, garantindo
   pooled/direct e SSL.
3. Validar o schema e histórico de migrations **offline**
   com `npm run prisma:validate` e
   `node scripts/create-neon-baseline.cjs --check`.
4. Confirmar **manualmente**, de forma independente, que o banco/branch
   Neon escolhido está vazio e corresponde ao destino autorizado.
5. Revisar o SQL versionado, snapshot e rollback. Fazer backup quando
   houver qualquer dado a preservar.
6. Só então aplicar `npm run prisma:migrate:deploy` sob autorização
   explícita e conferir `prisma migrate status` / integridade.
7. Provisionar Render staging, inserir as variáveis de ambiente
   protegidas e verificar `GET /health` e `GET /health/ready`.
8. Testar CORS, sessão, cookies HTTPS e operações com dados fictícios.
9. Em etapa posterior, migrar storage para S3 compatível gratuito.

## Limites de segurança
- Preflight **não** testa conexão, permissões, existência de tabelas,
  histórico Prisma, integridade de dados nem garante banco vazio.
- O nome do domínio e par de URLs pode ser sintaticamente coerente,
  porém apontar para o ambiente errado. Exige revisão humana.
- Nenhuma migration roda no startup da API nem neste script.
- Nunca usar `db push` em produção ou apagar dados reais para corrigir drift.

## Checklist
- [x] Corrigir finding P2 da PR #21.
- [x] Teste de regressão com branches Git divergentes.
- [x] Script de preflight read-only, sem credenciais em logs.
- [x] Testes de URLs pooled, direct, SSL, hostname, segredo e endpoints.
- [x] CI adicional de preflight sem acessar Neon.
- [ ] API quality gate aprovado nesta PR.
- [ ] PostgreSQL baseline quality gate aprovado nesta PR.
- [ ] Codex sem findings prioritários.
- [ ] Merge manual.
- [ ] Criar ambiente Neon vazio e realizar verificação operacional autorizada.
