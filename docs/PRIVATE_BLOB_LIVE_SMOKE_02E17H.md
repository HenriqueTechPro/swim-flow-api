# Swim Flow — 02E-17H | Smoke manual Vercel Blob PRIVATE

## Correção de diagnóstico 02F-06B6 (01/11/2026): Vercel OIDC versus token permanente

**Fato confirmado no store descartável `swim-flow-blob-smoke-ci-only`**: vinculação exclusiva ao `swim-flow-blob-smoke-lab`, modo privado, com variáveis de projeto `BLOB_STORE_ID` e `BLOB_WEBHOOK_PUBLIC_KEY`, mas sem `BLOB_READ_WRITE_TOKEN`. Este é o comportamento das conexões novas por **OIDC** da Vercel desde junho de 2026.

O workflow `private-blob-smoke.yml` foi projetado para **credencial RW estática** de uma instalação legada; a execução de 01/11/2026 falhou em `blob-smoke-disposable-store-and-matching-token-required` **antes de qualquer rede ou upload**. O store continuou vazio. Os testes do passo anterior (`blob:smoke:guard:test`) verificam apenas fixtures sintéticas e **não** validam o secret configurado no GitHub.

**Atenção: não copie `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY`, OIDC JWT nem uma chave Vercel pessoal para `BLOB_SMOKE_READ_WRITE_TOKEN`.** Não gere token falso e não use credenciais de outros stores, do dashboard ou do Render. O workflow continuará falhando de modo seguro sem um RW token *legítimo e vinculado ao store descartável*.

A partir deste PR, os erros são separados sem imprimir credenciais:
- `blob-smoke-read-write-token-missing-oidc-unsupported`: o secret GitHub está vazio/inexistente; workflow exige RW, não OIDC.
- `blob-smoke-read-write-token-invalid`: o valor não tem formato RW, incluindo uso indevido de store ID/OIDC/webhook key.
- `blob-smoke-read-write-token-store-mismatch`: a credencial está vinculada a outro store. Não prosseguir.
- `blob-smoke-disposable-store-and-matching-token-required`: nome/ID de store inválido ou bloqueado.

**Próximo passo arquitetural recomendado:** novo teste manual usando Vercel OIDC *somente em ambiente de laboratório*, por exemplo via CLI autenticado no projeto `swim-flow-blob-smoke-lab` com ambiente explicitamente conectado, sem copiar OIDC de curta duração para GitHub. Manter autenticação do Nest no Render como autoridade e **não** habilitar storage na API nem no dashboard até validar como a API hospedada fora da Vercel obterá credenciais apropriadas. Essa futura adaptação será um PR separado com testes e guardas; não adaptar o workflow GitHub usando secrets de projetos reais.

Referência: https://vercel.com/changelog/vercel-blob-now-supports-oidc-authentication

## Estado e autorização

Etapa implementa um teste live **manual** com uma imagem PNG sintética de
1×1. Nesta PR o live **não foi executado**: não temos token descartável,
e nenhum segredo foi lido ou enviado ao GitHub. O storage de produção
`swim-flow-private-media` permanece intacto. Não mexer em Render, Neon,
Supabase Storage, dashboard ou dados de alunos.

O workflow `.github/workflows/private-blob-smoke.yml` só aceita
`workflow_dispatch` na branch `main`, com aprovação escolhida explicitamente no menu
`I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY` e ambiente protegido
`blob-smoke`. Ele **nunca roda** em push, pull request, merge, CI,
cron ou deploy. Somente o guard OFFLINE é testado no CI normal.

## Atualização 02F-06B6 — laboratório preparado em 01/11/2026

Recursos criados e verificados no time Vercel do Swim Flow:
- Projeto isolado sem Git/deploy: `swim-flow-blob-smoke-lab` (`prj_amGQuKcaOIuLUdlqMYK3ltZRYC43`), com proteção de acesso.
- Blob **privado e descartável**, vazio e ainda sem conexão de projeto: `swim-flow-blob-smoke-ci-only` (`store_pAtHIpXAePc3zgXg`, região `iad1`).
- Store de staging para integração futura, **não usar neste workflow**: `swim-flow-private-media-staging` (`store_PJZzrdBiiVcRyLHj`).
- Projeto frontend staging: `swim-flow-dash-staging`; **jamais conectar o token de smoke a ele**.
- Nenhum token foi extraído, compartilhado com ChatGPT/GitHub ou usado em requests.

**Ações manuais necessárias antes do workflow (não executadas por este PR):**
1. No dashboard Vercel, abra **Storage** e o store `swim-flow-blob-smoke-ci-only`. Vincule exclusivamente ao projeto `swim-flow-blob-smoke-lab` e confira que o token fornecido é **desse** store. Caso a UI ofereça projetos de produção, não selecione nenhum.
2. Em GitHub `HenriqueTechPro/swim-flow-api` → Settings → Environments, crie `blob-smoke` (se ainda não existir), restrinja à branch `main` e habilite revisores quando o plano permitir.
3. Dentro de `blob-smoke`, configure **variables** `BLOB_SMOKE_STORE_NAME=swim-flow-blob-smoke-ci-only` e `BLOB_SMOKE_STORE_ID=store_pAtHIpXAePc3zgXg`.
4. Configure somente nesse ambiente o **secret** `BLOB_SMOKE_READ_WRITE_TOKEN` usando o token do store descartável da Vercel. Não copie o token ao chat, PR, código, variáveis `VITE_*` nem outros projetos.
5. Após merge deste PR e auditoria dos três campos, use Actions → `Private Vercel Blob disposable smoke — MANUAL ONLY`, branch `main`, dropdown `I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY`. Default `DO_NOT_RUN` protege contra acionamentos acidentais.
6. Só declarar PASS se o script confirmar PUT/GET/HEAD, sobrescrita negada e remoção isolada do PNG sintético; se falhar, manter todas as flags privadas OFF e investigar sem expor os segredos.

Não usar `vercel blob create-store` de novo neste passo: **o store descartável já existe**. Não acrescentar método de pagamento nem contratar recursos Pro.

## 1. Crie um armazenamento descartável separado

No painel da Vercel, use uma aplicação/projeto de laboratório
**diferente** de `swim-flow-dash` para não sobrescrever a variável
`BLOB_READ_WRITE_TOKEN` que já existe no dashboard.

Utilize o **Blob store PRIVADO descartável já criado** (não crie outro) chamado exatamente:
`swim-flow-blob-smoke-ci-only`.

- Não utilizar `swim-flow-private-media`, nem qualquer store com fotos
  de pessoas ou finalidade comercial.
- O store deve conter **somente dados descartáveis**.
- Não cadastrar cartão nem contratar plano pago. Se houver qualquer
  pedido de pagamento, **parar** e informar.
- Em conexões **legadas**, o Vercel pode disponibilizar `BLOB_READ_WRITE_TOKEN`.
  Em conexões atuais por **OIDC**, apenas `BLOB_STORE_ID` e outras variáveis públicas
  aparecem. **Não reutilize essas variáveis como se fossem um token RW**;
  esse workflow requer adaptação antes de executar com OIDC. Não conecte o storage descartável a um projeto de produção.

## 2. GitHub Environment separado

No repositório `HenriqueTechPro/swim-flow-api` abra Settings →
Environments, crie `blob-smoke` e limite o acesso à branch `main`.
Se disponível, exija approval/review de ambiente.

Variáveis do ambiente:
- `BLOB_SMOKE_STORE_NAME`: `swim-flow-blob-smoke-ci-only`.
- `BLOB_SMOKE_STORE_ID`: `store_...` **do store descartável** no
  painel da Vercel, nunca o ID do storage principal.

Secret do ambiente:
- `BLOB_SMOKE_READ_WRITE_TOKEN`: token do store descartável, copiado
  diretamente do projeto de laboratório Vercel.

A proteção offline examina o prefixo do token `vercel_blob_rw_`,
extrai seu **store ID embutido** e recusa IDs diferentes do
`BLOB_SMOKE_STORE_ID`. Também recusa expressamente o ID conhecido
de `swim-flow-private-media`, ambientes de produção, tokens automáticos
e a ativação das integrações na API. Um token desconhecido ou inválido
falha ANTES de qualquer solicitação à Vercel.

O nome do store sozinho NÃO é prova de isolamento; use autenticação
criptograficamente vinculada ao ID como descrito.

## 3. Como executar após merge

GitHub → Actions → **Private Vercel Blob disposable smoke — MANUAL ONLY** →
Run workflow:
- Branch: `main`.
- Approval: selecione no dropdown `I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY` (o padrão `DO_NOT_RUN` não executa o job).

Somente o job manual instala `npm ci` e chama
`npm run blob:smoke:live`.

O script cria `private/profiles/<uuid>/<uuid>.png` com apenas um PNG
artificial (nenhum nome ou retrato de aluno). Usa a implementação real
`VercelPrivateBlobStorageRepository` para:

1. Garantir que a chave aleatória ainda não existe.
2. Fazer PUT privado sem overwrite e validar size/MIME/ETag/HEAD.
3. Conferir host/URL do store exato e recusar GET anônimo.
4. GET privado com validação de versão e bytes originais.
5. Confirmar que um PUT repetido não sobrescreve o arquivo.
6. Confirmar que DELETE com ETag errado não afeta a versão original.
7. Excluir **somente o objeto sintético criado** usando o ETag correto.
8. Confirmar ausência por novo HEAD antes de declarar PASS.

Se houver falha após o upload, ele tenta remover **somente a geração
sintética comprovada**. Se a gravação ficou incerta sem ETag, ele **não**
faz DELETE às cegas e recomenda inspeção manual, sem imprimir path,
token ou URL. Sem listagem, exclusão em lote, prefix delete ou cron.

## Limites do teste

- Não prova autorização por aluno/responsável, migração Neon real,
  nem integração web/dashboard.
- Não autoriza ligar uploads reais, remover Supabase ou habilitar GC.
- Depende das garantias efetivas do SDK `@vercel/blob@2.8.2`, em
  especial DELETE condicionado por ETag e HEAD 404. Se o teste falhar,
  o estado seguro é NÃO ativar; investigar sem divulgar segredo.
- O store de laboratório pode consumir alguns bytes/operações da cota
  gratuita. Consulte os limites atuais do plano; sem cartão/pagamento.

Fontes oficiais:
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/docs/vercel-blob/security

Próximo passo após teste PASS: integração HTTP NestJS com controllers
autenticados, validação/rate-limit e chave server-only no Render;
somente depois habilitar o frontend em rollout gradual.
