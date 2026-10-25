# Swim Flow — 02E-16B.3 | Autorização e metadados pendentes

## Retomada da migração

O dashboard não está reproduzindo os GET 401 informados anteriormente.
Não alterar JWT, refresh, Render, Neon, Supabase ou os cookies nesta etapa.

As PRs #53, #55 e #56 já introduziram:
- Política de imagens até 5 MiB, nomes UUID sem PII;
- Configuração S3/R2 no backend desativada por padrão;
- Port de objetos privados e adaptador SigV4 de PUT/HEAD/Range/GET/DELETE;
- Verificador de MIME, tamanho real e assinatura dos primeiros bytes.

O bucket não foi criado/ativado por estas alterações.

## O que esta PR implementa (sem exposição HTTP)

**Autorização de upload:** `PreparePrivateMediaUploadUseCase` usa o papel
ATUAL do perfil carregado no repositório, nunca a role de um JWT ou valor
fornecido pelo cliente. É necessário um perfil autenticado:

- `profile-avatar`: apenas avatar do próprio usuário, inclusive
  professores/usuários; não aceita ID de outro perfil.
- `student-photo`, `teacher-photo`, `parent-photo`: apenas admin
  e somente após confirmar que o cadastro alvo existe.
- Professores não ganham acesso à foto de aluno apenas por saber um UUID
  ou por ter acesso de leitura a classes. A futura ACL por turma/clube
  exige consulta explícita aos vínculos atuais de cada aluno.
- Qualquer outra entrada inválida é negada ANTES de assinar PUT.

**Metadados:** introduz de forma aditiva a tabela
`private_media_objects`, com `PENDING` inicial, ID e chave UUID,
namespace privado, upload actor, dono (recurso), tamanho e MIME
declarados, expiração do ticket e data de verificação futura. A chave
de objeto não contém nome de aluno nem nome original do arquivo.
Não há coluna para URL pública, URL assinada ou credenciais.

- `uploaded_by_id` é um snapshot UUID para auditoria;
  `uploaded_by_profile_id` usa FK opcional `ON DELETE SET NULL`:
  exclusão da identidade não apaga os metadados de auditoria.
- CHECKs PostgreSQL restringem tipo de mídia, namespace, status,
  tamanho 1–5 MiB, expiração e consistência de verificação.
- A criação da linha `PENDING` acontece depois de autorização e
  assinatura interna. Se a assinatura falhar, não há registro;
  se persistência falhar, URL assinada não é retornada.
- Nenhum código é registrado no container Nest ou controller nesta PR.
  Portanto `/api/uploads/signed-url` continua legado, sem habilitar R2.

## O que NÃO está pronto (bloqueadores)

1. **Confirmação após PUT:** a API deve ler HEAD + GET Range e usar
   `verifyPrivateImageObject`. Atualizar `PENDING → VERIFIED` de
   modo transacional e idempotente, considerando replay e sobrescrita da
   URL PUT enquanto está válida.
2. **Persistência em entidades:** armazenar uma referência interna ao
   objeto confirmado, não uma URL GET assinada como string permanente.
3. **Leitura e download:** cada GET assinado exige novamente papel atual,
   vínculo à entidade, estado `VERIFIED` e política de visibilidade
   (foto de menor não é pública).
4. **Limpeza:** excluir arquivos rejeitados, expirados e órfãos, com
   reintento e auditoria; evitar lixo financeiro e PII retida.
5. **Frontend:** trocar o SDK Supabase Storage pelo fluxo seguro
   PUT/confirm/GET e comunicar indisponibilidade de armazenamento.
6. **R2:** criar bucket privado e configurar CORS mínimo para Vercel,
   sem `r2.dev` nem acesso público. Só depois ativar a flag no Render.

## Validação e rollout

- CI da API: TypeScript, lint, Jest, build e Prettier incremental.
- CI PostgreSQL descartável: aplicar todas as migrations versionadas,
  testar restrições reais e preservar snapshot de uploader deletado.
- Requer revisão/merge manual; nenhuma migration executada contra o
  Neon staging nesta PR.
- **Não execute** `prisma migrate deploy` apontando para Neon ainda:
  a API ativa não depende da tabela, e o próximo passo será validar a
  migração e o caminho de confirmação antes de deploy.
- Manter `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED=false`; credenciais S3
  nunca no frontend, chat, prints ou repositório.
- Não remover `VITE_SUPABASE_*` ou SDK Supabase até a migração
  de upload das telas, pois `upload-image.ts` ainda os referencia.
- PR #54 (prévia antiga de política de imagem) sobrepõe o trabalho
  incorporado em #53; não fazer merge sem conciliação explícita.

## Próximo incremento

02E-16B.4: confirmar e rejeitar mídia com checagem de bytes reais,
transição atômica de estado, autorização de leitura, limpeza e testes
de concorrência em banco descartável. Somente após isso considerar
conectar as rotas HTTP e o frontend.
