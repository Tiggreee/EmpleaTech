create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists profiles (
  id text primary key,
  display_name text not null,
  active_cv_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cvs (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  nombre text not null,
  texto text not null,
  actualizado_en timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cvs_profile_updated on cvs (profile_id, actualizado_en desc);

create table if not exists job_postings (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  cv_id text references cvs(id) on delete set null,
  empresa text not null,
  puesto text not null,
  source_url text,
  raw_text text not null,
  summary_json jsonb not null,
  score integer,
  risk_level text not null,
  analyzed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_postings_profile_analyzed on job_postings (profile_id, analyzed_at desc);

create table if not exists analysis_results (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  job_posting_id text not null references job_postings(id) on delete cascade,
  cv_id text references cvs(id) on delete set null,
  summary_json jsonb not null,
  score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_analysis_results_profile_created on analysis_results (profile_id, created_at desc);

create table if not exists tracker_entries (
  id text primary key,
  profile_id text not null references profiles(id) on delete cascade,
  job_posting_id text references job_postings(id) on delete set null,
  analysis_result_id text references analysis_results(id) on delete set null,
  empresa text not null,
  puesto text not null,
  source_url text,
  score integer,
  notas text,
  estado text not null,
  creada_en timestamptz not null,
  actualizada_en timestamptz not null,
  postulada_en timestamptz,
  seguimiento_en timestamptz,
  sello_json jsonb,
  historial_json jsonb not null default '[]'::jsonb
);

create index if not exists idx_tracker_entries_profile_updated on tracker_entries (profile_id, actualizada_en desc);
create index if not exists idx_tracker_entries_profile_estado on tracker_entries (profile_id, estado);

create table if not exists radar_flags (
  id bigserial primary key,
  analysis_result_id text not null references analysis_results(id) on delete cascade,
  flag_key text not null,
  severidad text not null,
  titulo text not null,
  detalle text not null,
  evidencia text,
  created_at timestamptz not null default now()
);

create index if not exists idx_radar_flags_analysis on radar_flags (analysis_result_id);
create index if not exists idx_radar_flags_severity on radar_flags (severidad);

