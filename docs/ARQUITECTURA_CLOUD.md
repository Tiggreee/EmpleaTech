# Arquitectura cloud (futuro)

> Este documento describe una dirección posible. No implica que ya exista infraestructura en nube ni que este repo la configure hoy.

## Desarrollo local actual

El MVP se ejecuta completo en una sola máquina:

```bash
npm install
docker-compose up -d
npm run migrate
npm run dev
```

- Next.js sirve la UI y los endpoints `/api/*`.
- Postgres corre en Docker Compose.
- Toda la información del usuario queda en esa base local.

## Camino razonable hacia OCI

1. **Aplicación**
   - Empaquetar Next.js en una imagen o desplegarlo en una instancia de cómputo.
   - Mantener los Route Handlers como API interna del mismo servicio.

2. **Base de datos**
   - Mover `DATABASE_URL` a un servicio administrado compatible con Postgres o a una base operada en una VM.
   - Como alternativa futura, evaluar una base administrada dentro del ecosistema OCI si ofrece el nivel de compatibilidad y costo deseado.

3. **Migraciones**
   - Ejecutar `npm run migrate` en el pipeline o en el primer arranque del servicio.

4. **Secretos y configuración**
   - Guardar `DATABASE_URL` y `NEXT_PUBLIC_SITE_URL` como secretos/configuración del entorno.

5. **Operación**
   - Añadir backups de base de datos.
   - Definir monitoreo básico de app y DB.
   - Más adelante, si el proyecto crece, separar perfiles/usuarios reales y autenticación.

## Qué no se hizo todavía

- Provisionar recursos OCI.
- Configurar CI/CD para despliegue.
- Diseñar autenticación multiusuario.

