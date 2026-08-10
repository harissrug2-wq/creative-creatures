-- 0002: Processing Recovery and Draft Expiry

-- Add controlled draft-token expiry
ALTER TABLE assessments ADD COLUMN draft_locked_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN draft_token_expires_at TIMESTAMPTZ;

-- Add real stuck-processing recovery to assessments (since generation might fail before generated_reports is inserted)
ALTER TABLE assessments ADD COLUMN processing_started_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN processing_lease_expires_at TIMESTAMPTZ;
ALTER TABLE assessments ADD COLUMN processing_attempts INTEGER DEFAULT 0;
ALTER TABLE assessments ADD COLUMN last_processing_error TEXT;

-- Admin action to forcefully reset a stuck assessment
CREATE OR REPLACE FUNCTION admin_resume_stale_assessment(p_assessment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
   IF public.get_admin_role() NOT IN ('super_admin', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized admin action';
   END IF;
   
   UPDATE assessments 
   SET status = 'draft',
       processing_attempts = 0,
       processing_lease_expires_at = NULL,
       submission_idempotency_key = NULL
   WHERE id = p_assessment_id AND status IN ('submitted', 'scored');
   
   RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the enforce_answer_mutability to consider draft_locked_at
CREATE OR REPLACE FUNCTION enforce_answer_mutability() RETURNS TRIGGER AS $$
DECLARE
  v_status assessment_status;
  v_locked_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status, draft_locked_at INTO v_status, v_locked_at FROM public.assessments WHERE id = OLD.assessment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parent assessment not found.'; END IF;
    IF v_status != 'draft' OR v_locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot delete answers when assessment is not in draft status or is locked.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.assessment_id != NEW.assessment_id THEN RAISE EXCEPTION 'Cannot change the assessment_id of an answer.'; END IF;
    IF OLD.question_internal_id != NEW.question_internal_id THEN RAISE EXCEPTION 'Cannot change the question_internal_id of an answer.'; END IF;
  END IF;

  SELECT status, draft_locked_at INTO v_status, v_locked_at FROM public.assessments WHERE id = NEW.assessment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent assessment not found.'; END IF;
  IF v_status != 'draft' OR v_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot modify answers when assessment is not in draft status or is locked.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- To fetch policies for output verification
CREATE OR REPLACE FUNCTION get_pg_policies()
RETURNS TABLE (
  schemaname NAME,
  tablename NAME,
  policyname NAME,
  roles NAME[],
  cmd CHAR,
  qual TEXT,
  with_check TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.schemaname,
    p.tablename,
    p.policyname,
    p.roles,
    p.cmd,
    pg_get_expr(p.qual, p.polrelid) AS qual,
    pg_get_expr(p.with_check, p.polrelid) AS with_check
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ORDER BY p.tablename, p.policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
