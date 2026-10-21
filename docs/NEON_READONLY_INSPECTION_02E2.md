# Swim Flow API — Etapa 02E-2 | Diagnóstico real do Neon, somente leitura

## Estado da migração
- PR #24 integrada em 21/10/2026. O preflight anterior validava o formato das
  URLs `DATABASE_URL` (pooled) e `DIRECT_URL` (direct) sem tocar no banco.
- O próximo passo é **confirmar uma conexão real** e obter evidência de que o
  banco apontado é um candidato vazio, antes de permitir migrations.
- Esta PR **não cria projetos Neon, tabelas, roles, usuários, dados, nem deploya
  a API no Render**. Ela adiciona uma ferramenta deliberadamente sem escrita.
- `@prisma/client` versão 6 já é dependência instalada; nenhum pacote novo.

## Executar localmente, com credenciais protegidas
1. Crie ou selecione um **projeto/branch de teste vazio no Neon**.
2. Configure `DATABASE_URL` pooled e `DIRECT_URL` direct no ambiente local
   protegido (ou no gestor de segredos), sem compartilhar essas strings no
   chat, em commits, prints, logs ou workflows públicos.
3. Execute `npm ci && npm run prisma:generate`, em seu computador seguro.
4. Execute `npm run neon:preflight`: apenas sintaxe/SSL/mesmo endpoint.
5. Execute `npm run neon:inspect`: abre e fecha duas conexões e executa
   apenas SQL SELECTs fixos de `pg_catalog` e `current_database()`.
   - `direct = connected`, `pooled = connected`: ambos respondem.
   - `candidateEmpty = true`: não foram encontrados enumerações,
     tabelas, views, materialized views, foreign tables ou sequências
     nos schemas do usuário pesquisados, nem tabela Prisma Migrate em
     `public`. **Não é autorização automática para migrar.**
   - `hasPrismaMigrationTable = true`: a tabela `_prisma_migrations`
     existe; exige auditoria antes de qualquer migração inicial.
   - `userRelations` e `userEnums`: somente **contagens** agregadas;
     não há leitura de registros de alunos, professores, responsáveis.
   - O script usa saída JSON sem host, banco, usuário, URLs ou password.
   - Exit code 2: banco contém objetos de usuário; **parar e investigar**.
   - Exit code 1: URL inválida, conexão falhou ou resposta inesperada;
     **parar e investigar**.
6. Confirme o banco e branch no console do Neon e valide a ausência de
   esquemas adicionais, funções, extensões e histórico, com critério humano.
7. Após revisar baseline versionada e ter aprovação específica para escrever
   no ambiente escolhido, execute `npm run prisma:migrate:deploy`.
   **Este comando não está no script de inspeção e não é chamado na CI.**
8. Verifique `prisma migrate status`, constraints, índices, enumerações,
   HTTP e2e e integridade, depois configure o serviço de staging no Render.

## Segurança
- SQL definido em código (SELECTs fixos). Não usa entrada do usuário como SQL.
- Contagem de objetos via metadados PostgreSQL; apenas nome do DB é comparado,
  **nunca exibido**.
- Sem consulta a registros de aplicação ou inserção de dados.
- Erros brutos do Prisma/SSL podem conter a URL: a ferramenta **não os repassa**
  para stdout/stderr; fecha ambas conexões mesmo em falha.
- `log: []` no Prisma evita diagnóstico automático sensível na console.
- A ferramenta não armazena credenciais e não imprime nomes de projeto/branch.
- `candidateEmpty` é indício conservador, não garantia. Não detecta todos
  os tipos de objeto (por exemplo, funções isoladas e schemas sem tabelas).
  Uma inspeção humana independente ainda é obrigatória.
- A CI executa testes com objetos simulados, URLs fictícias e PostgreSQL
  descartável em pipeline separada. **Não se conecta ao Neon real.**

## Testes da etapa
- `npm run neon:inspect:test`: duas conexões, SQL estático, contagem zero,
  banco ocupado, histórico Prisma, validação cruzada do DB, saneamento
  de erros, fechamento de clientes após falha e não conexão se URL inválida.
- CI de API: build, lint, 223 unitários, 50 E2E, testes de preflight e de inspeção.
- CI PostgreSQL: baseline versionada, constraints, schema e HTTP com banco
  descartável, sem conectar ao Neon externo.

## Checklist para PR
- [x] Ferramenta de diagnóstico sem escrita.
- [x] Classificação conservadora e detecção da tabela Prisma Migrate.
- [x] Testes de simulação e erros sanitizados.
- [x] Nenhum segredo/credencial adicionados ao repositório.
- [ ] CI de API aprovada.
- [ ] CI PostgreSQL aprovado.
- [ ] Review Codex sem achados prioritários.
- [ ] Merge pelo responsável.
- [ ] Inspeção real no Neon de teste, somente quando as ações do conector
  estiverem acessíveis e o destino for identificado sem ambiguidade.

## Próxima etapa — 02E-3
Validar projeto/branch Neon autorizado, estado de schema e histórico,
registrar diagnóstico de leitura; **somente depois** aplicar baseline
versionada em banco vazio e iniciar Render staging.

O frontend continua na Vercel; Auth/Storage Supabase permanecem
temporariamente até substituições separadas e revisadas; depois,
selecionaremos o bucket S3 gratuito.
