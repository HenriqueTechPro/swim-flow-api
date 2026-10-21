# Swim Flow — Etapa 02D-10 | Neon: preflight de migração sem escrita

## Arquitetura acordada
- React/Vite/PWA hospedados na **Vercel**.
- NestJS + Prisma hospedados no **Render**, após o banco estar pronto.
- **Neon PostgreSQL**, com endpoint pooled em `DATABASE_URL` e direct em
  `DIRECT_URL`.
- Fotos/arquivos em futuro bucket **S3-compatible gratuito**, provedor a definir.
- Supabase Auth e Storage seguem temporariamente em uso: não cortar a
  dependência enquanto não houver alternativas testadas.
  
## O que este PR entrega
Um preflight **sem alterações na base de dados** com dois modos:
- `--check` (ou sem opção): valida localmente os dois URLs e encerra sem
  qualquer acesso à rede; verifica protocolo PostgreSQL, host Neon,
  TLS obrigatório, mesmo projeto/usuário/banco, endpoint pooled para runtime,
  endpoint direto para Prisma Migrate, esquema `public` e proíbe nomes
  de bancos de manutenção (`postgres`, `template0`, `template1`).
- `--connect`: requer uma decisão explícita de quem opera o projeto.
  Conecta ao endpoint `DIRECT_URL` e executa **um SELECT somente leitura**
  no `information_schema.tables` do esquema atual. Somente aprova uma
  base **totalmente vazia**, antes de aplicar a migração baseline inicial.
  Banco com qualquer tabela é bloqueado; nenhum comando de migração é executado.

Erros do Prisma de conexão/inicialização/desconexão são sanitizados para
evitar vazamento de senhas ou endereços em logs. A saída não imprime URL,
usuário ou credencial. A consulta `SELECT` é fixa, sem interpolação.
O preflight não valida conteúdo de tabelas, integridade de índices
nem aplica migracões.

## Passos operacionais futuros (não executados nesta PR)
1. No painel Neon, criar **projeto/banco de teste vazio**, separado de
   qualquer banco existente, sem dados reais.
2. Obter duas URLs da mesma base e usuário: **pooled** e **direct**, ambas
   TLS (`sslmode=require`). Guardar em arquivo `.env.neon.local` que é
   ignorado pelo Git; nunca colar senhas em PR, issue ou conversa.
3. No computador do responsável, com Node 22 e dependências instaladas:
   `npm ci && npm run prisma:generate`.
4. Rodar inspeção local: `node --env-file=.env.neon.local scripts/neon-preflight.cjs --check`.
5. Com autorização explícita para conectar ao banco de teste:
   `node --env-file=.env.neon.local scripts/neon-preflight.cjs --connect`.
6. Inspecionar os SQLs já versionados em `prisma/migrations` e seu
   resultado na CI PostgreSQL 16 descartável, além de executar
   `node scripts/create-neon-baseline.cjs --check`.
7. **Etapa posterior, separada:** aplicar `prisma migrate deploy` apenas
   no Neon vazio que passou no preflight, verificar `prisma migrate status`,
   constraints e `GET /health/ready` da API num Render staging.
8. Validar CORS, cookie HttpOnly, refresh/login, autorização, CRUD com
   dados fictícios e comportamento de cold start da hospedagem gratuita.
9. Somente depois considerar Neon/Render prontos para uso e
   iniciar o projeto de migração de imagens para bucket S3 gratuito.

Não usar `prisma db push`, `prisma migrate dev` ou `prisma migrate reset`
no Neon. Não executar SQL de seed ou testes descartáveis no Neon.
Não configurar migrations automaticamente em `npm run start:prod`.

## Testes e riscos
- `npm run neon:preflight:test` executa testes Node locais sem rede,
  incluindo configuração TLS inadequada, URLs com projetos diferentes,
  host Supabase, tentativa de acesso sem `--connect`, resposta inesperada,
  banco não vazio e falhas do Prisma com erros que contêm senhas.
- O gate `API quality gate` testa o preflight sem usar segredos.
- `PostgreSQL baseline quality gate` segue operando exclusivamente sobre
  PostgreSQL local descartável.
- Um endpoint Neon válido não garante que as URLs são de um projeto
  autorizado. A confirmação do projeto selecionado no painel Neon e o
  aceite humano do banco vazio continuam necessários.
- `--connect` é uma inspeção, não uma autorização para migrar.
- Não há conexão real, alteração de dados, provisionamento Neon/Render,
  alteração de migrations ou uso de bucket S3 nesta PR.

## Checklist de merge
- [x] PR isolada para o preflight Neon sem migrações automáticas.
- [x] Dois modos: validação offline e inspeção explícita somente leitura.
- [x] Validação pooled/direct, TLS e banco vazio.
- [x] Sanitização de falhas e testes automatizados.
- [ ] CI TypeScript, lint, Jest e preflight aprovada.
- [ ] CI PostgreSQL descartável aprovada.
- [ ] Revisão Codex sem P1/P2.
- [ ] Merge manual.
