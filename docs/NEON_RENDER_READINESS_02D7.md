# Swim Flow API — Etapa 02D-7 — saúde operacional antes do Neon

## Decisão de infraestrutura, mantida
- Frontend: React/PWA na Vercel.
- Backend: NestJS/Prisma no Render.
- PostgreSQL: Neon, com URL de conexão pooled para runtime e direct
  para migrations versionadas.
- Imagens/arquivos: selecionar bucket gratuito S3-compatible
  **após** estabilização da API e banco Neon.
- Supabase Auth/Storage continuam como dependências de transição.
  A existência de um schema Prisma não significa que auth/storage
  externos estejam desligados.

## Melhorias desta PR
1. `GET /health` segue endpoint **liveness** público e barato:
   verifica apenas que o processo responde, sem tocar no banco. A resposta
   existente foi mantida compatível.
2. `GET /health/ready` é novo endpoint **readiness**, também público,
   mas faz query PostgreSQL mínima `SELECT 1` via `PrismaService`.
   Sem mutação, sem ler tabelas de atletas, sem usar usuários reais.
   - 200: `status=ready`, `dependency=postgresql`.
   - 503: `status=unavailable`; NÃO imprime exception, host, usuário,
     password, dados do banco ou stacktrace na resposta.
   - O header `Cache-Control: no-store` impede servir um status antigo.
3. Cobertura unit/in-memory E2E para sucesso e falha (503), verificando
   que `/health` permanece OK mesmo quando o banco falha.
4. Cobertura PostgreSQL HTTP CI local que executa `/health/ready` no
   banco Postgres descartável, sem conexão com Neon.
5. Documentação realinhada: removidas instruções obsoletas de Railway;
   checklist Render/Neon/Vercel, separação Auth/Storage e fase S3 gratuita.

## Limites do readiness
- `SELECT 1` atesta conectividade/resposta SQL, não integridade das
  migrações nem autorização de escrita. Esses itens são cobertos pelo
  pipeline PostgreSQL com constraints, rollback, E2E HTTP e schema diff.
- Render pode usar `/health` para checar o processo. Para
  confirmar se Neon está disponível depois do deploy, testar
  `/health/ready` manualmente, sem configurar polling muito frequente
  em banco/serverless gratuito.
- Em free tiers a conexão pode ter cold starts, e uma falha temporária
  503 deve ser investigada antes de alterar a configuração.
- Não executamos migration, não provisionamos Neon nem Render nesta PR,
  não inserimos dados e não conectamos nenhum banco remoto.

## Checklist técnico antes do merge
- [x] Endpoint pronto não modifica contratos de CRUD ou JWT.
- [x] 503 sanitizado e no-store sob indisponibilidade da conexão.
- [x] Teste e2e com Prisma stub de sucesso e falha.
- [x] Teste real em PostgreSQL descartável CI.
- [x] README e deploy checklist alinhados à arquitetura acordada.
- [ ] Gate API: TypeScript/build, unit e e2e verdes.
- [ ] Gate PostgreSQL: migração baseline e integração HTTP verdes.
- [ ] Revisão Codex sem P1/P2.
- [ ] Merge validado pelo responsável.

## Próxima etapa
Somente após o merge e o checklist API estar estável:
preparar o **preflight da migração real Neon** (provisionar ambiente
de teste, conferir SSL, pooled/direct, aplicar baseline somente no
banco vazio autorizado, conferir constraints, depois Render staging).
O bucket S3 gratuito entra após concluir o banco/API em deploy.
