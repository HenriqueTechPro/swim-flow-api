# Swim Flow — 02F-05C15A | Consulta individual de responsáveis

## Motivação
A ficha de Responsáveis no dashboard carrega todo o diretório de responsáveis e alunos apenas para encontrar um ID. Isso prejudica a escalabilidade, mistura estados de carregamento e pode exibir "não encontrado" antes da resposta. A rota de consulta por UUID deve existir e ser publicada **antes** da adaptação da ficha.

## Implementação nesta API
- Adiciona `GET /api/parents/:id` somente ao controller já restrito a `@Roles('admin')`, com JWT e `@Permissions('parents:read')`; não concede acesso a professores/usuários comuns.
- Valida UUID no controller e retorna `404` se não existir.
- `GetParentUseCase` usa `ParentsRepository.findById(id)`, não `list()`.
- Prisma consulta a chave primária, inclui vínculos aluno-responsável existentes e usa `ParentPresenter.toHTTP` idêntico ao diretório. Nenhum esquema/tabela/migração novo e nenhuma cache global do diretório é criada.
- In-memory repository acompanha o contrato para testes.

## Testes
- Jest unitário: busca somente o responsável selecionado com filhos e responde 404 para UUID inexistente.
- Jest repositório: `findUnique` com vínculos.
- E2E: cria, recupera por ID, preserva `childrenIds`, diferencia 400 UUID inválido de 404 inexistente.
- CI: lint/build/testes + Postgres baseline e gates existentes.

## Dependência para o dashboard
Integre este PR na API e confirme a publicação no Render antes de implantar o dashboard que consumirá `GET /api/parents/:id`. Não implementar fallback para buscar todo o diretório caso o endpoint ainda não esteja publicado.

## Próximas fatias
- 02F-05C15B: ficha de Responsável por ID, filhos por consultas específicas, sem `useParents()`/`useStudents()` global.
- 02F-05C15C: endpoints individuais e fichas de Treinos e Eventos, respeitando permissões e relações.
