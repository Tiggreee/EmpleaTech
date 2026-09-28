-- Perfil estructurado (JSON Resume) por versión de CV y respuestas frecuentes para formularios.
alter table cvs add column if not exists estructurado_json jsonb;
alter table cvs add column if not exists estructurado_editado boolean not null default false;
alter table profiles add column if not exists respuestas_json jsonb not null default '{}'::jsonb;
