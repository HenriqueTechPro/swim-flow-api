# Swim Flow — 02E-8A | Verificação de senha PostgreSQL sem Supabase

## Estado

PR #31 está integrada à main e foi revisada pelo Codex sem findings.
O banco Neon staging mantém o schema inicial; a migração incremental
`20261021000000_local_auth_identity_foundation` **ainda não foi
aplicada ao Neon staging real** nesta etapa.

## Entrega

- `LocalPasswordIdentityService` consulta `local_auth_identities` via
  Prisma, verificando o hash bcrypt contra a senha enviada.
- Os novos hashes gerados para provisionamento usam fator bcrypt **12**,
  com tamanho de entrada limitado a 12–72 bytes UTF-8. Nunca armazena
  senha em claro.
- Normaliza o e-mail para minúsculas e remove espaços antes da busca.
- Não distingue publicamente e-mail desconhecido, senha errada, conta
  desativada ou sem confirmação: retorna um mesmo HTTP 401 genérico.
- A busca por conta inexistente também realiza uma comparação bcrypt
  usando hash fictício, reduzindo diferenças observáveis de tempo.
- Exige e-mail confirmado, conta ativa e perfil de aplicação.
- Antes de registrar o último login, faz `updateMany` condicionada
  ao mesmo hash de senha/usuário ativo. Se a senha mudou ou a conta foi
  desativada durante o compare, a autenticação é rejeitada.
- Testes Jest cobrem login válido, e-mail canônico, senha incorreta,
  ausência de conta, hash inválido, confirmação, bloqueio, corrida
  com atualização e força de hash.

## Limites intencionais

**A interface pública `AuthDirectoryRepository` permanece ligada
ao `SupabaseAuthService`.** A classe PostgreSQL é apenas a primeira
peça da substituição. Não libera criação pública de contas,
não envia convites, não emite tokens Google e não oferece reset.
Não muda os controllers, nem as respostas HTTP do app.

O login só será trocado de provider após estarem disponíveis:
- provisionamento seguro e único do primeiro administrador;
- criação de convidados sem registro público;
- reset e confirmação de senha por e-mail com tokens de uso único;
- login Google verificado pelo servidor e vínculo explícito do usuário;
- integração e testes de ponta a ponta do frontend.

Fotos serão migradas para bucket compatível com S3 em outra etapa.
Até a substituição completa, não apagar segredos Supabase do Render
nem clicar no Blueprint com valores vazios.

## Próxima fatia

02E-8B — provisionamento do primeiro administrador em modo
protegido, somente no banco correto, sem credenciais compartilhadas
nem endpoint HTTP público. Depois completar convites/recuperação,
OAuth e S3, antes de remover Supabase do `render.yaml`.

## Validação

- [x] Serviço independente do SDK Supabase.
- [x] Login local preserva confirmação, bloqueio e controle de sessão.
- [x] Provedor público antigo mantido sem mudanças.
- [x] Testes de hash/senha/conta inválida.
- [ ] CI build, lint, testes unitários/E2E.
- [ ] PostgreSQL quality gate.
- [ ] Revisão Codex.
- [ ] Merge manual.
