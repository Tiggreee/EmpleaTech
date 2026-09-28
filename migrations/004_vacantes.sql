-- Vacantes encontradas en las plataformas, ya puntuadas contra el CV activo.
alter table profiles add column if not exists busqueda_json jsonb not null default '{}'::jsonb;

create table if not exists vacantes (
  profile_id text not null references profiles(id) on delete cascade,
  id text not null,
  fuente text not null,
  datos_json jsonb not null,
  resumen_json jsonb not null,
  prioridad_json jsonb not null,
  score integer,
  -- nueva: por revisar · guardada: pasó al tracker · descartada: no interesa (no vuelve a aparecer)
  estado text not null default 'nueva' check (estado in ('nueva', 'guardada', 'descartada')),
  encontrada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  primary key (profile_id, id)
);

create index if not exists idx_vacantes_profile_estado_score on vacantes (profile_id, estado, score desc nulls last);

-- Última consulta a cada plataforma, para respetar el intervalo mínimo de sus términos de uso.
create table if not exists consultas_fuente (
  profile_id text not null references profiles(id) on delete cascade,
  fuente text not null,
  ultima_en timestamptz not null,
  estado text not null,
  detalle text,
  primary key (profile_id, fuente)
);
