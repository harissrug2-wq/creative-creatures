-- Replace uuid-ossp with built-in gen_random_uuid()

-- 1. ENUMS
CREATE TYPE assessment_status AS ENUM ('draft', 'submitted', 'scored', 'report_rendered', 'completed', 'failed');
CREATE TYPE email_status AS ENUM ('not_requested', 'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed');
CREATE TYPE template_status AS ENUM ('draft', 'under_review', 'approved', 'archived', 'published');
CREATE TYPE admin_role_type AS ENUM ('super_admin', 'admin', 'viewer');

-- 2. ADMIN ROLES
CREATE TABLE admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role admin_role_type NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.get_admin_role() RETURNS public.admin_role_type AS $$
  SELECT role FROM public.admin_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated;

-- 3. CONFIGURATION & LOGGING TABLES
CREATE TABLE application_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES admin_profiles(id)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admin_profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE questionnaire_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag TEXT NOT NULL UNIQUE,
    status template_status NOT NULL DEFAULT 'draft',
    config_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.check_stage_q5_complete(config JSONB) RETURNS BOOLEAN AS $$
DECLARE
  q5 JSONB;
  opt JSONB;
  keys TEXT[];
  stages TEXT[];
  expected_keys TEXT[] := ARRAY['A','B','C','D','E','F','G'];
  expected_stages TEXT[] := ARRAY['survival','traction','unstable_growth','operational_strain','plateau_complexity','scale_readiness','asset_stage'];
BEGIN
  SELECT jsonb_path_query_first(config, '$.questions[*] ? (@.internal_id == "stage_q5")') INTO q5;
  IF q5 IS NULL THEN RETURN FALSE; END IF;
  IF (q5->>'required')::BOOLEAN != TRUE THEN RETURN FALSE; END IF;
  IF COALESCE(TRIM(q5->>'text'), '') = '' THEN RETURN FALSE; END IF;
  IF jsonb_array_length(q5->'options') != 7 THEN RETURN FALSE; END IF;
  FOR opt IN SELECT * FROM jsonb_array_elements(q5->'options') LOOP
    IF COALESCE(TRIM(opt->>'text'), '') = '' THEN RETURN FALSE; END IF;
    keys := array_append(keys, opt->>'id');
    stages := array_append(stages, opt->>'mapped_stage');
  END LOOP;
  IF NOT (keys @> expected_keys AND expected_keys @> keys) THEN RETURN FALSE; END IF;
  IF NOT (stages @> expected_stages AND expected_stages @> stages) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public;

ALTER TABLE questionnaire_versions ADD CONSTRAINT check_publish_stage_q5 
  CHECK (status != 'published' OR public.check_stage_q5_complete(config_json) = TRUE);

CREATE TABLE rubric_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag TEXT NOT NULL UNIQUE,
    status template_status NOT NULL DEFAULT 'draft',
    rules_json JSONB NOT NULL,
    tie_break_order_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag TEXT NOT NULL,
    archetype_slug TEXT NOT NULL,
    status template_status NOT NULL DEFAULT 'draft',
    content_json JSONB NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ASSESSMENTS
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_idempotency_key TEXT UNIQUE,
    draft_token_hash TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    agency_website TEXT,
    email TEXT,
    annual_revenue TEXT, 
    benchmark_interest BOOLEAN DEFAULT NULL,
    
    status assessment_status NOT NULL DEFAULT 'draft',
    email_status email_status NOT NULL DEFAULT 'not_requested',
    
    questionnaire_version_id UUID REFERENCES questionnaire_versions(id),
    rubric_version_id UUID REFERENCES rubric_versions(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE assessment_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    question_internal_id TEXT NOT NULL,
    selected_option_id TEXT,
    raw_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assessment_id, question_internal_id)
);

-- 5. RESULTS
CREATE TABLE assessment_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE UNIQUE,
    
    primary_archetype TEXT NOT NULL,
    secondary_archetype TEXT NOT NULL,
    primary_archetype_score INTEGER NOT NULL,
    secondary_archetype_score INTEGER NOT NULL,
    archetype_score_margin INTEGER NOT NULL,
    archetype_tie_break_json JSONB,
    
    current_stage TEXT NOT NULL,
    secondary_stage TEXT NOT NULL,
    current_stage_score INTEGER NOT NULL,
    secondary_stage_score INTEGER NOT NULL,
    stage_tie_break_json JSONB,
    
    report_template_version_id UUID REFERENCES report_templates(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. GENERATED REPORTS (IMMUTABLE)
CREATE TABLE generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE UNIQUE,
    report_token_hash TEXT NOT NULL UNIQUE, 
    report_token_key_version INTEGER NOT NULL DEFAULT 1, -- For deterministic HMAC regeneration
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    html_snapshot TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL,
    
    questionnaire_version TEXT,
    rubric_version TEXT,
    report_template_version TEXT,
    content_version TEXT,
    composer_version TEXT,
    
    primary_archetype TEXT NOT NULL,
    secondary_archetype TEXT NOT NULL,
    current_stage TEXT NOT NULL,
    secondary_stage TEXT NOT NULL,
    
    pdf_available BOOLEAN DEFAULT TRUE,
    pdf_storage_path TEXT,
    pdf_download_count INTEGER DEFAULT 0,
    last_download_requested_at TIMESTAMPTZ,
    last_signed_url_expires_at TIMESTAMPTZ,

    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REPORT DOWNLOAD EVENTS
CREATE TABLE report_download_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES generated_reports(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    primary_archetype TEXT NOT NULL,
    pdf_storage_path TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    signed_url_expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT
);

-- 8. EMAIL DELIVERIES
CREATE TABLE email_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    provider_message_id TEXT,
    status email_status NOT NULL DEFAULT 'queued',
    error_details TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    webhook_updated_at TIMESTAMPTZ
);


-- TRIGGERS & ENFORCEMENT

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER application_settings_updated_at 
BEFORE UPDATE ON application_settings FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- Immutable Configuration (Both 'approved' and 'published')
CREATE OR REPLACE FUNCTION protect_published_config() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('published', 'approved') THEN
      RAISE EXCEPTION 'Cannot delete an approved or published configuration version.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('published', 'approved') THEN
      -- Allowed to transition from approved to published WITHOUT content change
      IF OLD.status = 'approved' AND NEW.status = 'published' THEN
        IF TG_TABLE_NAME = 'questionnaire_versions' AND OLD.config_json = NEW.config_json THEN RETURN NEW; END IF;
        IF TG_TABLE_NAME = 'rubric_versions' AND OLD.rules_json = NEW.rules_json AND OLD.tie_break_order_json = NEW.tie_break_order_json THEN RETURN NEW; END IF;
        IF TG_TABLE_NAME = 'report_templates' AND OLD.content_json = NEW.content_json THEN RETURN NEW; END IF;
      END IF;
      
      RAISE EXCEPTION 'Cannot modify an approved or published configuration version. Create a new draft instead.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_questionnaire_versions BEFORE UPDATE OR DELETE ON questionnaire_versions FOR EACH ROW EXECUTE PROCEDURE protect_published_config();
CREATE TRIGGER protect_rubric_versions BEFORE UPDATE OR DELETE ON rubric_versions FOR EACH ROW EXECUTE PROCEDURE protect_published_config();
CREATE TRIGGER protect_report_templates BEFORE UPDATE OR DELETE ON report_templates FOR EACH ROW EXECUTE PROCEDURE protect_published_config();

-- Protect Historical Assessment Data from DELETE
CREATE OR REPLACE FUNCTION prevent_historical_delete() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of historical data is forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_results_delete BEFORE DELETE ON assessment_results FOR EACH ROW EXECUTE PROCEDURE prevent_historical_delete();
CREATE TRIGGER prevent_reports_delete BEFORE DELETE ON generated_reports FOR EACH ROW EXECUTE PROCEDURE prevent_historical_delete();

-- Protect Assessment Status Transitions 
CREATE OR REPLACE FUNCTION enforce_assessment_status_transition() RETURNS TRIGGER AS $$
BEGIN
  -- Same state update is allowed
  IF NEW.status = OLD.status THEN
     RETURN NEW;
  END IF;

  -- Strict forward transitions
  IF OLD.status = 'draft' AND NEW.status IN ('submitted', 'failed') THEN RETURN NEW; END IF;
  IF OLD.status = 'submitted' AND NEW.status IN ('scored', 'failed') THEN RETURN NEW; END IF;
  IF OLD.status = 'scored' AND NEW.status IN ('report_rendered', 'failed') THEN RETURN NEW; END IF;
  IF OLD.status = 'report_rendered' AND NEW.status IN ('completed', 'failed') THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Invalid assessment status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_assessment_status BEFORE UPDATE ON assessments FOR EACH ROW EXECUTE PROCEDURE enforce_assessment_status_transition();

-- Enforce Answer Mutability
CREATE OR REPLACE FUNCTION enforce_answer_mutability() RETURNS TRIGGER AS $$
DECLARE
  v_status assessment_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.assessments WHERE id = OLD.assessment_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent assessment not found.';
    END IF;
    IF v_status != 'draft' THEN
      RAISE EXCEPTION 'Cannot delete answers when assessment is not in draft status.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.assessment_id != NEW.assessment_id THEN
      RAISE EXCEPTION 'Cannot change the assessment_id of an answer.';
    END IF;
    IF OLD.question_internal_id != NEW.question_internal_id THEN
      RAISE EXCEPTION 'Cannot change the question_internal_id of an answer.';
    END IF;
  END IF;

  SELECT status INTO v_status FROM public.assessments WHERE id = NEW.assessment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent assessment not found.';
  END IF;
  IF v_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot modify answers when assessment is not in draft status.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_answers_locked BEFORE INSERT OR UPDATE OR DELETE ON assessment_answers FOR EACH ROW EXECUTE PROCEDURE enforce_answer_mutability();

-- Protect Generated Report Fields
CREATE OR REPLACE FUNCTION protect_generated_reports() RETURNS TRIGGER AS $$
BEGIN
  -- Allow only changes to is_revoked, pdf_download_count, last_download_requested_at, last_signed_url_expires_at
  IF (OLD.html_snapshot != NEW.html_snapshot) OR 
     (OLD.snapshot_hash != NEW.snapshot_hash) OR 
     (OLD.primary_archetype != NEW.primary_archetype) OR
     (OLD.assessment_id != NEW.assessment_id) OR
     (OLD.report_token_hash != NEW.report_token_hash) THEN
    RAISE EXCEPTION 'Generated report snapshots are immutable and cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_report_immutability BEFORE UPDATE ON generated_reports FOR EACH ROW EXECUTE PROCEDURE protect_generated_reports();


-- IDEMPOTENCY CHECK
ALTER TABLE assessments ADD CONSTRAINT chk_completed_idempotency CHECK (
  (status IN ('completed', 'report_rendered', 'scored')) = (submission_idempotency_key IS NOT NULL) OR status IN ('failed')
);

-- 9. EXACT RLS POLICIES
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_download_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;

-- Note: We intentionally do NOT define restrictive deny policies for anon. 
-- The absence of ALLOW policies naturally Denies all access safely.

-- ADMIN PROFILES (Only Super Admin can manage)
CREATE POLICY "admin_profiles_read" ON public.admin_profiles FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "admin_profiles_manage" ON public.admin_profiles FOR ALL TO authenticated USING (public.get_admin_role() = 'super_admin');

-- AUDIT LOGS (Read-only for all admins. Written ONLY by Service Role / Triggers. INSERT access removed)
CREATE POLICY "audit_logs_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));

-- APPLICATION SETTINGS
CREATE POLICY "app_settings_read" ON public.application_settings FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "app_settings_manage" ON public.application_settings FOR ALL TO authenticated USING (public.get_admin_role() = 'super_admin');

-- CONFIG VERSIONS (Draft edit for Admin, Publish for Super Admin only)
CREATE POLICY "q_versions_read" ON public.questionnaire_versions FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "q_versions_update_draft" ON public.questionnaire_versions FOR UPDATE TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin') AND status = 'draft') WITH CHECK (public.get_admin_role() = 'super_admin' OR status = 'draft');
CREATE POLICY "q_versions_manage" ON public.questionnaire_versions FOR ALL TO authenticated USING (public.get_admin_role() = 'super_admin');

CREATE POLICY "r_versions_read" ON public.rubric_versions FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "r_versions_manage" ON public.rubric_versions FOR ALL TO authenticated USING (public.get_admin_role() = 'super_admin');

CREATE POLICY "templates_read" ON public.report_templates FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "templates_update_draft" ON public.report_templates FOR UPDATE TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin') AND status = 'draft') WITH CHECK (public.get_admin_role() = 'super_admin' OR status = 'draft');
CREATE POLICY "templates_manage" ON public.report_templates FOR ALL TO authenticated USING (public.get_admin_role() = 'super_admin');

-- CORE ASSESSMENT DATA (READ-ONLY for all Admins. Edits happen only via Service Role)
CREATE POLICY "assessments_read" ON public.assessments FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "assessment_answers_read" ON public.assessment_answers FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "assessment_results_read" ON public.assessment_results FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "generated_reports_read" ON public.generated_reports FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "report_download_events_read" ON public.report_download_events FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
CREATE POLICY "email_deliveries_read" ON public.email_deliveries FOR SELECT TO authenticated USING (public.get_admin_role() IN ('super_admin', 'admin', 'viewer'));
