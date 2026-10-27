# Swim Flow — 02F-06B1 | HTTP seguro para candidata de imagem privada

## Diagnóstico
A camada de domínio já possui `StorePrivateBlobImageUseCase`, normalização de imagens via Sharp e escrita privada no Vercel Blob com recibo/ETag verificado, autocancelamento em falha de persistência, releitura da função/permissão do ator e registro Prisma `VERIFIED`. Essa cadeia ainda **não era registrada no Nest** nem possuía porta HTTP. A rota antiga `POST /api/uploads/signed-url` continua apontando para a integração Supabase.

## Entrega limitada e fail-closed
- Nova rota `POST /api/uploads/private-image` recebendo `multipart/form-data` com `file`, `target` e `resourceId` obrigatório exceto para `profile-avatar`.
- Reutiliza JWT, `RolesGuard` de perfil atual do banco e `PermissionsGuard` (`uploads:write`). O caso de uso **revalida** a função atual e a existência/escopo do alvo durante o upload. Somente admin pode enviar fotos de aluno/professor/responsável; avatar de perfil fica restrito ao próprio ator.
- Multipart possui limite de **5 MiB**, 1 arquivo, 2 campos e 3 partes. Zod valida alvo e UUID. Conteúdo real é decodificado pelo Sharp, sujeito a limites de pixels/dimensões, e regravado como JPEG sem EXIF/ICC/GPS. Falha de conteúdo e integridade não publica imagem.
- Só cria metadado PostgreSQL `VERIFIED` após confirmar recibo privado do Blob (ETag forte). Resposta `{ data: { uploadId, status: "VERIFIED" } }` — **sem URL pública, caminho interno ou token**.
- `SWIMFLOW_PRIVATE_BLOB_ENABLED` precisa ser `true` e `BLOB_READ_WRITE_TOKEN` válido (apenas server-side). Desativado por padrão: serviço responde **503** após autorização. Nenhum segredo no frontend nem fallback automático para armazenamento público.
- Não substitui o upload atual, **não atribui foto ativa** nem expõe leitura. É impossível migrar o `PhotoUpload` agora: faltam endpoints separados de associação e leitura com controle de acesso.
- Sem alterações no schema Neon, permissão frontend, variáveis `VITE_*` ou remoção da compatibilidade anterior. Mantém a integração Supabase até finalizar fluxo privado.

## Gates
- Teste E2E: requisição autenticada com multipart, 201 sem URL, 400 ausente/inválido/UUID e 413 acima de 5 MiB, 401 sem JWT.
- Testes unitários do serviço: 503 sem recurso configurado e delegação correta ao caso de uso seguro.
- Casos existentes de StorePrivateBlobImage, Sharp e ETag continuam cobrindo autorização, duplo check, compensação e bytes normalizados.
- Build, lint/Prettier, E2E e baseline PostgreSQL. Sem acesso a Blob real no CI nem segredos de produção.

## Implantação / próxima etapa
1. Merge API e deploy no Render **sem ativar o flag** inicialmente. A rota retornará 503 e não expõe mídia enquanto não habilitada.
2. Validar credencial Vercel Blob **private** e ambiente server-only no Render, realizar smoke privado controlado quando pronta.
3. 02F-06B2: endpoints autenticados de vínculo CAS e leitura `private, no-store` com ETags, testes de revogação de permissões e trocas de foto.
4. 02F-06B3: atualizar o PhotoUpload do dashboard para novo fluxo completo; só então aposentar Supabase Storage, SDK e as Edge Functions após substituir relatórios.
