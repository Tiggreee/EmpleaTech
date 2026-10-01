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
| `npm run estado` | Dice si está corriendo, qué procesos son y dónde están tus datos |
| `npm run detener` | Detiene la app (solo sus procesos: nunca cierra Docker) |
| `npm run inicio:quitar` | Deja de arrancarla al iniciar sesión |
| `npm run respaldo` | Respaldo inmediato (`--lista` para verlos, `--probar` para restaurar el último en una base temporal y contar filas) |
| `npm run restaurar -- ultimo` | Reemplaza la base con un respaldo; antes respalda la actual |

Los respaldos son diarios y rotan solos: los 14 más recientes y uno por semana de las 8 anteriores.

Para desarrollar: `npm run dev -- -p 3100` (el 3000 lo usa la app diaria).

### Si Docker Desktop pide «Reset to factory defaults»

**No lo elijas: borra todos los contenedores y volúmenes.** Casi siempre es un cierre a la fuerza que dejó archivos
de conexión colgados (errores como `remove ...\Docker\run\dockerInference: The file cannot be accessed by the system`).
Con Docker cerrado («Quit») y `wsl -l -v` mostrando `docker-desktop  Stopped`:

1. Renombra `%LOCALAPPDATA%\Docker\run` y, si el error lo menciona, `%LOCALAPPDATA%\docker-secrets-engine`
   (Windows no deja borrar esos sockets, pero sí renombrar su carpeta).
2. Abre Docker Desktop: crea las carpetas limpias y tus contenedores vuelven con sus datos.

Por eso el arranque abre Docker con `start` (no como proceso hijo) y `detener` nunca cierra su árbol de procesos.

## Seguridad local

- La app y Postgres escuchan solo en `127.0.0.1`: nadie en tu red (WiFi, oficina) puede verlas.
- `src/proxy.ts` rechaza cualquier Host que no sea local (DNS rebinding) y cualquier escritura que venga de otra
  página (CSRF). Si algún día la sirves con otro nombre, agrégalo en `EMPLEATECH_HOSTS`.
- La extensión solo habla con `/api/autollenado`, con su encabezado propio y origen `chrome-extension://`.

## Seguridad en internet (`EMPLEATECH_AUTH=1`)

- **Sesión en cookie `HttpOnly` + `Secure` + `SameSite=Lax`**, nunca en `localStorage`: un script inyectado no
  puede leerla. Al salir también se borra la copia local de tu perfil.
- **Todo se valida en el servidor.** `src/proxy.ts` revisa cada página y API; `/api/seguridad` vuelve a revisar.
- **Verificación en dos pasos** (TOTP, cualquier app de autenticación) desde **Seguridad**, con 8 códigos de
  respaldo de un solo uso. El secreto se guarda cifrado con una llave derivada de `EMPLEATECH_SECRETO`; un código ya
  usado no sirve otra vez.
- **Límite de intentos en la base** (no en memoria: en Vercel cada petición puede caer en otra instancia). 5 fallos
  bloquean 15 minutos; cada bloqueo seguido dura el doble, hasta un día. La contraseña se cuenta por IP; los códigos,
  por cuenta.
- **Contraseñas fuertes de verdad**: mínimo 12 caracteres y sin palabras comunes, secuencias (`123456`, `qwerty`) ni
  patrones repetidos. La regla corre en el navegador para guiarte y en el servidor para decidir.
- **Sello de sesiones**: cambiar la contraseña, activar o quitar la verificación, o «Cerrar sesión en todos lados»
  invalida al instante todas las demás sesiones y el token de la extensión.

No cambies `EMPLEATECH_SECRETO` para cerrar sesiones (usa el botón): si lo cambias con la verificación activa, tu app
de autenticación deja de servir y solo entras con un código de respaldo.

**Si te quedas fuera** (olvidaste la contraseña, o perdiste el teléfono y los códigos), en la consola SQL de Neon:

```sql
delete from intentos_acceso;
delete from acceso;
```

Luego entra a `/entrar` y vuelve a crear tu contraseña con `EMPLEATECH_CODIGO_INICIAL`. Tus datos no se tocan.

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

