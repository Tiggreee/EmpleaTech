# EmpleaTech

Asistente personal de b?squeda de empleo para probar tu propio flujo con datos reales: CVs, ofertas, an?lisis explicables, radar de riesgos y tracker de postulaciones, ahora con **Postgres local** como fuente de verdad.

> El nombre vive en `src/config/app.ts` para que puedas renombrarlo sin perseguir cadenas por todo el proyecto.

## Qu? hace hoy

- Importa CVs en PDF, DOCX, TXT o texto pegado.
- Compara CV ? oferta con evidencia, brechas y habilidades transferibles.
- Detecta se?ales de fraude o riesgo en ofertas con foco en M?xico/LatAm.
- Guarda CVs, an?lisis y postulaciones en una base Postgres local.
- Muestra prioridad explicable, panel y recordatorios de seguimiento.
- Exporta el tracker a JSON o CSV.

## Requisitos

- Node.js 22+
- npm 10+
- Docker Desktop o un motor de Docker compatible con Compose

## Arranque local

```bash
npm install
Copy-Item .env.example .env
docker-compose up -d
npm run migrate
npm run dev
```

App: `http://localhost:3000`

Antes de arrancar, crea tu `.env` local desde `.env.example` y rellena `DATABASE_URL`.

Si usas el `docker-compose.yml` incluido sin cambiar variables, la URL local queda as?:

`postgresql://postgres:empleatech_dev_only_local@127.0.0.1:5432/empleatech_mvp`

> Esa contrase?a es **solo para desarrollo local**. No es segura para producci?n ni debe reutilizarse fuera de tu m?quina.

## Scripts ?tiles

```bash
npm run build
npm run test
npm run lint
npm run typecheck
npm run test:e2e
npm run recon
```

## Estructura

```
src/
  app/        Rutas de Next y API handlers
  core/       L?gica pura de an?lisis, radar, perfil y seguimiento
  server/     Acceso a Postgres y reconstrucci?n del estado
  storage/    Cach?/migraci?n local del navegador + hooks cliente
  features/   Pantallas principales
  ui/         Componentes compartidos
  content/    Contenido editorial y comparativas
migrations/   SQL plano para el esquema local
docs/         Arquitectura y despliegue futuro
```

## Flujo de datos

1. El usuario importa o edita su CV en la UI.
2. La l?gica de `src/core/*` calcula an?lisis y prioridad.
3. La UI guarda el estado completo por `/api/state`.
4. El backend reconstruye tablas relacionales en Postgres (`profiles`, `cvs`, `job_postings`, `analysis_results`, `tracker_entries`, `radar_flags`).
5. El cliente vuelve a leer desde la base para panel, tracker y exportaciones.

## Documentaci?n

- Arquitectura actual: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Siguiente paso hacia nube/OCI: [docs/ARQUITECTURA_CLOUD.md](docs/ARQUITECTURA_CLOUD.md)
- Contexto de la comparativa: [docs/INTELIGENCIA.md](docs/INTELIGENCIA.md)
