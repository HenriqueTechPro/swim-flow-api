# Swim Flow — 02F-06C3 | Contrato de autenticação Render → Blob privado (prova offline)

## Decisão e escopo

A API NestJS roda no Render. O storage `swim-flow-private-media-staging` (store `store_PJZzrdBiiVcRyLHj`) é **privado** e, na última inspeção, está vazio e sem projeto Vercel conectado. Os testes OIDC executados localmente em `swim-flow-blob-smoke-lab` NÃO fornecem credenciais permanentes para Render.

A documentação da Vercel admite credencial RW estática em ambiente externo. Porém **ainda não existe credencial RW verificada desse store**. Não transformar token OIDC efêmero em `BLOB_READ_WRITE_TOKEN`, não reutilizar o RW do laboratório e não criar segredo falso no Render.

Duas alternativas de arquitetura permanecem:
1. **Preferencial se a Vercel fornecer credencial RW estática legítima específica do staging:** usar o adaptador server-only existente `VercelPrivateBlobStorageRepository` com autorização e refresh de papéis no Nest, sem novo serviço intermediário.
2. **Alternativa quando só houver OIDC atrelado a projeto Vercel:** serviço privado na Vercel acessa Blob via OIDC e somente aceita solicitações autenticadas de uma API Render. Isso necessita um projeto Vercel específico de homologação conectado a esse store, credenciais de autenticação entre servidores e proteção contra replay com armazenamento durável.

Este PR **não escolhe definitivamente nem ativa** nenhuma das duas alternativas. Implementa a primeira peça **reaproveitável** para validar a alternativa (2): envelope assinado **somente para HEAD em chave sintética**, com testes offline e política explícita de bloqueio.

## Contrato de prova read-only (scripts/private-blob-broker-auth-v1.cjs)

- `createStagingReadOnlyProbe(secret)` gera somente operação `head` em `__swimflow-broker-probe/v1/<uuid>.txt`. Nunca aceita um pathname de aluno, professor ou avatar.
- Campos versão, audiência fixa `swim-flow-blob-staging-broker-v1`, operação, pathname, timestamp em milissegundos e nonce UUID são vinculados por HMAC-SHA256.
- Chave HMAC de **32 bytes aleatórios** codificados em base64url; **não** é token Blob, Vercel API token ou OIDC; não é criada, armazenada, impressa nem enviada por este PR.
- `verifyStagingReadOnlyProbe(secret, envelope, {nowMs, claimNonce})` valida campos exatos, audiência, janela máxima de 30 segundos e assinatura via `timingSafeEqual`; só depois tenta reservar o nonce. Qualquer erro resulta em mensagem fixa sem material sensível.
- `claimNonce` **precisa ser durável e atômico entre todas as instâncias Vercel** (por exemplo, `INSERT` com chave única e expiração de retenção). Um `Set` em memória NÃO serve em deploy serverless. Nenhum verificador pode ser publicado antes desse backend existir e ser testado.
- É proibido usar esse contrato para GET de fotografia, PUT, DELETE, presigned URL, listagem ou chave de mídia.
- Mesmo um HEAD válido **não autoriza** leitura de fotos reais; permissões de aluno, turma, papel e vínculo `VERIFIED` seguem exclusivas dos casos de uso Nest.

## Testes executados pelo CI sem rede ou segredos

`npm run blob:broker:auth:test` cobre:
- path aleatório exclusivamente sintético, ausência de dados do atleta;
- chave aleatória correta, rejeição de OIDC/RW e chave diferente;
- alteração de path, audiência, método, nonce, tempo, versão e assinatura;
- clock skew e expiração;
- nonce ausente, replay, armazenamento indisponível e retornos falsamente válidos;
- mensagens de erro fixas sem impressão de tokens.

Nenhuma operação de Blob, Render, Neon, Vercel ou GitHub Secrets é executada por esses testes.

## Para avançar ao 02F-06C4 (integração de homologação)

1. Conferir primeiro se a Vercel permite obter **token RW suportado** e específico de `swim-flow-private-media-staging` sem afetar contas/planos. Se estiver disponível, usar a alternativa (1) e descartar a necessidade de um broker.
2. Se RW estático não estiver disponível, aprovar explicitamente projeto Vercel de **homologação** para um broker; não usar o projeto de laboratório descartável nem o dashboard principal.
3. Antes de deploy: implementar receptor que usa OIDC nativo do projeto associado ao store correto, armazenamento **durável e atômico** de nonces, limites de corpo, timeouts, rate limits, negação de replay, chave compartilhada separada por ambiente e testes negativos.
4. Executar somente `HEAD` de arquivo sintético inexistente em staging; logs devem exibir códigos fixos, nunca URLs privadas nem tokens.
5. Para fotos reais haverá PR distinto com autorização Nest atual, transação/compensação e streaming privado. Manter `SWIMFLOW_PRIVATE_BLOB_ENABLED=false` e flags do dashboard privadas OFF até testes E2E aprovados.
6. Cotas: respeitar Hobby, sem cartão e sem ativação paga.

**Rollback:** código não está importado em nenhum provider e não publica nenhum endpoint: basta revertê-lo, sem migrations ou objetos de storage.

Fontes:
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/docs/rest-api/projects/generate-a-project-oidc-token

**Não há credencial, configuração Render, integração Vercel ou upload liberado nesta etapa.**
