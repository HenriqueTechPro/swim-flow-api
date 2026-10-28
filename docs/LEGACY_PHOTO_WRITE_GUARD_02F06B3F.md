# Swim Flow — 02F-06B3F | Bloqueio de URL legada após vínculo privado

## Problema
O commit transacional da etapa 02F-06B3D limpa photo/avatar_url e vincula o novo JPEG privado. As rotas antigas PUT /api/profile, PUT /api/students/:id, PUT /api/teachers/:id e PUT /api/parents/:id poderiam regravar um endereço público depois disso.

## Correção
- Guard comum na camada de persistência Prisma, em quatro repositórios; não depende de papel informado no frontend ou de flag em VITE.
- Somente a tentativa de escrever URL legada **não vazia** entra no guard. A chamada abre transação, bloqueia a linha correspondente com FOR UPDATE e **depois** consulta a referência ativa em uma nova statement PostgreSQL READ COMMITTED.
- Enquanto houver binding ativo: HTTP 409 com mensagem de migração, e a atualização inteira é desfeita, incluindo campos não relacionados na mesma transação. Sem binding: as edições legadas continuam funcionando.
- \`null\`, vazio e campo omitido não podem restaurar URL pública; mantemos alterações normais de nome e demais campos com foto nula.
- A etapa 02F-06B3D toma lock da mesma linha do cadastro antes de criar/remover binding, serializando commits e escritores legados. Assim uma edição antiga esperando pelo lock enxerga o novo binding e não restaura URL pública.
- Criação de cadastros com foto legada segue compatível, pois não existe binding para UUID recém-criado.
- Não adiciona migração/schema, não apaga imagens físicas e não altera as flags atuais.

## Validação
- Jest do guard: quatro targets, binding ativo e ausente, campos sem foto, ordem de locks, erro de banco.
- PostgreSQL descartável: profile/student/teacher/parent com foto legada; tenta regravar depois do binding; confirma que o valor permanece nulo; prova que escrita concorrente aguardando commit é barrada.
- Gates oficiais de API e PostgreSQL permanecem obrigatórios.

## Limitações
- A proteção cobre caminhos ORM conhecidos do backend. Escritas SQL externas diretas com credenciais de banco não passam pelo guard; o banco deve continuar acessível somente aos serviços autorizados. Avaliar trigger SQL antes de conceder qualquer permissão adicional de escrita.
- Listas legadas cacheadas podem continuar exibindo URL anterior até invalidação/TTL, apesar de a coluna ter sido limpa. O dashboard precisa migrar leitura e edição de aluno, professor e responsável para as referências privadas.
- **Não ativar** SWIMFLOW_PRIVATE_BLOB_ENABLED em produção até o smoke real e homologação de todas as rotas de foto.
