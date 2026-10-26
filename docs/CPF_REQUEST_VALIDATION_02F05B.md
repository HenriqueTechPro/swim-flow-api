# Swim Flow — 02F-05B | CPF na fronteira NestJS

Escopo: contratos HTTP de responsáveis e professores; branch isolada da API.

## Problema
Antes desta mudança, os endpoints POST/PUT aceitavam CPF arbitrário, mesmo quando o dashboard já verificava os dígitos. As entradas podem chegar também via Insomnia/outros clientes: validação apenas no React não é garantia de integridade.

## Entrega
- `src/shared/utils/cpf.ts`: validador de CPF com dígitos verificadores e recusa de sequências repetidas e formatos desconhecidos.
- `createTeacherSchema` e `createParentSchema` na API verificam CPF quando preenchido. Contratos de atualização herdam a regra.
- Válidos com ou sem máscara continuam aceitos; ausente, `null` e vazio seguem permitidos (campo opcional).
- Fixtures de unidade/e2e corrigidas para não utilizar CPFs fictícios inválidos como se fossem válidos.
- Testes de contratos e algoritmo cobrindo entradas aceitas e rejeitadas.

## Sem alterações
Nenhuma migração, alteração ou varredura do Neon; não altera fluxos de login, Render, imagens/Blob, permissões ou módulos fora de professores e responsáveis. Registros persistidos não são corrigidos automaticamente.

## Gates e rollout
- CI: lint sem autofix, formatação, TypeScript/NestJS build, Jest unidade + e2e, Prisma baseline.
- Verificação HTTP: POST/PUT com CPF inválido deve retornar 400; vazio/nulo e válido devem manter comportamento.
- Primeiro mesclar PR da API e fazer deploy do Render. Em seguida mesclar PR do dashboard. As regras foram implementadas de forma compatível, mas a validação da API é necessária para impedir clientes externos de enviar números inválidos.
- Registro legado inválido passará a precisar de correção do CPF ao editar o cadastro via PUT. Não fazer correção em massa sem procedimento próprio e autorização.
