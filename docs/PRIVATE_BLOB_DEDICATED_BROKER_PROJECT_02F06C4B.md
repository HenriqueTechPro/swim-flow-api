# Swim Flow — 02F-06C4B | Projeto OIDC de homologação criado (sem deploy)

## Recursos criados e verificados em 01/11/2026

**Projeto Vercel dedicado:** `swim-flow-private-blob-broker-staging`

- ID: `prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`
- Organização/team: `team_ONfSvrgCkVLlDaKIeFuPlrEL`
- Criado sem repositório Git conectado e **sem deployments**.
- Nenhuma credencial HMAC, acesso a banco ou env adicional foi criada.
- **Store privado correto:** `swim-flow-private-media-staging` / `store_PJZzrdBiiVcRyLHj`, com 0 objetos, 0 bytes e **nenhum projeto conectado** na última consulta.
- O laboratório descartável `swim-flow-blob-smoke-lab` e o dashboard de homologação **não** foram alterados.

## Segurança adicional

`scripts/private-blob-broker-readonly-receiver.cjs` agora exige que **ambos** os identificadores Vercel sejam exatamente os do novo projeto/organização:

- `VERCEL_PROJECT_ID=prj_n2mFk76ZGhn5A8wnhpb7Asj8WKjz`
- `VERCEL_ORG_ID=team_ONfSvrgCkVLlDaKIeFuPlrEL`
- `SWIMFLOW_BLOB_BROKER_PROJECT_ID` deve ser o ID real **e não uma cópia auto-consistente de projeto arbitrário**.

Nenhuma funcionalidade de fotos foi ativada. O receptor permanece apenas em `scripts/`, sem função HTTP publicada.

## Inspeção segura a seguir — Vercel Dashboard

Não publicar ou conectar o dashboard principal. Antes de qualquer deploy do broker:

1. Na Vercel, acesse `Storage → swim-flow-private-media-staging → Projects`.
2. Se houver opção para associar o store existente, escolha **somente** `swim-flow-private-blob-broker-staging` e **somente Preview**; não inclua Production ou Development. Essa ação é *futura* e exige revisão humana do estado e das variáveis recebidas.
3. Inspecione as variáveis em `Settings → Environment Variables`, **sem revelar valores**: OIDC requer `BLOB_STORE_ID` e `VERCEL_OIDC_TOKEN`; nunca copie um OIDC para Render.
4. Não configure ainda `SWIMFLOW_BLOB_BROKER_READONLY_ENABLED=true`, `SWIMFLOW_BLOB_BROKER_SHARED_KEY` ou banco de nonces.
5. **Não faça deploy** de `api/probe` enquanto não existir um banco de nonces real isolado, validação do receptor, limites de requisição e a chave compartilhada distribuída por um canal seguro.
6. Antes de decidir pelo broker, verifique se a Vercel oferece **RW estático legítimo, gerado pelo serviço, exclusivo do store de homologação**, para o servidor externo Render. Se disponível, o adaptador atual pode eliminar o broker; não copiar tokens de outros stores.

## Risco e rollback

- O novo projeto Vercel **não recebe tráfego**: sem deployment e sem repositório Git associado.
- Nenhum comando de carga, migração, alteração Render ou escrita de Blob foi executado.
- O PR só altera a validação de identidade da implementação offline. Para reverter o PR, voltar a versão anterior não exige alterações de banco ou exclusão de objetos (embora perca a fixação mais estrita).
- Se o projeto dedicado for abandonado, pode ser excluído separadamente após conferir que nunca recebeu credenciais, domínios customizados ou storage exclusivo.

**Próximo gate:** vínculo de store Preview revisado, decisão real sobre token RW versus OIDC intermediado, nonce persistido em ambiente separado e teste de HEAD sintético autenticado. Nenhum dado de aluno antes disso.
