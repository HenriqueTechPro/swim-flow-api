# Swim Flow — banco de dados v2 (sem deploy)

## Decisão

A primeira migração SQL para Neon será gerada **somente após** concluir as revisões de domínio. Este PR modifica o schema Prisma, mas **não** executa migrations, não acessa o Supabase e não migra dados.

Este primeiro recorte modela avaliações longitudinais e reforça as associações N:N existentes. A API HTTP atual continua usando os modelos legados: o dashboard ainda não expõe avaliações antropométricas/técnicas.

## Avaliações — arquitetura

- `AnthropometricAssessment`: uma coleta por data, com medidas independentes e opcionais em **cm** e **kg**, data efetiva, professor avaliador opcional e histórico por aluno. Não há unicidade por dia: medições repetidas podem ser auditadas.
- `TechnicalAssessmentTemplate`: rubricas versionadas (par `name/version`). **Não editar critérios de uma versão já utilizada**; criar uma nova versão para mudanças futuras.
- `TechnicalAssessmentCriterion`: critério único por código e versão, estilo opcional (fundamentos podem não corresponder a um nado), limites mínimo/máximo e ordem.
- `StudentTechnicalAssessment`: registro datado, vinculado ao aluno, rubrica e avaliador opcional, com `completedAt` para permitir avaliação ainda em andamento.
- `TechnicalAssessmentScore`: nota opcional e comentário, um registro por critério; duas FKs compostas compartilham `templateId`, impedindo vincular critério de outra versão à avaliação. A aplicação deverá verificar a faixa de notas definida pelo critério.
- `StudentLevelHistory`: alterações de nível em data efetiva, com níveis anterior e novo, e professor opcional. O nível atual no modelo `Student` permanece por compatibilidade temporária.

### Regras de nulabilidade

`NULL` significa **não medido/não avaliado**. Jamais salvar zero ou string vazia como substituto. Valores derivados (IMC e diferença entre envergadura e estatura) são calculados sob demanda e **não são gravados** como fatos originais. IMC infantil exige contextualização específica para idade e sexo; não classificar ou selecionar estilos automaticamente.

### Privacidade por padrão

Medidas de crianças são informações pessoais que exigem acesso mínimo. Futuras consultas comparativas devem usar dados autorizados e agregados, com pequenos grupos protegidos contra reidentificação. Nenhum endpoint público ou ranking corporal foi criado neste PR.

## Integridade para a primeira migration (obrigatório)

Prisma não representa todos os `CHECK` e índices parciais do PostgreSQL. Ao finalizar a modelagem, acrescentar manualmente ao **SQL da primeira migração** e cobrir com testes de banco:

1. Medidas antropométricas presentes > 0, com ao menos uma medida informada.
2. Faixas válidas de critério: `min_score >= 0`, `max_score > min_score` (ou regra da escala formal) e `score` dentro dos limites do critério na camada de serviço.
3. Histórico de matrículas: `from_date <= to_date` quando ambas presentes, uma única matrícula principal ativa por aluno e prevenção de associações simultâneas duplicadas.
4. Apenas um `head_coach` por turma; índices únicos parciais.
5. Continuidade das restrições de `CHECK` dos resultados e treinos, **após remodelar** piscina e águas abertas.
6. Rever `onDelete` e políticas de histórico/retenção antes da utilização com dados reais.

Neste PR, `@@unique` foi acrescentado a `ClassTeacher`, `ClassCategory`, `TeacherCategory` e `ClassSchedule`, porque as migrações SQL antigas já exigiam essas relações únicas.

## Roteiro dos PRs seguintes, antes do banco Neon

1. Separar persistência de resultados de **piscina** e **águas abertas**; refazer chave de comparação, tempos, resultados sem classificação e recordes.
2. Normalizar categorias/temporadas (remover `REFERENCE_YEAR=2026`), histórico de matrículas, responsáveis e vínculo usuário-professor.
3. Criar serviços de aplicação e contratos para inserir/consultar avaliações e preservar notas históricas, com testes de autorização e dados fictícios.
4. Estruturar séries/sessões de treino, distribuição para turmas/alunos, eventos e temporadas.
5. Finalizar índices, FKs e `CHECK` manuais, **gerar/revisar a primeira migration SQL** e testar do zero em PostgreSQL temporário antes de criar o projeto Neon.

## Qualidade

A CI deverá executar `prisma validate`, `prisma generate`, `nest build` e `jest`; executar sem aplicar SQL a qualquer banco. Nenhum teste de integração PostgreSQL foi executado nesta etapa. O script `create-neon-baseline.cjs` existente não deve ser executado até a conclusão do redesenho.
