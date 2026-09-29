-- Respuestas que diste a mano en formularios (etiqueta normalizada → valor), para reutilizarlas.
alter table profiles add column if not exists aprendidas_json jsonb not null default '{}'::jsonb;
