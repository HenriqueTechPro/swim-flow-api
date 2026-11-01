# Swim Flow — 02F-06B7 | Teste Blob PRIVATE por OIDC, local e descartável

## Por que um fluxo separado

O workflow GitHub `private-blob-smoke.yml` exige um token RW legado que não é fornecido pela conexão moderna Vercel Blob. Não alterar nem enfraquecer esse workflow: ele permanece manual e bloqueado sem seu tipo de credencial. A alternativa desta etapa é **usar credenciais OIDC efêmeras fornecidas ao processo local pela Vercel CLI**, sem criar funções web, sem publicar endpoint e sem armazenar segredos no repositório.

## Identidade de laboratório fixa

- Time: `team_ONfSvrgCkVLlDaKIeFuPlrEL` (`henriquetechpros-projects`).
- Projeto de laboratório sem deploy: `swim-flow-blob-smoke-lab` (`prj_amGQuKcaOIuLUdlqMYK3ltZRYC43`).
- Store privado descartável: `swim-flow-blob-smoke-ci-only` (`store_pAtHIpXAePc3zgXg`).
- Store `swim-flow-private-media-staging` e armazenamento de produção: **proibidos para este teste**.

O script verifica **antes de importar o SDK** o arquivo local `.vercel/project.json`, as IDs do time/projeto e o `BLOB_STORE_ID`. Recusa credenciais RW estáticas, ambientes de produção, flags privadas ativas e falta de aprovação manual. O GitHub CI executa apenas o guard offline; nunca executa o teste de upload.

## Diagnóstico 02F-06B8 — falha genérica do SDK no Windows

A execução local com Node 24 e `.env.local` parou em `FAIL: blob-oidc-failed-review-privately`. O código anterior ocultava qual operação SDK falhou; portanto **não** é possível concluir se ocorreu problema de autenticação, rede, SDK ou HEAD. O store descartável foi verificado vazio (0 objetos). Um erro separado de sintaxe do PowerShell aconteceu por colar `try` sem quebra de linha e não é problema do Blob.

**Primeiro, atualize a `main` após o merge deste PR e execute o teste OFFLINE.** O comando `blob:smoke:oidc:preflight` exige o mesmo guard de projeto/store/OIDC/aprovação, mas faz somente um `HEAD` de chave sintética aleatória inexistente. **Não realiza PUT nem DELETE.** Mensagens de erro incluem apenas etapa + classificação ou código HTTP permitido: nunca o texto da resposta SDK, token, URL ou caminho do objeto.

Na raiz da API, em PowerShell com Node.js 24:

```powershell
git switch main
git pull --ff-only
npm run blob:smoke:oidc:test
vercel env pull --environment=preview
$env:BLOB_OIDC_SMOKE_APPROVAL = "I_APPROVE_DISPOSABLE_PRIVATE_BLOB_OIDC_SMOKE_ONLY"
try {
    node --env-file=.env.local scripts/verify-private-blob-oidc-live.cjs --preflight
}
finally {
    Remove-Item Env:BLOB_OIDC_SMOKE_APPROVAL -ErrorAction SilentlyContinue
}
```

O esperado é `PASS: disposable Blob OIDC read-only HEAD preflight; no upload attempted.` Caso falhe, **não execute** `--execute`: compartilhe somente o código estático `blob-oidc-...`, sem copiar tokens, arquivos `.env` ou logs verbosos do SDK.

`blob-oidc-preflight-head-http-403` significa que a autorização foi rejeitada; `blob-oidc-preflight-head-sdk-or-network-error` indica que HEAD falhou, sem provar a causa. O teste com escrita só deverá ser retomado depois de resolver o preflight e confirmar o isolamento do laboratório.

## Executar SOMENTE no VS Code (Windows PowerShell), após merge e CI verde

1. Abra o terminal na **raiz de `swim-flow-api`**; confira que está com a `main` atualizada e sem alterações locais relevantes. Execute `npm ci` e `npm run blob:smoke:oidc:test`.
2. Instale e autentique a Vercel CLI, se necessário: `npm install -g vercel` e `vercel login`. Não envie tokens ou prints de variáveis ao chat.
3. **Vincule o diretório somente ao projeto de laboratório:**

   ```powershell
   vercel link --yes --project swim-flow-blob-smoke-lab --scope henriquetechpros-projects
   ```

   O arquivo `.vercel/project.json` é local e está no `.gitignore`. Nunca executar `vercel deploy`, `vercel --prod`, nem ligar a API Render a esse projeto.
4. Verifique na Vercel que o store descartável está conectado ao laboratório em **Preview** e que não há armazenamento real ligado ao projeto.
5. Para permitir **uma única execução** no PowerShell:

   ```powershell
   $env:BLOB_OIDC_SMOKE_APPROVAL = "I_APPROVE_DISPOSABLE_PRIVATE_BLOB_OIDC_SMOKE_ONLY"
   vercel env run -e preview -- npm run blob:smoke:oidc:live
   Remove-Item Env:BLOB_OIDC_SMOKE_APPROVAL
   ```

   Esse comando injeta `BLOB_STORE_ID` e `VERCEL_OIDC_TOKEN` no processo sem exigir que você cole o token. O SDK lê e atualiza a credencial OIDC, **sem receber token manualmente**. O script só acessa o store de laboratório e cria um PNG artificial de 1 × 1 pixel em um caminho aleatório.

6. Se o resultado for `PASS: disposable Blob OIDC...`, consulte na Vercel que o store continua vazio (contadores da interface podem demorar a atualizar). Não habilite as flags do frontend por causa do PASS.

## Verificações de segurança

- PUT privado, HEAD e GET autenticado; bytes retornados iguais aos dados sintéticos.
- GET anônimo deve ser negado.
- PUT repetido nunca pode sobrescrever o objeto.
- DELETE com ETag errado falha sem alterar o objeto.
- DELETE com ETag correto remove **apenas** o arquivo criado nesta execução.
- Se o upload ficar incerto e não existir ETag verificado, **não** faz DELETE às cegas; reporta necessidade de inspeção humana privada.
- Não imprime token, link do Blob ou path do arquivo. Não executa consultas Neon, Render, Supabase ou API real.

## Falhas que exigem interromper, sem compartilhar segredos

- `blob-oidc-lab-project-link-required`: comando Vercel ligado a outro projeto ou pasta.
- `blob-oidc-disposable-store-id-required`: store diferente ou `BLOB_STORE_ID` indisponível. **Não** force a variável manualmente.
- `blob-oidc-project-token-missing-or-invalid`: a Vercel CLI não injetou identidade OIDC para Preview. Reautentique no projeto correto e verifique a conexão. **Nunca** crie ou cole um token para contornar.
- `blob-oidc-unverified-upload-may-exist` ou `blob-oidc-cleanup-failed`: inspecione somente o armazenamento descartável e não repita até revisar.
- `blob-oidc-failed-review-privately`: erro da API SDK/rede; não ative produção; confira logs sem divulgar segredos.

## Limitação arquitetural importante

PASS aqui **não** autoriza integrar a API NestJS no Render: o OIDC fornecido pela Vercel ao projeto não é automaticamente injetado no Render. Essa integração exige uma decisão separada sobre credencial server-only ou backend Vercel com autorização forte. O adaptador atual de NestJS ainda espera token RW e **não foi alterado**.

Documentação: https://vercel.com/docs/cli/env e https://vercel.com/docs/vercel-blob/using-blob-sdk .
