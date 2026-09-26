# Despliegue

Este repositorio ya no es una app estática: necesita una instancia de Postgres además del runtime de Next.js.

## En local

```bash
npm install
docker-compose up -d
npm run migrate
npm run build
npm run start
```

## Variables mínimas

- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`

## Verificaciones recomendadas

- `npm run build`
- `npm run test`
- `curl http://localhost:3000/`
- `curl http://localhost:3000/analizar`

## Futuro despliegue en nube

La ruta propuesta para OCI y otros proveedores está en [ARQUITECTURA_CLOUD.md](ARQUITECTURA_CLOUD.md).

