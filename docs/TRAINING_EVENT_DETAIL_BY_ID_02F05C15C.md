# Swim Flow — 02F-05C15C — Treinos/Eventos por UUID (API)

## Achado
As fichas de Treinos e Eventos no dashboard usam `list()` de seus diretórios para descobrir apenas um item. Isso cresce com o total de registros e pode esconder falhas de carregamento atrás de estado falso "não encontrado".

## Escopo
- `GET /api/trainings/:id` e `GET /api/events/:id` sob JWT, `@Roles('admin')` e `trainings:read` / `events:read`.
- UUID inválido = 400; UUID válido ausente = 404.
- Contrato `findById` nos repositórios do domínio, Prisma `findUnique` por índice primário e in-memory para testes; nenhum `listAllPages`.
- Treino inclui instrutor e piscina, com o mesmo `trainingInclude` da lista, garantindo DTO consistente.
- Retorno reutiliza os presenters oficiais, sem quebra de contrato e sem migrações.
- Testes dos casos de uso, E2E de rota, paginação antiga preservada.

## Gate e implantação
1. Aprovar build, semântica, formatação, Jest e E2E e PostgreSQL baseline.
2. Realizar merge manual API e confirmar publicação no Render.
3. **Só depois** migrar `TrainingDetail` e `EventDetail` para os GETs por ID no dashboard, com loaders/retries e testes Chromium próprios.

## Limites
O PR não modifica páginas da aplicação, datas, calendários, professores ou alunos. As relações complementares destas páginas serão auditadas no próximo corte para que não exista dependência inadvertida de listas globais.
