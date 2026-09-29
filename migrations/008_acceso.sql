-- Contraseña de acceso cuando EmpleaTech vive en internet (una sola persona: una sola fila). Solo el hash scrypt.
create table if not exists acceso (
  id smallint primary key default 1 check (id = 1),
  hash text not null,
  actualizado_en timestamptz not null default now()
);
