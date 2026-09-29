-- En qué plataformas freelance ya te registraste (plataforma → pendiente | registrado | descartada).
alter table profiles add column if not exists freelance_json jsonb not null default '{}'::jsonb;
