# Swim Flow | Correção dos perfis de acesso no Neon

## Problema confirmado

A rota administrativa `GET /api/auth/access-profiles` exige `JwtAuthGuard`, `RolesGuard` (`admin`) e `PermissionsGuard` (`auth:manage-users`). Porém, o caso de uso `ListAccessProfilesUseCase` chama `AuthDirectoryRepository.listUsers()`. O adaptador ativo `LocalAuthDirectoryService.listUsers()` ainda lançava `ServiceUnavailableException('Legacy user directory is not configured')`, apesar das contas terem sido migradas para `local_auth_identities` no PostgreSQL Neon. Assim, a tela sempre recebia HTTP 503, independentemente dos perfis já existentes.

## Correção

- `LocalPasswordIdentityService.listUsers()` consulta diretamente `local_auth_identities` em modo somente leitura: `userId`, `email`, `createdAt`, `lastSignInAt`, `emailConfirmedAt`.
- Contas desabilitadas não fazem parte da lista de acessos autorizados.
- A seleção **não** inclui `passwordHash`, tokens, sessões nem outros dados de segurança.
- `LocalAuthDirectoryService.listUsers()` delega ao serviço local. As demais operações desativadas do legado permanecem bloqueadas.
- O caso de uso une os perfis `profiles` às identidades pelo ID já existente, mantendo perfil, role, ordenação e status pendente/ativo.
- A rota mantém JWT, role e permissão; nenhum novo endpoint público foi introduzido.

## Testes

- Serviço Prisma: garante a projeção mínima, exclusão de desabilitados e consulta sem credenciais.
- Adaptador local: listagem passa pela implementação Neon; login e operações legadas mantêm as proteções existentes.
- Caso de uso: associação de perfis e identidades, ordenação e propagação de falhas reais.
- E2E: GET permitido para admin, negado sem autenticação e para teacher.

## Escopo e cuidados

Não altera migrações, usuários, funções, tokens, senhas, env ou dados persistidos. Apenas reativa a **leitura** do diretório administrativo. Remoção de acesso via adaptador legado (`deleteUser`) continua propositalmente desativada, exigindo planejamento específico antes de habilitar operações destrutivas. A interface atual ainda exibe o botão; isso deverá ser tratado separadamente, sem remover contas por atalhos no banco.

Publicar a API corrigida no Render antes de avaliar o resultado em produção. O ajuste de UX da tela (erro + empty state simultâneos) será um PR separado do dashboard.
