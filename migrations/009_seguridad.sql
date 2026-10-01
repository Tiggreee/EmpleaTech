-- Seguridad del acceso en internet.
--
-- sello: va dentro de cada token de sesión y de la extensión. Cambiarlo (al cambiar la contraseña, activar o quitar la
-- verificación en dos pasos, o «cerrar sesión en todos lados») invalida todos los tokens anteriores al instante.
--
-- totp_*: verificación en dos pasos con app de autenticación. El secreto se guarda cifrado (AES-256-GCM con una llave
-- derivada de EMPLEATECH_SECRETO); totp_ultimo_paso evita que un código ya usado sirva otra vez.
-- codigos_respaldo: huellas SHA-256 de los códigos de un solo uso, nunca los códigos.
alter table acceso
  add column if not exists sello text not null default replace(gen_random_uuid()::text, '-', ''),
  add column if not exists totp_secreto text,
  add column if not exists totp_activo boolean not null default false,
  add column if not exists totp_ultimo_paso bigint,
  add column if not exists codigos_respaldo text[] not null default '{}';

-- Límite de intentos. Vive en la base porque en Vercel cada petición puede caer en otra instancia: una cuenta en
-- memoria se reiniciaría sola. clave = «ip:<dirección>» para la contraseña, «cuenta:2fa» para los códigos.
create table if not exists intentos_acceso (
  clave text primary key,
  fallos integer not null default 0,
  bloqueos integer not null default 0,
  hasta timestamptz,
  ultimo timestamptz not null default now()
);
