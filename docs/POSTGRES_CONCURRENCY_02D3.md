# Swim Flow — Etapa 02D-3: concorrência e atomicidade (PostgreSQL real)

Esta etapa acrescenta cenários de **concorrência real contra PostgreSQL 16
descartável**, usando PrismaClient e repositórios de alunos/desligamentos da
aplicação. Não cria tabelas, não usa Neon, não apaga dados externos.

## Cenários executados na CI

1. Duas temporadas tentam ficar ACTIVE simultaneamente. Somente uma
   atualização pode vencer o índice parcial `seasons_one_active_idx`.
2. Dois responsáveis tentam ser principais do mesmo aluno simultaneamente.
   Somente um vínculo principal pode ser persistido. Um segundo responsável
   pode ser cadastrado normalmente como secundário.
3. Duas matrículas principais e dois vínculos idênticos concorrentes:
   apenas um registro válido persiste em cada disputa.
4. Atualização real de aluno falha no FK do responsável *depois* de modificar
   nome e tentar desmarcar o principal antigo. O teste verifica que
   **todas** as alterações foram revertidas, inclusive matrícula.
5. Dois pedidos concorrentes de desligamento no mesmo aluno via repositório
   real: apenas um cria saída vigente; o aluno termina Inativo.
6. Reativação e anulação concorrentes do mesmo desligamento: apenas uma
   pode finalizar; nunca haverá ambos os timestamps preenchidos.
7. Duas pontuações técnicas para mesmo critério e avaliação:
   índice único impede duplicação e preserva exatamente uma resposta.

A implementação exige **exatamente uma operação bem-sucedida** para
cada disputa, com verificação do estado final. Erros inesperados
(sem relação com conflitos ou FK) fazem a CI falhar, não são aceitos
genericamente como resultados esperados.

## Isolamento

O script `scripts/verify-postgres-concurrency.cjs` só executa quando
`SWIMFLOW_DISPOSABLE_DB=yes` e **ambas** `DATABASE_URL` e
`DIRECT_URL` apontam para o banco local `/swimflow`.
Ele utiliza apenas registros fictícios criados no contêiner efêmero da
workflow `.github/workflows/database-quality.yml`.

A workflow roda depois da aplicação da primeira migração e dos
cenários reais da Etapa 02D-2. Um resultado da CI não comprova segurança
contra todas as possibilidades de escalonamento/contenção: recomenda-se
executar também testes de carga/retry e rodar a matriz em diferentes
versões de PostgreSQL antes do rollout.

## Pendências observadas

- Consolidar normalização dos erros Prisma de concorrência em conflitos
  HTTP 409, sem expor detalhes de banco ou produzir falhas 500 em disputas
  legítimas de matrícula e responsável.
- Avaliar necessidade de isolamento Serializable + retry de `P2034`
  nas operações multi-tabela sob carga.
- Toda futura modificação na estrutura do banco exige migração
  **incremental**, mantendo a migration inicial imutável.
- Ainda não criamos o Neon, não fizemos deploy no Render e não usamos
  dados reais de alunos.
