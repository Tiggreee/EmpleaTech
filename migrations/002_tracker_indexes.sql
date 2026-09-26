create index if not exists idx_tracker_entries_profile_created on tracker_entries (profile_id, creada_en desc);
create index if not exists idx_tracker_entries_job_posting on tracker_entries (job_posting_id);
create index if not exists idx_tracker_entries_analysis_result on tracker_entries (analysis_result_id);
