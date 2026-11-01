# Swim Flow — Etapa 02F-06C1 | Readiness de Blob privado para API Render staging

## Resultado da etapa anterior

O teste local via OIDC **passou** no store descartável `swim-flow-blob-smoke-ci-only`: PUT/HEAD/GET privado, GET anônimo negado, overwrite negado e DELETE ETag condicionado. Após a execução a Vercel confirmou **0 itens / 0 bytes**. Não usar esse store para dados reais.

**Esse PASS não equivale a integração no Render.** O token OIDC curto gerado por `vercel env pull` é vinculado ao ambiente/projeto de laboratório, não é uma credencial permanente da API hospedada no Render. Não colar o OIDC do computador no Render.

## Estado real de staging em 01/11/2026

- API: Render staging (NestJS/Prisma). A implementação de transporte `VercelPrivateBlobStorageRepository` já existe mas **não está registrada como provider Nest nem há rota de upload Blob ativa**.
- DB: Neon staging; não alterar migrations nesta etapa.
- Store privado previsto para homologação: `swim-flow-private-media-staging`, id `store_PJZzrdBiiVcRyLHj`. Confirmado vazio e **sem projeto Vercel conectado** na última inspeção.
- Nenhum token estático RW desse store foi verificado/obtido; a interface Vercel Blob recente utiliza OIDC por padrão para projetos Vercel. Logo **a conexão Render → Blob staging permanece BLOQUEADA**.
- Dashboard staging e produção permanecem com visualização e escrita de media privada desligadas.

## Decisão técnica — integração server-only em Render, sem credenciais no navegador

Caminho de menor complexidade, **condicional**: um `BLOB_READ_WRITE_TOKEN` **válido, estático e específico** do store *staging* é um meio de autenticar o SDK a partir de um servidor externo à Vercel. Esse token deve existir de maneira legítima e ser guardado apenas no cofre de environment variables do **Render staging** (nunca `VITE_*`, repo, GitHub CI, screenshot, chat ou banco). Se não houver maneira suportada de obter credencial estática desse store, **não improvisar token ou converter OIDC temporário em segredo fixo**. Reavaliar uma mediação por backend Vercel com autorização de operação ou outro storage antes de fazer deploy.

Este PR **não** registra provider Nest e **não** implementa broker HTTP. A API continua sendo a autoridade de identidade, papéis, acesso ao aluno e estado VERIFIED. Nenhum link da Vercel Blob é devolvido ao React.

## Contrato de proteção entregue (somente offline até haver credencial legítima)

- `scripts/render-blob-staging-readonly-guard.cjs`: identidade fixa da homologação, flags privadas **desligadas**, isolamento das variáveis do laboratório, formato de token RW com store embutido correspondente. Se a credencial estiver ausente, responde `static-rw-credential-not-configured`.
- `npm run blob:render:staging:check`: classificação **offline**, nenhuma chamada externa; pode emitir `BLOCKED:` com motivo fixo, sem imprimir segredos.
- `npm run blob:render:staging:test`: testes unitários com mock do SDK, rodados no CI; testam negação de produção, de token de outro store, de habilitar flag, e do fluxo HEAD somente leitura.
- `npm run blob:render:staging:readonly`: comando **manual** protegido por aprovação explícita, só executa HEAD de chave aleatória inexistente na homologação e exige token estático correspondente. Não faz PUT, LIST nem DELETE, **não configura Render** e não usa Neon. Não executá-lo enquanto não houver credencial legítima de staging.

## Fluxo de segurança antes de ativar a função

1. Identificar com segurança um método **suportado pela Vercel** para autenticar o servidor externo Render no store de homologação. Não configurar credenciais de produção no staging.
2. Validar o transporte com o HEAD manual **somente com store correto**, sem dados de usuários. Qualquer status diferente de BlobNotFoundError requer diagnóstico antes de prosseguir.
3. Em PR separado, integrar o adaptador via injeção de dependência do Nest com feature flag OFF por padrão, ACL e confirmação VERIFIED em cada leitura, validação/reencoding integral da imagem antes do PUT e compensação DB/Blob.
4. Testes de identidade/turma/responsável e negativas de autorização; limites de tamanho, resposta `Cache-Control: private, no-store`; nenhum link ou credencial ao browser.
5. Testes end-to-end de homologação somente com contas e imagens sintéticas, monitorando armazenamento e custos. Ativação em produção exige aprovação separada.

**Rollback:** enquanto a feature flag não for habilitada, nenhum endpoint, request ou upload adicional existe. Em eventual integração futura, desligar `SWIMFLOW_PRIVATE_BLOB_ENABLED` deve negar novas gravações sem destruir dados. Nunca usar um rollback que apague arquivos ou migrations automaticamente.

## Roteiro offline para desenvolvedor

```powershell
git switch main
git pull --ff-only
npm ci
npm run blob:render:staging:test
npm run blob:render:staging:check
```

A inspeção `--check` depende intencionalmente de variáveis de staging específicas, não das variáveis `.env.local` do laboratório OIDC. Sem elas, é **esperado retornar `BLOCKED: identity-not-staging`**, sem conectar a nada. **Não** copie variáveis do laboratório ou de produção para forçar um PASS.

Documentação oficial: https://vercel.com/docs/vercel-blob/private-storage e https://vercel.com/docs/vercel-blob/using-blob-sdk .
