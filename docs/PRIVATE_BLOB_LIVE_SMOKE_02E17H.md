# Swim Flow — 02E-17H | Smoke manual Vercel Blob PRIVATE

## Estado e autorização

Etapa implementa um teste live **manual** com uma imagem PNG sintética de
1×1. Nesta PR o live **não foi executado**: não temos token descartável,
e nenhum segredo foi lido ou enviado ao GitHub. O storage de produção
`swim-flow-private-media` permanece intacto. Não mexer em Render, Neon,
Supabase Storage, dashboard ou dados de alunos.

O workflow `.github/workflows/private-blob-smoke.yml` só aceita
`workflow_dispatch` na branch `main`, com aprovação digitada
`I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY` e ambiente protegido
`blob-smoke`. Ele **nunca roda** em push, pull request, merge, CI,
cron ou deploy. Somente o guard OFFLINE é testado no CI normal.

## 1. Crie um armazenamento descartável separado

No painel da Vercel, use uma aplicação/projeto de laboratório
**diferente** de `swim-flow-dash` para não sobrescrever a variável
`BLOB_READ_WRITE_TOKEN` que já existe no dashboard.

Crie um **novo Blob store PRIVADO** chamado exatamente:
`swim-flow-blob-smoke-ci-only`.

- Não utilizar `swim-flow-private-media`, nem qualquer store com fotos
  de pessoas ou finalidade comercial.
- O store deve conter **somente dados descartáveis**.
- Não cadastrar cartão nem contratar plano pago. Se houver qualquer
  pedido de pagamento, **parar** e informar.
- Ao conectar Blob ao projeto de laboratório, o Vercel cria a variável
  `BLOB_READ_WRITE_TOKEN` nesse projeto. Transfira o **valor** para o
  secret do GitHub *diretamente nas interfaces*, nunca no chat, commit
  ou prints. Não conecte o storage descartável a um projeto de produção.

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
- Approval: `I_APPROVE_DISPOSABLE_PRIVATE_BLOB_SMOKE_ONLY`.

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
