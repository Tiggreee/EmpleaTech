# Arquitectura

## Resumen

La app dejó de ser solo `localStorage`. Ahora es un MVP full-stack local:

- **Next.js 16** para UI y route handlers.
- **TypeScript puro en `src/core/*`** para análisis, radar, perfil y tracker.
- **Postgres local** como fuente de verdad para CVs, ofertas analizadas y postulaciones.
- **Caché ligera del navegador** solo para hidratar más rápido y facilitar migración desde la versión previa.

## Capas

```
app/ui/features
     ¦
     +--? core        (análisis, radar, seguimiento, perfil)
     +--? storage     (hooks cliente + caché local opcional)
     +--? app/api     (Route Handlers de Next)
                ¦
                +--? server (consultas SQL y reconstrucción del estado)
                           ¦
                           +--? Postgres
```

## Decisiones clave

| Decisión | Motivo |
|---|---|
| Route Handlers de Next en vez de un servidor aparte | Menos piezas para levantar el MVP y cero duplicación de runtime/autenticación local. |
| `pg` + SQL plano | El esquema es pequeño, relacional y fácil de consultar después para practicar SQL; no hace falta meter un ORM pesado todavía. |
| Estado completo sincronizado desde cliente | Mantiene intacta casi toda la lógica existente de `core/*` y permite reconstruir tablas derivadas en servidor. |
| Recalcular radar y snapshot del análisis en servidor al guardar | La base queda coherente y no depende ciegamente de payloads del navegador. |
| Caché local solo como apoyo | Si el backend local está vacío y existe data previa en navegador, la app puede migrarla al primer arranque. |

## Tablas

- `profiles`: perfil local actual.
- `cvs`: versiones del CV guardadas.
- `job_postings`: texto completo de la oferta y snapshot compacto del análisis.
- `analysis_results`: resultado persistido del análisis por oferta guardada.
- `tracker_entries`: estado, notas, fechas y sello humano de cada postulación.
- `radar_flags`: alertas individuales derivadas del radar.

## Qué sigue igual

- La lógica de matching CV?oferta sigue en `src/core/analisis`.
- El radar sigue en `src/core/radar`.
- El tracker y panel siguen usando `src/core/seguimiento`.
- Las importaciones de PDF/DOCX/TXT siguen ocurriendo dentro de la app, sin servicios externos.

## Operación local

```bash
docker-compose up -d
npm run migrate
npm run dev
```

Si quieres inspeccionar tus datos con SQL, conéctate al Postgres local usando `DATABASE_URL`.

