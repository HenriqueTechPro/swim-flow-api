# Vínculo explícito de resultados com eventos

Primeiro passo da [prioridade 3](https://github.com/HenriqueTechPro/swim-flow-api/issues/113).
O esquema Prisma já oferece `eventId` opcional para os resultados de piscina e águas abertas. **Nenhuma migração ou backfill** nesta entrega.

## Contrato

`POST /api/results` e `PUT /api/results/:id` aceitam `eventId?: UUID | null`. A resposta e a listagem dos resultados retornam `eventId`.
- Omissão no POST: cria um resultado legado sem vínculo.
- Omissão no PUT: mantém o vínculo anterior.
- `null` no PUT: desvincula de forma explícita.
- UUID: vincula ao `Event.id` selecionado; não há associação por nome/data.

As validações rejeitam evento inexistente, Reunião, Cancelado, data de evento diferente da data do resultado ou temporada incompatível. Se `Event.seasonId` existir, o resultado deve ter o mesmo `seasonId`. Na edição, também se valida o vínculo já gravado.

Eventos já referenciados por resultados não podem ser excluídos, movidos para outra data, convertidos para Reunião ou cancelados. Renomeação e mudanças de descrição/local/horários continuam permitidas; `competitionSnapshot` permanece histórico.

## Limitações

`Event.id` identifica apenas o **evento**, não uma prova ou bateria. Nenhuma homologação oficial, ajuste de posição, cálculo por tempo ou associação de registros antigos foi feita.
O Dashboard continuará com a tela atual até que tenha seleção explícita e confiável de eventos. Futuras consultas podem filtrar resultados vinculados por `eventId`, mantendo um modo legado para registros não vinculados.

As verificações da API evitam mudanças incoerentes, mas a concorrência entre ligação de resultados e exclusão/alteração do evento ainda não utiliza serialização transacional e bloqueio de linha no banco; isso precisa de proteção adicional antes de afirmar atomicidade.
