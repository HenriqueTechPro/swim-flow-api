# Swim Flow — Diagnóstico de falha em Administração > Perfis com acesso

## Causa confirmada no código
`GET /api/auth/access-profiles` chama `ListAccessProfilesUseCase`, que reúne perfis Prisma e usuários do `AuthDirectoryRepository`. Após a migração de autenticação para PostgreSQL/Neon, o provedor desse port é `LocalAuthDirectoryService`, mas `listUsers()` permanecia com `ServiceUnavailableException('Legacy user directory is not configured')`. Assim, a lista era impossível mesmo para um administrador válido.

## Correção
- `LocalPasswordIdentityService.listUsers()` lê somente `userId`, `email`, `createdAt`, `lastSignInAt` e `emailConfirmedAt` de `local_auth_identities`, ordenados de maneira determinística, omitindo `disabledAt != null`.
- `LocalAuthDirectoryService.listUsers()` delega ao serviço local; `ListAccessProfilesUseCase` e o presenter continuam compatíveis com convites pendentes e sessões ativas.
- Permissões JWT + role `admin` + `auth:manage-users` são preservadas. Nunca incluir hash de senha, tokens, revogação de sessão ou metadados internos em resposta.
- Demais operações do diretório legado (convites, confirmação de senha, exclusão) permanecem explicitamente indisponíveis nesta etapa; rotas locais de convite/reset seguem suas próprias regras e flags.

## Testes
- Projeção mínima da tabela de identidades, ausência de campos sensíveis, contas desabilitadas e lista vazia.
- `LocalAuthDirectoryService` e caso de uso com join das identidades locais e perfis.
- HTTP E2E da rota: resposta ativa/pendente, 401 sem autenticação e 403 para professor.
- CI TypeScript/Jest/Prisma/build/PostgreSQL.

## Deploy
- Merge e deploy deste PR **da API** no Render antes de interpretar o erro como dados ausentes.
- Confirmar resposta `GET /api/auth/access-profiles` no Network com sessão de administrador sem compartilhar o token.
- Verificar entradas existentes em `local_auth_identities`; um perfil sem identidade local não é incluído pela combinação existente, intencionalmente para não conceder acesso fictício.
- Não executar SQL manual ou adicionar usuários de teste no Neon.

## Separação front-end
O dashboard também exibe falsamente o estado vazio após erro de leitura. Isso será corrigido em um PR de UI distinto, sem ocultar mensagens de falha.
