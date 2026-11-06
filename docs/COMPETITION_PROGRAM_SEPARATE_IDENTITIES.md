# Swim Flow — Identidade de programação esportiva (Fase A1)

Planejamento: [API issue #113](https://github.com/HenriqueTechPro/swim-flow-api/issues/113).
A PR implanta **somente o alicerce de dados**, com quatro tabelas vazias.
Nenhum endpoint de gravação, consulta pública, homologação ou disparo de
notificação é introduzido nesta fase.

## Fronteiras imutáveis

| Piscina | Águas abertas |
|---|---|
| `PoolProgramRace` / `pool_program_races` | `OpenWaterProgramRace` / `open_water_program_races` |
| `PoolProgramHeat` / `pool_program_heats` (série/bateria) | `OpenWaterProgramStart` / `open_water_program_starts` (largada/onda) |
| estilo, distância em metros, piscina exata (DECIMAL 6,2), categoria/sexo regulamentar | percurso identificável `routeKey`, corpo d'água e formato de águas abertas; categoria/sexo regulamentar |
| `PoolResult` e rankings PB **não alterados** | `OpenWaterResult` **não alterado** |

As provas são identificadas por **UUID**, ligadas a `Event.id`, e têm
unicidade `(eventId, sessionCode, raceNumber)` **em cada disciplina**.
Série ou largada têm seu próprio UUID e unicidade pelo número dentro da
prova. `sessionCode` é identificador explícito de sessão, não horário
presumido. `plannedStartAt` é opcional e UTC com timezone, não presume
que a prova foi publicada. Não há inferência por nome, data ou tempo.

`categorySnapshot` registra **categoria de disputa** histórica;
`genderScope` é o sexo regulamentar da prova (`MASCULINO`, `FEMININO`
ou `MISTO`), **não** o valor atual em `Student.gender`. Uma prova mista
não autoriza classificar individualmente atletas de sexos diferentes.
Revezamento por equipe permanece sem resultados oficiais nesta fase.

As novas FKs usam `RESTRICT`: evento com prova não pode ser excluído
silenciosamente; prova com série/largada não pode ser excluída enquanto
associada. Checks exigem números e distâncias positivos e identificadores
não vazios. **Nenhuma FK nova ou UPDATE/DELETE sobre `pool_results`,
`open_water_results` ou `student_season_categories`.**

## Segurança de migração

O SQL versionado é **aditivo**: cria enum e quatro tabelas vazias,
índices/FKs/checks; não faz backfill. Executar a verificação do
GitHub Actions *PostgreSQL baseline quality gate* em banco descartável,
incluindo migrar duas vezes, sem diferença de schema. O script
`scripts/verify-competition-program-postgres.cjs` exige
`SWIMFLOW_DISPOSABLE_DB=yes` e host localhost/127.0.0.1; verifica
separação, colisões, FKs, checks e contagem inalterada de resultados
legados. **Não executar manualmente no Neon** nesta etapa: revisar o
impacto do merge no Render/Neon antes de liberar deploy de migração.

## Próximas fases (PRs independentes)

1. Contratos administrativos e persistência de prova/série/largada com
   validação da identidade do evento e dos snapshots regulamentares.
2. Associação **opcional e explícita** de cada resultado à prova e bateria/
   largada da **mesma disciplina**, garantindo incompatibilidade entre
   evento, formato, distância, piscina/percurso e categoria; sem backfill.
3. Homologação auditável: autoria, revisão, publicação e revogação
   explícita, impedindo tempo/posição histórico de mudar sem reabertura.
4. Consulta oficial somente dos resultados homologados, totalmente
   separada de melhores marcas históricas e colocações registradas.
5. [Issue #116](https://github.com/HenriqueTechPro/swim-flow-api/issues/116):
   notificações internas idempotentes para publicação/alteração de
   programação e homologação, sem disparo externo automático.

Esta PR **não altera nenhum resultado, recorde, evolução, categoria do
atleta, relatório anterior ou registro financeiro**.
