# Swim Flow — Etapa 02E-16B.3: ACL e metadados privados no Neon (SEM ATIVAÇÃO)

## O que mudou
- `PrivateMediaAccessRepository` + `PrismaPrivateMediaAccessRepository`: verificação do perfil autenticado e relações **atuais** de turma, aluno e professor antes de autorizar uma operação.
- `PrivateMediaRecordsRepository` + `PrismaPrivateMediaRecordsRepository`: registro `media_objects` com ID UUID interno, `object_key` privado, `target`, `resource_id`, emissor, MIME, tamanho declarado, expiração, status e auditoria.
- `RequestPrivateMediaUploadUseCase`: valida entrada, checa ACL, grava `PENDING` e somente **depois** gera PUT assinado de curta duração com o adapter privado.
- `RequestPrivateMediaDownloadUseCase`: recusa objeto ausente, `PENDING`, `REJECTED` ou `DELETED`; para `CONFIRMED`, revalida ACL do recurso em tempo real antes de chamar a assinatura GET.
- Migração **aditiva** `20261025000000_private_media_objects` com relação ao perfil, índices, unicidade, limites de MIME/tamanho e restrições para chaves opacas.
- Testes offline para ACL, uso de metadados, negativa e revogação de atribuição e credenciais somente após persistir.

## Matriz de acesso (novo fluxo **isolado**, ainda sem endpoints)

| Recurso | Admin | Teacher | User |
| --- | --- | --- | --- |
| `profile-avatar` | somente próprio perfil | somente próprio perfil | somente próprio perfil |
| `student-photo` | aluno existente | aluno atualmente matriculado em turma do professor ativo e vinculado ao perfil | negado |
| `teacher-photo` | professor existente | somente ficha do próprio professor ativo e vinculado ao perfil | negado |
| `parent-photo` | responsável existente | negado | negado |

Permissões diferem das rotas legadas: **nenhum controller novo foi registrado**. O professor ainda não tem `uploads:write` nas permissões HTTP da aplicação. A ativação exigirá uma permissão específica ou ajuste revisado do guard e do contrato; esta PR não concede novas permissões públicas.

A ACL **não** usa cache em consultas de professores. `teacher` sem `profileId` ativo, aluno transferido (`toDate != NULL`) ou sem atribuição tem acesso negado. Para os casos negados, a aplicação retorna erro genérico, sem revelar se existe um menor associado àquele UUID.

## Proteções

1. Sem URLs públicas ou assinadas no banco. Dados de imagem nunca são gravados como bytes no Neon.
2. Identificador privado aleatório, sem nome original do arquivo ou outro PII na chave.
3. PUT assinado **após** inserção do registro PENDING; falhas após inserção deixam registro pendente, para limpeza na 02E-16B.4.
4. GET somente para objeto CONFIRMED com nova autorização; nesta etapa **não existe** serviço que confirme PENDING.
5. URLs S3 assinadas são credenciais temporárias; depois de emitidas, a revogação do vínculo não invalida imediatamente a URL já entregue (TTL máximo de 60s).
6. O recurso `resource_id` é polimórfico e **não tem FK** para Student/Teacher/Parent. Nunca consultar o objeto usando apenas esse UUID: verificar existência e autorização na tabela de destino a cada operação.
7. A assinatura PUT restringe Content-Type declarado, **não comprova** tamanho ou bytes do arquivo. Somente a etapa 02E-16B.4 poderá marcar como CONFIRMED após HEAD + Range + magic bytes e tratar uploads concorrentes.

## Migração e qualidade

- `prisma/migrations/20261020000000_init_neon` permanece inalterada; esta é uma migração incremental.
- O CI roda migrações contra PostgreSQL descartável, valida schema/migration diff e testa contratos. **Não executamos migrações no Neon real nesta PR.**
- Antes de ativar: revisão de migração, backup/retorno planejado e `prisma migrate deploy` controlado no Neon de staging; verificar contagens e constraints.
- Objetos privados podem impedir exclusão de perfis por FK RESTRICT até limpeza/retenção explícita: decidir política de exclusão e privacidade antes de ativar.

## O que NÃO mudou
- `HttpModule`, controllers, endpoints, Supabase Uploads, frontend, JWT, cookies e variáveis do Render.
- O adapter S3 da 02E-16B.2 permanece sem injeção no container Nest.
- `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED` deve continuar **false**; nenhuma conta/bucket/credencial Cloudflare foi criada, testada ou ativada.

Próxima etapa: **02E-16B.4** — confirmação segura e idempotente (HEAD, Range, magic bytes), estados e cleanup de pendentes/órfãos; só depois **02E-16C** — HTTP/UI privados com rollout gradual, e **02E-17** — remoção do Supabase Storage.

PR antigo #54 relacionado à mesma fundação está aberto; **não fazer merge do #54 sem primeiro revisar duplicidade**, pois #53/#55/#56 já foram integradas.
