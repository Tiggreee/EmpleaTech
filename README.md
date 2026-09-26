# EmpleaTech

Asistente personal de búsqueda de empleo para probar tu propio flujo con datos reales: CVs, ofertas, análisis explicables, radar de riesgos y tracker de postulaciones, ahora con **Postgres local** como fuente de verdad.

> El nombre vive en `src/config/app.ts` para que puedas renombrarlo sin perseguir cadenas por todo el proyecto.

## Qué hace hoy

- Importa CVs en PDF, DOCX, TXT o texto pegado.
- Compara CV ? oferta con evidencia, brechas y habilidades transferibles.
- Detecta señales de fraude o riesgo en ofertas con foco en México/LatAm.
- Guarda CVs, análisis y postulaciones en una base Postgres local.
- Muestra prioridad explicable, panel y recordatorios de seguimiento.
- Exporta el tracker a JSON o CSV.

## Requisitos

- Node.js 22+
- npm 10+
- Docker Desktop o un motor de Docker compatible con Compose

## Arranque local

```bash
npm install
docker-compose up -d
npm run migrate
npm run dev
```

App: `http://localhost:3000`

Base local por defecto: `postgres://postgres:postgres@127.0.0.1:5432/empleatech_mvp`

## Scripts útiles

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
  core/       Lógica pura de análisis, radar, perfil y seguimiento
  server/     Acceso a Postgres y reconstrucción del estado
  storage/    Caché/migración local del navegador + hooks cliente
  features/   Pantallas principales
  ui/         Componentes compartidos
  content/    Contenido editorial y comparativas
migrations/   SQL plano para el esquema local
docs/         Arquitectura y despliegue futuro
```

## Flujo de datos

1. El usuario importa o edita su CV en la UI.
2. La lógica de `src/core/*` calcula análisis y prioridad.
3. La UI guarda el estado completo por `/api/state`.
4. El backend reconstruye tablas relacionales en Postgres (`profiles`, `cvs`, `job_postings`, `analysis_results`, `tracker_entries`, `radar_flags`).
5. El cliente vuelve a leer desde la base para panel, tracker y exportaciones.

## Documentación

- Arquitectura actual: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Siguiente paso hacia nube/OCI: [docs/ARQUITECTURA_CLOUD.md](docs/ARQUITECTURA_CLOUD.md)
- Contexto de la comparativa: [docs/INTELIGENCIA.md](docs/INTELIGENCIA.md)

