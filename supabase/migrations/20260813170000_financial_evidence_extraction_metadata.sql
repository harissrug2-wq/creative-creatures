-- Step 6A: metadata needed for persistent financial evidence extraction.
-- Existing rows remain valid; all columns are nullable.

alter table public.financial_evidence
  add column if not exists file_size_bytes bigint,
  add column if not exists extraction_model text,
  add column if not exists extraction_error text,
  add column if not exists extracted_at timestamptz;

create index if not exists financial_evidence_run_type_updated_idx
  on public.financial_evidence(diagnostic_run_id, evidence_type, updated_at desc);
