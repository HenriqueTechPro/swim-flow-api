# Swim Flow API — 02D-8 | Auditoria técnica e limpeza pré-Neon

## Repositório e decisões de arquitetura
- Repositório inspecionado: `HenriqueTechPro/swim-flow-api`; PR #19 já
  integrada, review Codex concluído sem apontamentos.
- Prisma PostgreSQL baseline versionada, HTTP + PostgreSQL integration CI
  descartável e readiness do banco estão preservados.
- Infraestrutura acordada: API Render, PostgreSQL Neon, front Vercel,
  futuro storage gratuito compatível com S3.
- **Supabase Auth e Storage ainda funcionam na API.** Não remover o SDK,
  as variáveis ou os endpoints antes de substituir login, OAuth, convites,
  recuperação de senha e uploads por adaptações testadas.

## Achados e mudanças efetivas
1. O serviço `ApiAuthService` importava concretamente
   `SupabaseAuthService`, embora o domínio já tivesse a abstração
   `AuthDirectoryRepository`. Isso aumentava o acoplamento do serviço
   de sessão às APIs de um fornecedor que será substituído.
   **Mudança:** completar o port do domínio com os métodos utilizados:
   login de senha, troca de token OAuth, recuperação de senha,
   convites, listagem e exclusão de identidades. O serviço injeta o port;
   o adapter `SupabaseAuthService` o implementa via provider já
   registrado no `AuthModule`. Sem alterações nos contratos HTTP.
2. Havia duplicação de `SupabaseIdentity` na infraestrutura.
   **Mudança:** centralizar o DTO `AuthIdentity` no domínio.
3. `tsconfig.json` tinha `strict: true`, mas explicitamente
   desabilitava `noImplicitAny`, `strictBindCallApply` e
   `noFallthroughCasesInSwitch`.
   **Mudança:** ativar as três verificações; CI compila todos os módulos.
4. `lint:check` já estava disponível no `package.json`, mas ausente
   do workflow de qualidade.
   **Mudança:** ativar **lint semântico** no GitHub Actions, sem auto-fix,
   silenciando apenas `prettier/prettier` até revisão dedicada do
   legado visual. Qualquer erro semântico passa a bloquear merge.
5. Teste do `ApiAuthService` ajustado para mockar o port do domínio,
   não o SDK, e regressão adicional para recuperação de senha.

## Evidências da auditoria estática

A primeira execução integral de `npm run lint:check` na CI exibiu
**1.213 apontamentos (1.211 erros e 2 avisos)**, incluindo mais de
mil ocorrências antigas de `prettier/prettier`. Não é responsável
misturar reformatar centenas de arquivos com este refactor da camada
de autenticação e consultas.

O workflow de CI passa a executar **todos os checks semânticos
TypeScript/ESLint como gate**, suprimindo APENAS a regra visual
`prettier/prettier` na execução do gate. As regras de segurança,
`no-unsafe-*`, variáveis inutilizadas e demais regras permanecem
habilitadas para o código de produção. A exceção existente para os
mocks de `test/**/*.ts` foi estendida apenas ao `no-unsafe-call`
de encadeamentos dinâmicos do Supertest/Jest; nunca em produção.

Além da melhoria de injeção de dependências, corrigimos:
- `PrismaResultsRepository.list`: retorno explicitamente tipado;
- extração de campos arbitrários da requisição HTTP e cookie de refresh
  tratados como `unknown`, com verificação de tipo antes do acesso;
- variáveis/imports mortos em módulo de estudante, mapper de turmas,
  repositórios de turmas e ex-alunos;
- mapas aninhados sem tipos no cálculo de evolução;
- métodos estáticos mappers/presenters declarados puros (`this: void`);
- tipo legado redundante de dias da semana e require antigo no teste
  de ambiente.

**Pendente:** executar formatação padronizada num PR separada, preferindo
revisão por módulo e não um commit massivo que esconda mudanças funcionais.

## Auditoria do legado
- `SupabaseAuthService` continua sendo **adapter necessário**, agora
  isolado da lógica de sessão. `AuthModule` mantém
  `useExisting: SupabaseAuthService` até migration de Auth.
- `SupabaseManagedUploadsRepository` continua sendo **adapter necessário**
  até migrar armazenamento para bucket S3 compatível.
- `VITE_SUPABASE_URL` e chave pública ainda aparecem no backend
  como configuração de transição; não remover enquanto os consumidores
  reais dependerem disso.
- `prisma/sql/pre_neon` preservado como histórico de SQL; o artefato de
  deploy é `prisma/migrations`. Não editar migrations já versionadas.
- Nenhuma alteração destrutiva no banco, nenhuma exclusão de tabelas,
  nenhuma limpeza de registros de atletas/pais/sessões.

## Verificações de merge
- [x] Porta do domínio e adapter isolados sem mudança funcional.
- [x] DTO de identidade unificado.
- [x] Compilação TypeScript configurada para erro implícito de tipo.
- [x] Lint semântico type-aware ativado no workflow; regra visual Prettier registrada como débito.
- [x] Testes unitários da interface de autenticação atualizados.
- [ ] CI build + TypeScript com flags mais estritas.
- [ ] CI lint semântico sem erro (sem desligar regras de produção).
- [ ] CI unit e HTTP e2e.
- [ ] CI PostgreSQL migrações, transactions e HTTP E2E.
- [ ] Codex sem findings importantes.
- [ ] Merge manual.

## Pendências intencionais
Esta PR **não** promete auditoria sem nenhum débito do repositório inteiro:
os adapters Supabase ativos requerem sua própria estratégia de substituição.
Após integrarmos a limpeza tipada, o próximo passo de implantação é
preparar Neon vazio e testar uma migração controlada. Substituir Auth/Storage
sem quebrar o app exige outra etapa e testes específicos.
