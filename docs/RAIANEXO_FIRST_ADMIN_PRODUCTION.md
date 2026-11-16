# RaiaNexo — primeiro administrador de produção (convite protegido)

A produção usa o mesmo fluxo de autenticação Neon já validado no staging. O novo banco de produção possui as 12 migrações e, antes do bootstrap, **zero perfis e zero identidades**. Esta operação não cria tabelas, não copia dados de staging e não habilita cadastro público.

## Segurança: nunca fazer cadastros via SQL manual

O script existente `scripts/bootstrap-production-first-admin.cjs` verifica a identidade exata do projeto e branch Neon, conexões TLS, autorização explícita, banco inicialmente vazio e ausência de sessões; cria uma única conta admin **pendente**, emite um token aleatório com validade de 24 horas e envia o convite por Resend. Nada imprime URLs de conexão, senha ou token.

O workflow `.github/workflows/raianexo-production-first-admin.yml` apenas executa esse script com um **workflow_dispatch** explícito na branch `main`, em um ambiente GitHub protegido. PRs rodam **somente testes offline**, sem segredos ou operação na produção.

## Configurar GitHub Actions antes de executar

1. Faça merge do PR apenas depois que os testes estiverem verdes.
2. GitHub `HenriqueTechPro/swim-flow-api` → **Settings → Environments → swimflow-neon-production**. Este é o mesmo ambiente já utilizado para instalar as 12 migrações. Recomendado: habilitar **Required reviewers**, apenas pessoas autorizadas, e limitar para a branch `main`.
3. Confirme os dois secrets já utilizados pelo workflow de migração (não imprimir, não colocar em conversas ou código):
   - `SWIMFLOW_PRODUCTION_DATABASE_URL` — Neon produção **pooled**
   - `SWIMFLOW_PRODUCTION_DIRECT_URL` — Neon produção **direto**
4. Adicione quatro novos **Environment secrets**, exclusivos da produção:
   - `RAIANEXO_ADMIN_EMAIL` — e-mail do primeiro administrador.
   - `RAIANEXO_ADMIN_FULL_NAME` — nome completo do administrador.
   - `RAIANEXO_RESEND_API_KEY` — chave do Resend com envio autorizado.
   - `RAIANEXO_RESEND_FROM_EMAIL` — remetente validado no Resend.

Os secrets só são fornecidos aos passos de leitura do banco e ao envio de convite; `npm ci` e `prisma generate` usam valores locais fictícios.

## Execução em duas fases

1. GitHub Actions → **RaiaNexo production — first admin invitation (manual)** → Run workflow → branch `main`.
   - **Operation**: `inspect`
   - **Confirmation**: `INSPECT_RAIANEXO_PRODUCTION`
   - Essa fase consulta somente os totais: migrações, perfis, admins, identidades e sessões. Não faz gravações nem exige Resend.
2. Depois de conferir que os totais são `12 migrações; 0 profiles; 0 admins; 0 login identities; 0 sessions`, executar uma segunda vez:
   - **Operation**: `apply`
   - **Confirmation**: `CREATE_RAIANEXO_FIRST_ADMIN`
   - Ação protegida cria uma única identidade admin pendente e envia convite HTTPS ao endereço `https://swim-flow-dash.vercel.app/auth/accept-local-invitation#token=...` (token real só vai no e-mail, não nos logs).
3. O administrador abre o e-mail, aceita o convite e define uma senha forte. O link expira em 24 horas. A tela atual ainda pode mostrar texto Swim Flow, pois o rebranding RaiaNexo foi adiado até a estabilização funcional.
4. Depois da ativação confirmada, na **nova conta Render → serviço swim-flow-api-production → Environment**, ajustar:
   - `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED=true`
   - conferir `API_CORS_ORIGIN=https://swim-flow-dash.vercel.app`, `AUTH_COOKIE_SAME_SITE=none`, `AUTH_SECURE_COOKIES=true`.
   - aplicar novo deploy do serviço (mudança de ambiente no Render normalmente reinicia serviço).
   - **Não precisa** ativar `SWIMFLOW_FIRST_ADMIN_INVITE_ENABLED` no Render; a autorização fica restrita ao GitHub workflow manual.
   - **Não precisa** inserir a chave Resend no Render para o primeiro convite; ele é enviado no GitHub Actions. Convites administrativos futuros são uma etapa posterior, separada e protegida.
5. Teste login com a nova identidade no frontend de produção. Confirme que a API de produção usa o banco de produção e que nenhum dado de staging foi copiado.

## Falha no envio de e-mail

O código grava a conta pendente antes da tentativa de e-mail. Se o envio falhar, **não repetir** a operação `apply` às cegas:
1. Rodar `inspect` novamente.
2. Se houver exatamente 1 perfil, 1 admin, 1 identidade pendente e 0 sessões, corrigir a autorização de domínio/remetente Resend e usar:
   - Operation: `resend`
   - Confirmation: `RESEND_RAIANEXO_FIRST_ADMIN`
   - A operação revoga os tokens pendentes anteriores e envia um novo convite.
3. Se a contagem divergir, não executar novamente. Investigar antes de qualquer escrita.

## Observações

- O Render Free não fornece acesso de shell nem pre-deploy jobs. O GitHub Actions é apropriado para a operação administrativa pontual com permissão limitada.
- Esse fluxo é apenas para **a primeira conta**. Não é uma área pública `Criar primeiro administrador`.
- Depois da ativação, manter os quatro segredos protegidos no ambiente; se não forem necessários, revogar o segredo de e-mail do workflow ou desativar a permissão de execução manual.
- Não alterar banco, JWT, staging ou dashboard para contornar o processo.

## Recuperação protegida: trocar e-mail do ÚNICO administrador ainda pendente

Este procedimento é excepcional para o piloto que utiliza o remetente `onboarding@resend.dev`, quando o destinatário originalmente escolhido não é o e-mail autorizado da conta Resend. **Nunca editar SQL manualmente, excluir a conta ou repetir `apply`.**

1. No GitHub Environment `swimflow-neon-production`, confirme que `RAIANEXO_RESEND_FROM_EMAIL=onboarding@resend.dev` e que `RAIANEXO_ADMIN_EMAIL` contém **o e-mail autorizado/associado à conta Resend**. Preserve `RAIANEXO_ADMIN_FULL_NAME` sem alterações. Não compartilhe e-mails ou chaves em issues e logs.
2. Execute `inspect` com `INSPECT_RAIANEXO_PRODUCTION`: devem existir **exatamente 1 perfil, 1 administrador, 1 identidade e 0 sessões**. É necessária uma identidade pendente ainda não ativada; o script verifica o restante antes de gravar.
3. Execute manualmente o mesmo workflow **em `main`**, selecionando:
   - **Operation**: `retarget`
   - **Confirmation**: `RETARGET_RAIANEXO_PENDING_ADMIN`
4. Somente o job protegido pelo environment, após a checagem de destino Neon, executa `scripts/retarget-production-pending-admin.cjs --retarget`. Em transação com o lock compartilhado do bootstrap, ele exige **um único administrador pendente**, nome preservado, nenhuma senha, e-mail confirmado, sessão ou login anterior, e nenhum token de outro tipo pendente. Troca apenas `local_auth_identities.email` e **revoga todos os tokens de convite ainda não usados**. Não envia e-mail nem imprime os endereços.
5. Confirme a execução verde. Faça um novo `inspect`. A seguir execute **outra execução manual**:
   - **Operation**: `resend`
   - **Confirmation**: `RESEND_RAIANEXO_FIRST_ADMIN`
6. O novo convite usa o e-mail corrigido e o remetente de testes. Se o Resend ainda responder com erro, examine o código e a mensagem em **Resend Logs**, sem divulgar tokens. **Não repita `retarget`** quando o novo endereço já corresponder ao cadastro, e jamais use `apply` para essa conta.

O procedimento é de uso único e **não faz parte do futuro onboarding SaaS**. O remetente `resend.dev` só atende testes autorizados, não convites a clientes reais. Quando houver domínio de envio verificado, devemos usar um e-mail administrativo apropriado ao cliente e desativar a possibilidade de retarget.
