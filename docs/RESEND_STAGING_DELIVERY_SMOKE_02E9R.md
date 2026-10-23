# Swim Flow — 02E-9R | Teste isolado de entrega Resend

## Objetivo

Validar o **transporte de e-mails** com a API Key do Resend criada pelo
responsável, sem domínio próprio e sem acesso ao Neon, Vercel ou Render.
Esta etapa **não** cria perfil, identidade, token de convite ou administrador.
Não envolve migrations, seed ou mudanças de variáveis em nuvem.

Para começar, o Resend oferece o remetente de testes
`onboarding@resend.dev`. Sem domínio verificado, ele só deve ser utilizado
para envio ao endereço e-mail autorizado/cadastrado na própria conta Resend.
Para convidar professores e outros destinatários, será necessário verificar
um domínio próprio (etapa posterior).

## Segurança e pré-requisitos

- A chave criada no Resend deve ter permissão **Sending access**.
- Não enviar a chave por chat, GitHub Issue, PR, prints ou terminal compartilhado.
- Não cadastrar a chave em `VITE_*` na Vercel: o prefixo expõe valores
  no bundle público JavaScript.
- Não colar a chave em comandos literais gravados no histórico do PowerShell.
- O teste não depende de `DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
  `SWIMFLOW_LOCAL_INVITES_ENABLED` nem de flags do bootstrap.
- O script não deve imprimir segredos, destinatário nem a resposta bruta do
  provedor. Erros são genéricos.
- O script usa `node` com `fetch` nativo (Node 22) e envia um e-mail de
  diagnóstico **sem qualquer token, link de ativação ou senha**.
- Cada execução aprovada dispara no máximo **uma** requisição de envio.
  Reexecutar causa uma nova mensagem de teste.
- A chave real **não deve** existir nos Secrets do GitHub Actions;
  a CI executa somente `resend:smoke:test` com mock.

## Executar no PowerShell (Windows)

Depois do merge manual da PR e com cópia local atualizada da API:

```powershell
git status --short
git pull --ff-only
npm run resend:smoke:test

# A chave é lida sem ecoar o valor e sem registrá-la no histórico do terminal.
$secureKey = Read-Host "Cole a API Key do Resend" -AsSecureString
$env:RESEND_API_KEY = (New-Object System.Net.NetworkCredential("", $secureKey)).Password
Remove-Variable secureKey

# O destino deve ser o MESMO e-mail da conta Resend.
$env:SWIMFLOW_RESEND_SMOKE_TO = Read-Host "E-mail cadastrado no Resend"
$env:RESEND_FROM_EMAIL = "onboarding@resend.dev"
$env:SWIMFLOW_RESEND_SMOKE_APPROVAL = "SEND_ONE_SWIM_FLOW_STAGING_TEST_EMAIL"

try {
    npm run resend:smoke
} finally {
    Remove-Item Env:RESEND_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:SWIMFLOW_RESEND_SMOKE_TO -ErrorAction SilentlyContinue
    Remove-Item Env:RESEND_FROM_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:SWIMFLOW_RESEND_SMOKE_APPROVAL -ErrorAction SilentlyContinue
}
```

A mensagem de sucesso informa apenas que a API Resend aceitou a
solicitação. Isso **não prova** entrega: conferir caixa de entrada, spam e
o histórico em `https://resend.com/emails`.

Se receber 403/422, verifique sem expor dados se o destinatário é o
e-mail permitido na sua conta Resend, se a chave possui acesso de envio
e se o remetente é `onboarding@resend.dev`. O script oculta o corpo
de resposta intencionalmente; use o painel privado do provedor para
investigar o código de falha.

## Próxima etapa (não executar nesta PR)

Após confirmar a entrega real:

1. Conferir a origem HTTPS na Vercel e o backend Render com
   `/health` e `/health/ready`.
2. Preparar a execução privada protegida do bootstrap e seu e-mail
   `SWIMFLOW_BOOTSTRAP_ADMIN_EMAIL`, correspondente ao destinatário
   autorizado pelo Resend.
3. Definir as variáveis **somente no executor do bootstrap**:
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL=onboarding@resend.dev`,
   `SWIMFLOW_AUTH_APP_ORIGIN=https://swim-flow-dash.vercel.app` e os
   demais gates descritos em `docs/LOCAL_ADMIN_BOOTSTRAP_02E8B.md`.
4. Enviar convite somente após confirmação e validação end-to-end;
   ativação do primeiro administrador exige aceitar token em 24h.
5. Manter `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=false` até ativação
   e testes de segurança completos.

Não reutilizar um e-mail de teste de transporte como token real de
ativação. A primeira conta administrativa não é criada por esse teste.
