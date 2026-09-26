# Arquitectura

## Resumen

La app dej? de ser solo `localStorage`. Ahora es un MVP full-stack local:

- **Next.js 16** para UI y route handlers.
- **TypeScript puro en `src/core/*`** para an?lisis, radar, perfil y tracker.
- **Postgres local** como fuente de verdad para CVs, ofertas analizadas y postulaciones.
- **Cach? ligera del navegador** solo para hidratar m?s r?pido y facilitar migraci?n desde la versi?n previa.

## Capas

```
app/ui/features
     ?
     +--? core        (an?lisis, radar, seguimiento, perfil)
     +--? storage     (hooks cliente + cach? local opcional)
     +--? app/api     (Route Handlers de Next)
                ?
                +--? server (consultas SQL y reconstrucci?n del estado)
                           ?
                           +--? Postgres
```

## Decisiones clave

| Decisi?n | Motivo |
|---|---|
| Route Handlers de Next en vez de un servidor aparte | Menos piezas para levantar el MVP y cero duplicaci?n de runtime/autenticaci?n local. |
| `pg` + SQL plano | El esquema es peque?o, relacional y f?cil de consultar despu?s para practicar SQL; no hace falta meter un ORM pesado todav?a. |
| Estado completo sincronizado desde cliente | Mantiene intacta casi toda la l?gica existente de `core/*` y permite reconstruir tablas derivadas en servidor. |
| Recalcular radar y snapshot del an?lisis en servidor al guardar | La base queda coherente y no depende ciegamente de payloads del navegador. |
| Cach? local solo como apoyo | Si el backend local est? vac?o y existe data previa en navegador, la app puede migrarla al primer arranque. |

## Tablas

- `profiles`: perfil local actual.
- `cvs`: versiones del CV guardadas.
- `job_postings`: texto completo de la oferta y snapshot compacto del an?lisis.
- `analysis_results`: resultado persistido del an?lisis por oferta guardada.
- `tracker_entries`: estado, notas, fechas y sello humano de cada postulaci?n.
- `radar_flags`: alertas individuales derivadas del radar.

## Qu? sigue igual

- La l?gica de matching CV?oferta sigue en `src/core/analisis`.
- El radar sigue en `src/core/radar`.
- El tracker y panel siguen usando `src/core/seguimiento`.
- Las importaciones de PDF/DOCX/TXT siguen ocurriendo dentro de la app, sin servicios externos.

## Operaci?n local

```bash
cp .env.example .env
docker-compose up -d
npm run migrate
npm run dev
```

`DATABASE_URL` se toma solo desde variables de entorno. El `docker-compose.yml` trae credenciales **dev-only** pensadas para tu m?quina local; no son una configuraci?n segura de producci?n.

Si quieres inspeccionar tus datos con SQL, con?ctate al Postgres local usando `DATABASE_URL`.
