-- 0004 Fix Idempotency Check Constraint

ALTER TABLE assessments DROP CONSTRAINT chk_completed_idempotency;

ALTER TABLE assessments ADD CONSTRAINT chk_completed_idempotency CHECK (
  (status IN ('submitted', 'completed', 'report_rendered', 'scored')) = (submission_idempotency_key IS NOT NULL) OR status IN ('failed')
);
