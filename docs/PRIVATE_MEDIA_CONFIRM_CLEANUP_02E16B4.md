# Swim Flow — Etapa 02E-16B.4: confirmação, GET privado e limpeza (SEM ATIVAÇÃO)

Continua o PR #57 / 02E-16B.3 já integrado. Todas as mudanças são **internas**:
sem controller Nest, sem provider, sem frontend, sem credenciais reais de R2 e sem
alteração de autenticação, Render, Neon ou Supabase Storage.

## Fluxo de confirmação (CONFIRM)

`ConfirmPrivateMediaUploadUseCase` recebe somente o ator autenticado e o UUID
de upload. Reconsulta o perfil no banco e exige que o ator seja o uploader
original. Para fotos de aluno/professor/responsável, exige papel atual
**admin** e entidade ainda existente. Para avatar, somente a própria
identidade. Professores não ganham acesso à foto de outro aluno só por UUID.

O objeto permanece **PENDING** durante toda a validade da URL PUT e por um
período adicional de **2 minutos** (`PRIVATE_MEDIA_SETTLEMENT_MS`).
Após esse prazo, a verificação executa:

1. `HEAD` no objeto privado para MIME e tamanho real;
2. `GET Range` de até **64 bytes**, sem buscar o objeto inteiro;
3. `verifyPrivateImageObject` para conferir MIME declarado, tamanho exato
   entre 1 byte e 5 MiB, e assinatura de PNG, JPEG, WEBP ou GIF;
4. `UPDATE ... WHERE id = ? AND status = PENDING AND ticket_expires_at <= cutoff`
   para realizar `PENDING → VERIFIED` atomicamente.

Um upload inválido é marcado `REJECTED` pelo mesmo predicado atômico; falhas
transitórias de rede e HEAD ausente deixam `PENDING` para novo teste ou limpeza.
Repetições em registros `VERIFIED` são idempotentes após revalidar a ACL.
Nenhuma operação usa URL recebida do navegador para acessar o storage.

## GET privado

`RequestPrivateMediaDownloadUseCase` gera URL **somente** se o registro está
`VERIFIED` e a ACL atual autoriza o recurso. O papel é obtido do banco,
não inferido de um JWT antigo. Administradores podem ler fotos dos cadastros
existentes; usuário/professor somente o avatar próprio nesta etapa.
GET assinado deve ser HTTPS e durar **até 60 segundos**. Não é persistido.

**Limite:** uma URL GET já emitida continua válida até expirar mesmo se
o acesso for revogado nesse intervalo. Para revogação imediata, considerar
proxy de leitura controlado sem expor uma URL assinada ao cliente.

## Limpeza (retries/órfãos)

`CleanupPrivateMediaUploadsUseCase` é interno, **sem job agendado**:
- busca em páginas pequenas apenas `PENDING` e `REJECTED` cujo ticket
  expirou mais o intervalo de segurança;
- para PENDING, primeiro faz `PENDING → REJECTED` condicional. Se uma
  confirmação venceu essa disputa, **não tenta DELETE**;
- solicita `DELETE` no bucket privado apenas para objetos REJECTED;
- após sucesso, faz `REJECTED → DELETED`; se a rede ou banco falhar,
  mantém o registro recuperável para reprocessamento;
- nunca busca nem exclui objetos `VERIFIED`.

É essencial restringir qualquer futuro cron por autorização administrativa,
limites, métricas sanitizadas e acesso exclusivo ao storage. Nenhum job
está ligado ao Render ou ao Neon nesta PR. `DELETED` significa que a chamada
S3 DELETE retornou com sucesso; não prova inexistência de versões ou cópias.

## Concorrência, segurança e riscos remanescentes

Os `UPDATE ... WHERE status` do Prisma são `updateMany` atômicos no Postgres,
evitando sobrescrever confirmação bem-sucedida durante limpeza.

**Ainda não adequado ativar em produção:**
- Um PUT assinado pode começar imediatamente antes de vencer o ticket e
  terminar mais tarde. **Esperar 2 minutos não oferece garantia criptográfica
  de imutabilidade do objeto** e pode falhar com uploads de rede muito lenta.
- Um cliente pode tentar sobrescrever o mesmo objeto enquanto a URL PUT
  ainda é válida. Antes do cutover será preciso proteção verificável contra
  sobrescrita, por exemplo upload para chave imutável (ou bloqueio de PUT
  condicional comprovadamente suportado), cópia server-side para chave
  definitiva isolada e versão/ETag consistente, e testes end-to-end reais.
- Magic bytes são um filtro básico, não verificam que a imagem é inteiramente
  decodificável ou livre de conteúdo inesperado. Decodificação e reprocessamento
  seguro da imagem podem ser necessários antes de disponibilizá-la.
- A exclusão de objetos órfãos também exige cuidado com PUT ainda em trânsito.
  Por isso a limpeza real fica desligada até que a imutabilidade seja resolvida.
- `uploadedById` é histórico. A FK opcional de uploader não é autorização.
- Fotos vinculadas às entidades continuam sendo URLs legadas nas colunas
  atuais. Nenhum campo `photo`/`avatarUrl` foi trocado nesta etapa.
- Não há API HTTP, upload/download acessível ou scheduler. Nenhum dado real
  foi alterado. A migração de 02E-16B.3 já existe no repositório; esta etapa
  não cria uma nova migração de schema.

## Quality gates

- `npm ci`, `prisma:validate`, `prisma:generate`, builds, ESLint,
  Prettier incremental, testes unitários e E2E da API.
- PostgreSQL **descartável**: scripts de base existentes e
  `scripts/verify-private-media-lifecycle.cjs` validam condições concorrentes
  e estados, sem rede R2 e sem dados pessoais reais.
- Code review e merge manual; não fazer deploy nem ativar
  `SWIMFLOW_PRIVATE_MEDIA_S3_ENABLED`.
- NÃO habilitar domínio `r2.dev`, não incluir chaves Cloudflare no
  frontend, não remover SDK Supabase nesta etapa.

## Continuação

**02E-16B.5**: estabilização da imutabilidade/identificação da versão
do objeto e testes reais com bucket descartável + privacidade.
Depois **02E-16C**: endpoints autenticados e React em rollout gradual,
**02E-17**: retirada do storage legado com migração/backup apropriados.
