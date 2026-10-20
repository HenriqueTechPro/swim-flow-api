# 02D-2 — NestJS e Prisma testados com PostgreSQL descartável

## Escopo

Sem criar Neon nem escrever em bases legadas, esta etapa valida a operação
integrada da API contra um PostgreSQL 16 genuíno, iniciado como serviço
efêmero na workflow de GitHub Actions.

A primeira migration versionada de 02D-1 é aplicada no banco vazio
antes de executar `npm run test:db`. A suíte `test/integration/swim-flow.db-spec.ts`
utiliza NestJS com os **repositórios reais**, `PrismaService`,
`RolesGuard` e `PermissionsGuard`.

A **única simulação de autenticação** é a checagem criptográfica do JWT:
o guard injetado traduz tokens de teste `Bearer admin` e
`Bearer teacher` para UUIDs de contas **gravadas no próprio PostgreSQL**.
Nenhuma autenticação ou serviço Supabase externo é chamado.

## Testes de integração que devem passar

1. Cadastro HTTP de aluno com referência de nível/categoria,
   classificação por temporada ACTIVE, matrícula principal e vínculo de responsável.
2. Visibilidade de professor vinculado a turma e ausência de vazamento
   de dados após transferência, sem cache de dados pessoais.
3. Alteração do responsável principal preservando o segundo vínculo.
   Histórico da matrícula anterior mantido.
4. Frequência salva via HTTP, atualização de registro (upsert),
   recusa de matrícula ativa duplicada e 403 do professor fora da turma.
5. Resultados oficiais de piscina e de águas abertas persistidos em
   **tabelas separadas**, tipagem das modalidades, tempos em milissegundos
   e validação de distância negativa por CHECK PostgreSQL.
6. Antropometria: altura, massa e envergadura com valores positivos,
   medidas opcionais NULL, rejeição de valores negativos.
7. Avaliação técnica: score armazenado no template correto e falha da
   FK composta ao tentar utilizar critério pertencente a outro template.
8. Desligamento/reativação via HTTP mantendo histórico e os resultados
   competitivos anteriores, sem exclusão física.

## Execução / segurança

A suíte **não roda** no comando padrão `npm run test:e2e` ou `npm test`.
Ela é invocada explicitamente por `npm run test:db`.

Antes de iniciar a conexão, o teste exige simultaneamente:

- `SWIM_FLOW_TEST_DB=true`
- `DATABASE_URL` apontando para localhost/127.0.0.1, **banco `swimflow`**
- `NODE_ENV` diferente de production
- banco de domínio **vazio** (contagens de Profile, Student, Season e Pool iguais a zero)

Não há TRUNCATE de bancos externos, chamadas ao Neon nem operações
destrutivas no Supabase. O serviço PostgreSQL do GitHub Actions é destruído
ao final do job. Fixtures de validação SQL são removidas antes da suíte.

A workflow também mantém validação de migration, imutabilidade da baseline,
comparação de schema contra a base migrada e deploy idempotente.

## Limitações

- JWT real, autenticação Supabase e upload em storage remoto não fazem
  parte desta suíte; precisam de staging dedicado e fluxos separados.
- Testes de carga/concorrência real, isolamento de transações sob latência,
  pesquisas com muitos atletas e políticas LGPD completas continuam
  pendentes.
- A suíte exercita fluxos importantes, mas não substitui avaliação de
  autorização de todas as rotas nem o aceite do dashboard React.
- Proteger o banco definitivo com backups, permissões mínimas e migrações
  de deploy antes de entrar em produção.
