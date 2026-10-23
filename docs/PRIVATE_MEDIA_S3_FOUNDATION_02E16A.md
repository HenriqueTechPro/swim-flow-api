# Swim Flow — 02E-16A: infraestrutura de mídias privadas (fundação)

## Decisão arquitetural

Substituir o Supabase Storage por um provedor **S3-compatible**.
Primeiro candidato: **Cloudflare R2 Standard**, sem domínio próprio, com
bucket privado. A API NestJS no Render será a autoridade de autorização,
assinatura e acesso; o frontend React nunca recebe credenciais S3.

Cloudflare R2 oferece camada de uso gratuito na classe Standard, incluindo
10 GB-mês de armazenamento, 1 milhão de operações Class A e 10 milhões de
operações Class B por mês (sujeito às regras atuais do provedor). É
necessário criar conta e ativar R2 por conta própria; pode haver checkout,
forma de pagamento ou cobrança por excedentes. **Não há bucket ainda**.

Referências oficiais:
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/

## Inventário de código atual

- Controller protegido: `POST /api/uploads/signed-url`;
- Use case `CreateManagedUploadUseCase` valida papel e existência do alvo,
  **mas a autorização do professor sobre o aluno específico ainda exige
  revisão**; sem ela, não ativar uploads de alunos por professores;
- Adapter atual `SupabaseManagedUploadsRepository` permanece registrado
  em `HttpModule`. Na API Neon-only, sem credenciais Supabase, devolve 503;
- Frontend `src/lib/media/upload-image.ts` usa SDK Supabase e fallback
  direto ao armazenamento, que deverá ser removido no cutover;
- Persistência atual guarda URLs de fotos. Isso **não** é adequado para
  guardar URL assinada com prazo curto: a próxima etapa introduzirá
  chave/referência estável e resolverá URL de leitura por autorização.

## Esta PR (fundação, sem ativação)

Adiciona `private-media-upload-policy.ts` com invariantes testados:

- Não aceitar IDs de conta/aluno arbitrários ou traversal em object keys;
- Nunca usar nome original (pode conter PII ou caracteres perigosos) na key;
- Namespaces `private/profiles`, `private/students`,
  `private/teachers`, `private/parents`;
- Identificadores aleatórios para não sobrescrever fotos;
- Apenas PNG, JPEG, WEBP e GIF (tipo MIME determina extensão);
- Tamanho nominal válido de 1 a 5 MiB;
- TTL máximo proposto: 90s PUT, 60s GET;
- Nenhuma foto pública por padrão.

Esta política ainda **não** envia bytes nem assina URLs: é um contrato
separado do adapter legado. Não introduz variáveis de ambiente, credenciais,
SDK S3, bucket, rotas ou migração do banco nesta PR.

## Próxima etapa — API S3 (02E-16B)

1. Configurar no Render, **após habilitação do provedor**, apenas variáveis
   privadas `S3_ENDPOINT`, `S3_REGION` (R2: `auto`),
   `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
   Nunca `VITE_S3_*` e nunca enviar valores por chat.
2. Adicionar AWS SDK v3 e lockfile, adapter de assinatura SigV4,
   sem fallback ao Supabase; manter flag de rollout desligada.
3. Exigir `fileSizeBytes` no novo contrato, confirmar tipo real
   (magic bytes) e tamanho após envio e **antes** de persistir referência.
   URLs PUT assinadas podem ser reutilizadas dentro de sua validade:
   considerar upload idempotente, uso de chave única e estado pendente.
4. Revisar posse da entidade e isolamento por papel/clube/turma,
   especialmente para crianças.
5. Projetar `media_objects` privado (objeto, proprietário, status,
   MIME, tamanho e metadados de auditoria). Referenciar apenas ID
   interno na ficha de aluno/professor/responsável.
6. GET: revalidar autorização na API, produzir URL GET com TTL curto ou
   realizar proxy controlado. Jamais salvar URL GET assinada no banco.
7. Configurar CORS do bucket para origem HTTPS da Vercel, métodos e
   headers mínimos. Bucket privado, **sem R2.dev público**.
8. Testes com storage fake e, somente em ambiente descartável,
   teste real PUT/HEAD/GET, limitação de tamanho, token expirado e
   permissionamento. Sem fotos reais de menores.

## Próxima etapa — Frontend + remoção definitiva (02E-16C / 02E-17)

- Upload com PUT URL assinada e confirmação ao backend; nenhum acesso
  direto ao Supabase; tratamento de status e falha visível.
- Obter URLs de visualização apenas em contextos autorizados.
- Preservar uploads antigos até migração ou decisão consciente sobre
  indisponibilidade de mídias antigas.
- Remover SDK Supabase de **ambos** os repositórios, adaptadores, variáveis
  `VITE_SUPABASE_*`, rotas legadas e arquivos de migração ativos só após
  inventário de imports, teste integrado e deploy seguro.

## Rollout / restrições

- **Não mudar** `JWT_ACCESS_SECRET`, `SWIMFLOW_LOCAL_PASSWORD_LOGIN_ENABLED`,
  cookies, CORS, Render, Neon ou Vercel nesta PR.
- **Não remover** variáveis antigas do frontend nesta etapa; o upload
  ainda as referencia.
- O teste de 401 relatado anteriormente não está mais se reproduzindo.
  Não reabrir mudanças de autenticação sem novo defeito confirmado.
- Sem domínio próprio, R2 funciona pelo endpoint API S3. O usuário
  precisará ativar R2 no próprio painel para a etapa 02E-16B.
