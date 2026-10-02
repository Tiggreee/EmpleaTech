# Seguridad

## Versiones con soporte

Solo la versión publicada en https://empleatech.site (rama `main`) y la versión actual de la extensión de Chrome reciben
correcciones de seguridad.

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Usa el reporte privado de GitHub:
[Report a vulnerability](https://github.com/Tiggreee/EmpleaTech/security/advisories/new) (pestaña «Security» → «Report
a vulnerability»). Solo tú y el mantenedor ven el reporte.

Incluye, si puedes:

- Qué parte se ve afectada (app web, API, extensión) y en qué versión o fecha.
- Pasos para reproducirlo o una prueba de concepto mínima.
- El impacto que ves (por ejemplo: leer datos de otra cuenta, saltarse el inicio de sesión, ejecutar código).

Revisamos cada reporte lo antes posible y te avisamos cuando la corrección esté publicada.

## Alcance

Dentro: la app web (empleatech.site), sus APIs, el inicio de sesión (contraseña, verificación en dos pasos, sesiones),
la extensión de Chrome y la forma en que guardan y transmiten tus datos.

Fuera: ataques de denegación de servicio, ingeniería social, spam, y fallas de servicios de terceros (Vercel, Neon o las
plataformas de vacantes) que no dependan de nuestro código.

## Lo que ya hacemos

- Contraseñas con hash; verificación en dos pasos (TOTP) con secreto cifrado y códigos de respaldo de un solo uso.
- Límite de intentos de inicio de sesión con bloqueo progresivo; cerrar sesión en todos lados invalida tokens viejos.
- Encabezados de seguridad (CSP, HSTS, X-Frame-Options) y solo HTTPS.
- Dependabot, escaneo de secretos con bloqueo al subir, y escaneo de código (CodeQL) en cada cambio.
- La rama `main` está protegida: sin force-push ni borrado, y con las pruebas obligatorias.
