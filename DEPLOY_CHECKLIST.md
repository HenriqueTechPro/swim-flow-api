# Deploy Checklist

## 1. Antes de subir para o Git

- [ ] Confirmar que a API sobe localmente com `npm run start:dev`
- [ ] Confirmar `GET /health`
- [ ] Confirmar Swagger em `/docs`
- [ ] Confirmar que `.env` nao esta versionado
- [ ] Revisar `.env.example`
- [ ] Rodar `npm run prisma:generate`
- [ ] Rodar `npm run build`
- [ ] Rodar `npm run test:all` se quiser subir com a suite validada

## 2. Arquivos que devem existir no repo

- [ ] `src/`
- [ ] `test/`
- [ ] `prisma/`
- [ ] `package.json`
- [ ] `package-lock.json`
- [ ] `nest-cli.json`
- [ ] `tsconfig.json`
- [ ] `tsconfig.build.json`
- [ ] `.prettierrc`
- [ ] `.gitignore`
- [ ] `.env.example`
- [ ] `README.md`

## 3. Variaveis de ambiente no Railway

- [ ] `DATABASE_URL`
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] `API_CORS_ORIGIN`
- [ ] `NEST_API_PORT`
- [ ] `CACHE_TTL_SECONDS`
- [ ] `SWAGGER_ENABLED`
- [ ] `SWAGGER_PATH`

Exemplo:

```env
DATABASE_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
API_CORS_ORIGIN=https://seu-app.vercel.app
NEST_API_PORT=3334
CACHE_TTL_SECONDS=30
SWAGGER_ENABLED=true
SWAGGER_PATH=docs
```

## 4. Configuracao recomendada no Railway

Build:

```bash
npm install && npm run prisma:generate && npm run build
```

Start:

```bash
npm run start:prod
```

## 5. Testes apos deploy

- [ ] `GET /health`
- [ ] `GET /docs`
- [ ] testar um endpoint autenticado com Bearer token
- [ ] validar CORS a partir do frontend publicado

## 6. Vercel

No frontend, configurar:

```env
VITE_API_URL=https://sua-api.railway.app
```

## 7. URLs finais

- Health:

```txt
https://sua-api.railway.app/health
```

- Swagger:

```txt
https://sua-api.railway.app/docs
```
