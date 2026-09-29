# Despliegue

Este repositorio ya no es una app estática: necesita una instancia de Postgres además del runtime de Next.js.

## En local

Una sola vez:

```bash
npm install
npm run inicio:instalar   # Windows: arranca sola al iniciar sesión
npm run arrancar -- --segundo-plano
```

`arrancar` enciende Docker y la base si hace falta, aplica migraciones, construye la app cuando cambió el código
(en `.next-app/`, aparte de los builds de desarrollo y pruebas), respalda la base si toca y sirve la app en
http://localhost:3000. Si la app se cae, la vuelve a levantar. Registros y respaldos viven fuera del repositorio, en
`%LOCALAPPDATA%\EmpleaTech` (o `EMPLEATECH_DATOS`).

| Comando | Qué hace |
|---|---|
| `npm run detener` | Detiene la app que corre en segundo plano |
| `npm run inicio:quitar` | Deja de arrancarla al iniciar sesión |
| `npm run respaldo` | Respaldo inmediato (`--lista` para verlos, `--probar` para restaurar el último en una base temporal y contar filas) |
| `npm run restaurar -- ultimo` | Reemplaza la base con un respaldo; antes respalda la actual |

Los respaldos son diarios y rotan solos: los 14 más recientes y uno por semana de las 8 anteriores.

Para desarrollar: `npm run dev -- -p 3100` (el 3000 lo usa la app diaria).

## Seguridad local

- La app y Postgres escuchan solo en `127.0.0.1`: nadie en tu red (WiFi, oficina) puede verlas.
- `src/proxy.ts` rechaza cualquier Host que no sea local (DNS rebinding) y cualquier escritura que venga de otra
  página (CSRF). Si algún día la sirves con otro nombre, agrégalo en `EMPLEATECH_HOSTS`.
- La extensión solo habla con `/api/autollenado`, con su encabezado propio y origen `chrome-extension://`.

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

