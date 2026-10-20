# Swim Flow — Etapa 02C-6: resultados esportivos e privacidade

## Problema corrigido

As rotas `/api/public/results`, `/ranking` e `/contexts` eram
anônimas. `GET /api/public/results` retornava nomes completos e IDs
internos de alunos; `/ranking` também retornava nomes e IDs vinculados
ao histórico esportivo. Isso não é uma publicação autorizada: a existência
de um resultado no sistema administrativo não equivale a consentimento de
divulgação, sobretudo para menores.

## Política atual: não publicar sem consentimento verificável

**Todas as rotas do prefixo `/api/public/results` agora exigem**
`JwtAuthGuard` + `RolesGuard` (`admin`) +
`PermissionsGuard` (`results:read`).

- Anônimo: `401`
- Usuário autenticado com role `teacher` ou `user`: `403`
- Administrador: mantém a leitura original, somente para compatibilidade
  temporária; **não é um endpoint público**.
- Respostas autorizadas incluem `Cache-Control: private, no-store, max-age=0`
  e `X-Robots-Tag: noindex, nofollow, noarchive`.
- Os endpoints de manutenção `/api/results` já exigiam administrador
  e permanecem inalterados.
- Não foi criada variável de ambiente para religar a leitura anônima,
  para evitar publicação acidental por configuração.
- O nome antigo da rota foi preservado para reduzir a mudança de código,
  mas está **depreciado**. Novos consumidores devem usar endpoints
  explicitamente administrativos.

## Impacto no frontend

Páginas ou widgets anônimos que antes consumiam
`/api/public/results` passarão a receber `401`. Professores e usuários
sem role admin receberão `403`. Isso é intencional até que haja um
fluxo real de autorização de publicação.

Não tentar contornar a regra colocando JWT administrativo no frontend
público, em URL, localStorage de visitantes ou no código estático do PWA.

## Contrato futuro para publicação legítima (novo PR e migração)

1. Diferenciar resultados administrativos de **registros de publicação**.
   Criar um modelo de concessão/revogação (consentimento do responsável
   verificado quando aplicável, finalidade, escopo, data, operador e prova).
2. O padrão é **não publicado**; importar start list, lançar tempo,
   arquivar aluno ou criar campeonato nunca implica divulgar.
3. Publicar campos mínimos: competição, categoria, modalidade, colocação,
   tempo e um nome de exibição autorizado. Não publicar IDs de alunos,
   histórico de turmas, data de nascimento, contato, endereço, avaliações,
   antropometria, vínculo de responsáveis ou notas internas.
4. Usar identificadores públicos opacos, diferentes dos UUIDs internos.
5. Retirada de consentimento deve interromper novas respostas públicas
   imediatamente; avaliar cache, histórico de compartilhamentos e
   indexadores externos na política de retenção.
6. Avaliar bases legais aplicáveis, dever de informação, regulamentos
   oficiais de competição e documentação de consentimento com apoio
   jurídico adequado. Não inferir autorização pela inscrição na prova.
7. Testar negativa por padrão, perfis menores, alterações de autorização,
   paginação e consulta pública de dados não autorizados, inclusive
   nomes pesquisáveis e rankings agregados.

## Limites dos testes desta etapa

- Os testes E2E usam repositório de resultados em memória e simulam a
  verificação criptográfica do JWT para testar os **guards reais de
  role e permissão**. Validam anonimato bloqueado, professor/usuário negado
  e administrador autorizado.
- Ainda faltam testes com credenciais reais, cache reverso e PostgreSQL
  descartável. Não usar dados de menores em ambiente de produção até essa
  validação e a revisão dos demais endpoints.

Nenhuma migração foi criada ou aplicada. Nenhuma informação foi removida
de bancos existentes; a exposição anônima futura foi bloqueada no HTTP.
