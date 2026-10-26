# Swim Flow — 02E-17A | Fundacao de storage privado com Vercel Blob

## Decisao

O Cloudflare R2 exige cadastro de cartao para a conta do proprietario; **nao
prosseguir no Cloudflare**. O Vercel Blob privado ja foi criado no projeto
`swim-flow-dash`, na regiao Sao Paulo (`gru1`), sem requisicao de cartao
nessa operacao. A vinculacao ao projeto foi confirmada pela API da Vercel:
`BLOB_READ_WRITE_TOKEN` existe nas configuracoes da Vercel para production,
preview e development (o valor NAO foi consultado).

Nao fazer uploads reais nesta etapa, nao mover fotos de alunos e nao alterar
as variaveis do Render. O armazenamento existente continua funcionando.

## Aspecto fundamental: API NestJS esta no Render

A Vercel disponibiliza token/OIDC para funcoes na propria Vercel, mas **a API
do Swim Flow roda no Render**. O token auto-injetado no projeto Vercel NAO
fica automaticamente disponivel no Render.

Para manter **a API NestJS como fonte unica de autenticacao e autorizacao**,
ha duas opcoes para futura implementacao (nao ligar ambas):

A. A API NestJS recebe `BLOB_READ_WRITE_TOKEN` somente nas variaveis
   **secretas do Render**, adicionadas pelo administrador sem enviar o valor
   ao chat/codigo/GitHub. O SDK `@vercel/blob` permite token explicito;
   somente o Render faz PUT, GET e DELETE. React chama rotas autenticadas
   NestJS. Avaliar trafego, limites, tamanho dos arquivos e custo do plano.
B. Funcoes Vercel privadas fazem o transporte Blob usando credenciais do
   projeto, apos autorizacao criptografica de cada operacao pela API NestJS.
   Exige desenho de tokens de uma unica operacao com aud/nonce/exp, antifraude,
   replay protection e testes de revogacao. Mais complexo; nao improvisar.

**Proposta:** comecar pela opcao A, porque reduz a duplicacao de regras de
autorizacao. So conectar ao Render depois de aprovacao, teste offline e
implementacao do tratamento de arquivo.

## Contratos entregues nesta etapa

- `PrivateBlobStorageRepository`: PUT privado com bytes ja validados,
  GET privado em stream e DELETE interno com ETag.
- `loadPrivateVercelBlobConfig`: por padrao retorna `null`; habilita
  somente com `SWIMFLOW_PRIVATE_BLOB_ENABLED=true` e
  `BLOB_READ_WRITE_TOKEN` exclusivamente no servidor.
- Recusa habilitar Blob junto com o storage R2/S3.
- Nao injeta provider no Nest, nao expõe endpoints, nao armazena token em
  banco, nao cria arquivos, nao muda schema/migracoes existentes.

## Regras para proximo PR

1. Escolher adaptador oficial `@vercel/blob >= 2.3`, com versao fixa no
   `package-lock.json`; operacoes com `access: 'private'` e
   `allowOverwrite: false`; path UUID opaco, sem nome real do aluno.
2. Verificar nome do objeto, ETag e MIME/tamanho retornados antes de gravar
   metadados em transacao; nunca aceitar uma URL externa arbitraria.
3. Receber imagem autenticada com limite 5 MiB **na API Render**, validar
   MIME, assinatura e decodificacao integral, orientar/esvaziar EXIF.
   Limitacoes de tamanho do Vercel Functions (quando usadas) sao diferentes
   das do Render.
4. Antes de cada download, consultar papel atual, relacao com o aluno/
   responsavel, recurso e estado VERIFIED. Retornar stream com
   `Cache-Control: private, no-store`; nao expor token nem URL Blob ao React.
5. Preservar ACL conservadora para fotos infantis ate haver permissao
   por turma/guardian. Nunca confiar apenas em um ID de arquivo.
6. Implementar compensacao para falhas DB/storage e retencao com testes.
7. Testar no Blob privado sem imagens reais, SEM migrar Neon/Render/Vercel
   de producao e SEM ativar cron.
8. Somente apos todo fluxo comprovado, substituir importacoes do Supabase
   Storage e manter rollback ate encerrar a transicao.

A API de Vercel Blob **nao implementa SigV4/S3**, portanto nao reusar
`S3PrivateMediaStorageRepository`, `If-None-Match` S3 nem o workflow
manual de R2 como se fossem compatíveis.

## Fontes oficiais

- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/vercel-blob/using-blob-sdk
- https://vercel.com/changelog/vercel-private-blob-is-now-generally-available

## Controles financeiros

Nao ativar plano pago nem cadastrar cartao. A criacao do store foi aceita
pela Vercel, mas operacoes devem respeitar cotas do plano disponivel.
O uso de uma mesma conta Vercel por projetos diferentes compartilha
recursos/limites conforme as regras comerciais da plataforma.
