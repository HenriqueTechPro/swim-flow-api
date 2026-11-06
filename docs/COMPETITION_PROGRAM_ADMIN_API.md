# Swim Flow — API administrativa de programação esportiva (Fase A2)

Após a [PR #117](https://github.com/HenriqueTechPro/swim-flow-api/pull/117)
e migração já aplicada no projeto Neon `swim-flow-staging`,
a programação recebe APIs administrativas **distintas por modalidade**.

**Somente ADMIN autenticado com permissões `events:read` /
`events:write`.** Não são rotas públicas; nenhum resultado é publicado
como oficial ou homologado. Contratos são estritos e bloqueiam chaves de
outra modalidade.

## Endpoints

| Piscina | Águas abertas |
|---|---|
| `GET/POST /api/competition-program/pool/races` | `GET/POST /api/competition-program/open-water/races` |
| `GET/POST /api/competition-program/pool/heats` | `GET/POST /api/competition-program/open-water/starts` |

As listagens de provas exigem `eventId` (UUID real); as de baterias
exigem `raceId`. Paginação `page=1&perPage=20` (máximo 100).
Consultas não carregam todas as provas e não buscam rankings PB.

Exemplo de prova de piscina (POST /pool/races):

```json
{
  "eventId": "88888888-8888-4888-8888-888888888888",
  "sessionCode": "MANHA",
  "raceNumber": 4,
  "style": "Livre",
  "distanceMeters": 50,
  "poolLengthMeters": 20,
  "format": "INDIVIDUAL",
  "categorySnapshot": "Petiz 2",
  "genderScope": "FEMININO"
}
```

Exemplo de águas abertas (POST /open-water/races):

```json
{
  "eventId": "88888888-8888-4888-8888-888888888888",
  "sessionCode": "MANHA",
  "raceNumber": 1,
  "distanceMeters": 1500,
  "bodyType": "SEA",
  "routeKey": "trajeto-oficial-2026",
  "format": "TRAVESSIA",
  "categorySnapshot": "Master A",
  "genderScope": "MISTO"
}
```

As séries/largadas recebem `raceId`, `heatNumber` ou
`waveNumber` positivo, e horário `plannedStartAt` ISO8601 com offset
opcional. Número, hora e categoria pertencem à prova regulamentar
e não são inferidos pela idade atual do atleta.

### Integridade

- Somente evento `Competicao` ou `Festival`, nunca reunião/cancelado.
- Conflito de número de prova/série na mesma sessão → 409.
- Eventos com programação não podem ser cancelados, excluídos, convertidos
  em reunião ou ter sua data alterada sem revisão da programação.
- Piscina não aceita `routeKey` nem `bodyType`; águas abertas não
  aceita `poolLengthMeters` nem `heatNumber`.
- Nenhuma alteração de `PoolResult`, `OpenWaterResult`, PB, resultados
  registrados, histórico de temporada ou categorias.
- A FK/validação de evento não permite escolher outro UUID de modalidade
  como se fosse uma bateria da modalidade errada.

**Limites:** ainda não há atribuição de atletas/raias, homologação
oficial, publicação para os pais nem notificações externas.
Os dados de prova/bateria permanecem planejamento interno.
Próxima PR: vincular resultados por IDs explícitos de prova e bateria
na mesma modalidade e verificar categoria/estilo/curso/percurso;
depois implementar revisão e homologação auditável.
