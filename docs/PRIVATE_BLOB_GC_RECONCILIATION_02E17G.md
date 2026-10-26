# Swim Flow — 02E-17G | Encerramento recuperável da limpeza privada

**Estado de operação:** INATIVO. Esta PR adiciona somente código interno,
schema incremental e testes. Não registra controller, provider Nest, cron,
worker, variável de ativação nem token do Vercel. Os testes usam mocks,
PostgreSQL descartável e arquivos sintéticos; **nenhum Blob real é apagado**.

## Protocolo

1. A etapa 17F reservou apenas imagens não vinculadas há 30 dias,
   alterando VERIFIED -> GC_CLAIMED sob FOR UPDATE, com FK de foto ativa.
2. `ReconcileClaimedPrivateBlobImageUseCase` recusa status não
   GC_CLAIMED, exige BLOB, ETag forte e timestamp de claim válido.
3. `stat(pathname)` usa HEAD privado autenticado. Apenas
   `BlobNotFoundError` significa inexistência: falha de rede, 401,
   timeout, metadado inconsistente ou erro desconhecido **não** significam
   que o objeto foi excluído.
4. Se o objeto existe com **o mesmo ETag** do claim, o serviço solicita
   DELETE condicionado a `ifMatch`. Divergência de ETag interrompe a
   operação, sem excluir outro conteúdo.
5. Consulta novamente HEAD. Apenas ausência confirmada pode seguir para
   `completeClaimedBlobCleanup`; não basta o SDK aceitar o DELETE.
6. CAS PostgreSQL exige media ID, status GC_CLAIMED, provider BLOB,
   mesmo ETag e claim timestamp, sem FK ativa. Atualiza para DELETED
   registrando `cleanup_completed_at`.
7. Queda após DELETE e antes de marcar DELETED mantém GC_CLAIMED no banco.
   Nova execução verifica HEAD; se já não existe, conclui o CAS sem
   repetir a exclusão. Queda ou falha de HEAD mantém claim pendente.
8. DELETED idêntico em nova execução retorna ALREADY_COMPLETED sem
   nova chamada ao provedor. Duas reconciliações concorrentes não
   transformam um conflito de versão em confirmação silenciosa.

## Banco e segurança

Migração **aditiva** `20261026010000_private_blob_cleanup_completion`
introduz `cleanup_completed_at`. CHECKs só permitem DELETED do
provider BLOB com claim anterior e timestamp de conclusão >= claim,
mantendo o ETag como prova de versão. Todas as linhas R2 antigas
mantêm as regras anteriores. A FK continua apontando **apenas** a
status VERIFIED, impedindo reativação de uma imagem excluída.

**Restrições importantes:**
- O protocolo ainda **não foi ensaiado contra uma conta Vercel Blob real**.
  O teste da camada remota é todo mockado; usar um bucket/store descartável
  com dados sintéticos antes de expor qualquer serviço interno.
- HEAD/not found e ETag condicionais dependem de disponibilidade,
  consistência e semântica documentada do Vercel SDK; nunca reinterpretar
  erro de rede como 404. Verificar também mudança de regras do provedor.
- A chave é um UUID opaco criado no servidor e não será reutilizada pela
  aplicação, mas credenciais administrativas do Blob podem modificar
  ou recriar objetos; antes de ativar GC real, revisar observabilidade,
  exclusividade do store, custos/quotas, controle de privilégios, retenção
  e política de recuperação de órfãos sem linha de metadata.
- CDN do Blob pode reter cache por até um minuto depois do DELETE;
  o frontend futuro deverá usar rotas autenticadas com no-store e não
  publicar URL direta.
- Nenhuma migração é aplicada ao Neon de produção neste PR.
- Nenhuma foto do Supabase Storage é tocada ou migrada.
- Fotos de menores exigem permissão atual em cada rota futura.

Fontes oficiais: https://vercel.com/docs/vercel-blob/using-blob-sdk

## Próximas tarefas antes da ativação

1. Ensaio real em store privado descartável e restrito, sem fotos reais.
2. Adicionar auditoria operacional e orçamento/quota guard, opt-in
   explícito por ambiente com kill switch, controle de trabalho serial e
   alarmes sem path/PII; só depois planejar worker.
3. Implementar rotas autenticadas com limite/rate-limit e teste de
   browser, aplicar migrações versionadas com plano de rollback e então
   preparar a integração com o frontend.
