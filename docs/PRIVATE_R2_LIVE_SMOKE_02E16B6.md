# Swim Flow — 02E-16B.6 | Ensaio real do R2 com bucket descartável

## Objetivo e estado

Esta PR **prepara** um teste de integração REAL, mas **não o executa**: ainda
não há bucket de laboratório nem chaves de acesso protegidas configuradas
nesta conversa. O workflow novo existe apenas como `workflow_dispatch` e
não roda em push/PR/deploy/cron. A API, React/Vercel, Render, Neon e uploads
legados permanecem inalterados.

O teste utiliza apenas um PNG artificial de 1×1 pixel, UUIDs aleatórios
e chaves sob `private/profiles/{uuid}/{uuid}.png`. Ele não depende de
usuários, alunos, dados da base ou fotos reais.

## Provisionamento manual, com separação física

1. No Cloudflare R2, criar **novo bucket exclusivamente descartável**,
   por exemplo `swimflow-r2-smoke-ci-only`. Nunca apontar para bucket
   `swim-flow-private-media`, `prod` ou que contenha fotografias.
2. Manter **Public Development URL (`r2.dev`) desligada**; não configurar
   domínio público. Bucket **privado**.
3. Criar **API token específico**, com permissões apenas no bucket de teste,
   para operações S3 necessárias (PUT, GET, HEAD e DELETE). Não reutilizar
   chave de produção e não permitir listar/remover outros buckets.
4. No repositório GitHub, criar o Environment **`r2-smoke`**, com
   aprovação de revisor caso disponível. Adicionar **Environment secrets**:
   `R2_SMOKE_ENDPOINT` (somente `https://<32hex>.r2.cloudflarestorage.com`),
   `R2_SMOKE_BUCKET`, `R2_SMOKE_ACCESS_KEY_ID`,
   `R2_SMOKE_SECRET_ACCESS_KEY`.
   Configurar **Environment variable** `R2_SMOKE_ORIGIN` com a origem
   EXATA de teste no Vercel, por exemplo `https://teste.vercel.app`
   (sem barra final). Não colocar tokens em `VITE_*`, commits ou chat.
5. Aplicar a política CORS **apenas no bucket de teste**, substituindo a
   origem de exemplo pela origem `R2_SMOKE_ORIGIN`. Não aplicar na produção:

```json
[
  {
    "AllowedOrigins": ["https://teste.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "If-None-Match", "If-Match"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

6. Após merge da PR e configuração, abrir **GitHub → Actions →
   Private R2 disposable smoke — MANUAL ONLY → Run workflow**, branch
   `main`. Digitar exatamente `I_APPROVE_DISPOSABLE_R2_SMOKE_ONLY`.
   O teste recusa execução sem a aprovação exata, sem o bucket exclusivo,
   sem endpoint Cloudflare válido ou com a flag da API ligada.

O workflow possui `permissions: contents: read`, serialização por
`concurrency`, timeout, e não publica saída sensível. Não execute em
um bucket com qualquer dado real. Se falhar a limpeza, inspecione
privadamente o bucket descartável, sem colar logs contendo segredos.

## Ensaios executados SOMENTE quando disparado manualmente

- Preflight `OPTIONS`: origem exata e métodos `PUT/GET`; cabeçalhos
  `Content-Type`, `If-None-Match`, `If-Match` permitidos.
  Este teste de rede simula preflight, mas **não equivale** a teste com
  navegador real da Vercel, que permanece necessário antes do cutover.
- PUT assinado de até 90s com `If-None-Match: *`: duas escritas paralelas
  na mesma chave devem resultar em **uma única 2xx e uma 412**.
- Reenvio da URL PUT enquanto o objeto existe deve retornar **412**,
  sem alterar o ETag nem bytes comprometidos.
- HEAD recupera ETag, MIME e tamanho; Range GET usa `If-Match`.
- GET assinado de até 60s, com `If-Match`, devolve somente os bytes do
  objeto confirmado. GET com ETag falso deve falhar com **412**.
- GET sem assinatura para o endpoint S3 deve ser negado (401/403/404).
- Demonstração de risco: após excluir o objeto, **reutilizar o mesmo PUT
  ainda válido** pode recriá-lo. Mesmo que esse replay não funcione em
  determinado teste, o risco de PUT iniciado antes do vencimento e
  finalizado depois permanece. A exclusão é testada **somente** com o
  objeto sintético do próprio ensaio.

O script apaga **somente** a(s) chave(s) UUID criada(s) naquela execução,
não varre prefixos nem lista/exclui buckets. Ele não armazena credenciais
ou URLs em logs. Após falha de limpeza, exigir investigação privada.

## Limites de segurança para decisão de ativação

Mesmo após `PASS` neste ensaio, **não ativar R2 no Render** e não ligar
a limpeza automática: a confirmação de um teste de rede não representa
controle definitivo de uploads ainda em trânsito. Cloudflare documenta
que um GET/HEAD que retorna ausência não garante que um PUT mais antigo
ainda pendente não venha a concluir.

**Mitigação antes da produção:** adotar estratégia fail-closed que
impossibilite reutilizar o namespace após descarte (p.ex. marcador
persistente/tombstone controlado ou transferência server-side para chave
imutável com ciclo de vida provado), seguida de validação de payload com
decodificação completa e remoção de EXIF/metadados. Revisar separadamente
o fluxo de autorização, a política de retenção, custo e as migrações
incrementais no Neon.

O script não cria recursos automaticamente, não altera o CORS, não ativa o
Storage S3/R2, não testa uploads de imagens reais e não altera a API HTTP.

### Fontes oficiais

- https://developers.cloudflare.com/r2/reference/consistency/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- https://developers.cloudflare.com/r2/buckets/cors/
- https://developers.cloudflare.com/r2/api/s3/extensions/

**Próxima etapa depois do ensaio real:** resolver definitivamente o
problema da exclusão/PUT tardio, executar um teste no navegador com origem
Vercel e só então iniciar a integração autenticada na API/React
(02E-16C), com Supabase Storage ainda disponível durante o cutover.
