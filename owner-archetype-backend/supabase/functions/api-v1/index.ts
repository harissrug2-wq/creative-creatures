import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { scoreAssessment } from "../../../src/lib/scoring.ts";
import { validateBackendEnv } from "./env.ts";

const PDF_BUCKET = "archetype_reports";
const PDF_MAP: Record<string, string> = {
  'firefighter_founder': 'v1/firefighter-founder.pdf',
  'creative_wizard': 'v1/creative-wizard.pdf',
  'people_pleaser': 'v1/people-pleaser.pdf',
  'control_builder': 'v1/control-builder.pdf',
  'vision_chaser': 'v1/vision-chaser.pdf'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-draft-token, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, PUT, GET, OPTIONS'
};

async function hash(data: string) {
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateHMAC(secret: string, data: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const url = new URL(req.url);

    let rawPath = url.pathname;
    let path = '/';
    if (rawPath.includes('/health')) path = '/health';
    else if (rawPath.endsWith('/readiness')) path = '/readiness';
    else if (rawPath.endsWith('/debug-readiness')) path = '/debug-readiness';
    else if (rawPath.endsWith('/admin/readiness')) path = '/admin/readiness';
    else if (rawPath.endsWith('/seed-configs')) path = '/seed-configs';
    else if (rawPath.includes('/assessments')) {
       const idx = rawPath.indexOf('/assessments');
       path = rawPath.substring(idx);
    }
    else if (rawPath.includes('/reports')) {
       const idx = rawPath.indexOf('/reports');
       path = rawPath.substring(idx);
    }
    else if (rawPath.includes('/questionnaire')) {
       const idx = rawPath.indexOf('/questionnaire');
       path = rawPath.substring(idx);
    }
    
    // Readiness Handlers
    if (req.method === 'GET' && (path === '/readiness' || path === '/admin/readiness' || path === '/debug-readiness')) {
       return await handleReadiness(req, path);
    }
    
    if (req.method === 'POST' && path === '/seed-configs') {
        const { getEnvStatus } = await import('./env.ts');
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const payload = await req.json();
        
        const { error: qErr } = await supabase.from('questionnaire_versions').insert({
           version_tag: crypto.randomUUID(),
           status: 'published',
           config_json: payload.questionnaire
        });

        const { error: rErr } = await supabase.from('rubric_versions').insert({
           version_tag: crypto.randomUUID(),
           status: 'published',
           rules_json: payload.rubric,
           tie_break_order_json: ['growth_bottlenecks', 'team_size']
        });

        return new Response(JSON.stringify({ qErr, rErr }), { headers: corsHeaders });
    }

    // -- FROM HERE ON, STRICT BACKEND ENV IS REQUIRED --
    let backendEnv;
    try {
      backendEnv = validateBackendEnv();
    } catch (err: any) {
      console.error(err.message);
      return new Response(JSON.stringify({ error: 'Internal Server Error: Backend configuration is invalid or missing.' }), { status: 500, headers: corsHeaders });
    }

    // Init Supabase Service Role client for bypass RLS in the API Layer
    const supabase = createClient(
      backendEnv.supabaseUrl,
      backendEnv.supabaseServiceRoleKey
    );

    if (req.method === 'GET' && path === '/health') return new Response('ok', { headers: corsHeaders });
    if (req.method === 'GET' && rawPath.endsWith('/debug')) return new Response(JSON.stringify({ rawPath, path, url: req.url }), { headers: corsHeaders });

    // 0. GET /questionnaire -> Get Public Configuration
    if (req.method === 'GET' && path === '/questionnaire') {
      const { data: qV } = await supabase.from('questionnaire_versions').select('config_json').eq('status', 'published').order('created_at', { ascending: false }).limit(1).single();
      if (!qV) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
      
      const clientConfig = {
         title: qV.config_json.title,
         description: qV.config_json.description,
         questions: qV.config_json.questions?.map((q: any) => ({
             internal_id: q.internal_id,
             type: q.type,
             text: q.text,
             required: q.required,
             options: q.options?.map((o: any) => ({
                 id: o.id,
                 text: o.text
             }))
         }))
      };
      return new Response(JSON.stringify(clientConfig), { headers: corsHeaders });
    }

    // 1. POST /assessments -> Create Draft
    if (req.method === 'POST' && path === '/assessments') {
      const draftToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const draftTokenHash = await hash(draftToken);
      
      const { data, error } = await supabase.from('assessments').insert({
        draft_token_hash: draftTokenHash,
        status: 'draft'
      }).select('id').single();

      if (error) throw error;
      return new Response(JSON.stringify({ id: data.id, draft_token: draftToken }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. PUT /assessments/:id -> Save Draft
    if (req.method === 'PUT' && path.match(/^\/assessments\/[^/]+$/)) {
      const id = path.split('/')[2];
      const draftToken = req.headers.get('x-draft-token') || req.headers.get('draft_token');
      if (!draftToken) return new Response(JSON.stringify({ error: 'Missing draft_token' }), { status: 401, headers: corsHeaders });
      
      const draftTokenHash = await hash(draftToken);
      
      // Verify token
      const { data: assessment, error: astErr } = await supabase.from('assessments').select('status').eq('id', id).eq('draft_token_hash', draftTokenHash).single();
      if (astErr || !assessment) return new Response(JSON.stringify({ error: 'Unauthorized or not found' }), { status: 401, headers: corsHeaders });
      if (assessment.status !== 'draft') return new Response(JSON.stringify({ error: 'Cannot modify non-draft' }), { status: 400, headers: corsHeaders });

      const payload = await req.json();
      
      if (payload.annual_revenue && !['under_1m', 'between_1m_2m', 'between_2m_3m', 'over_3m'].includes(payload.annual_revenue)) {
        return new Response(JSON.stringify({ error: 'Invalid annual_revenue value' }), { status: 400, headers: corsHeaders });
      }

      // Update assessment profile fields
      const updates: any = {};
      ['first_name', 'last_name', 'agency_website', 'email', 'annual_revenue', 'benchmark_interest'].forEach(k => {
        if (payload[k] !== undefined) updates[k] = payload[k];
      });
      if (Object.keys(updates).length > 0) {
        await supabase.from('assessments').update(updates).eq('id', id);
      }

      let ansErrObj = null;
      // Upsert answers if provided
      const answerInserts: any[] = [];
      if (payload.answers && Array.isArray(payload.answers)) {
         payload.answers.forEach((a: any) => {
            answerInserts.push({
               assessment_id: id,
               question_internal_id: a.question_internal_id,
               raw_value: String(a.raw_value)
            });
         });
      } else {
         // Support flat dictionary format from UI
         const profileKeys = ['first_name', 'last_name', 'agency_website', 'email', 'annual_revenue', 'benchmark_interest'];
         for (const [k, v] of Object.entries(payload)) {
            if (!profileKeys.includes(k) && v !== undefined && v !== null && k !== 'answers') {
                answerInserts.push({
                   assessment_id: id,
                   question_internal_id: k,
                   raw_value: String(v)
                });
            }
         }
      }

      if (answerInserts.length > 0) {
         const { error: ansErr } = await supabase.from('assessment_answers').upsert(answerInserts, { onConflict: 'assessment_id,question_internal_id' });
         if (ansErr) {
           console.error("ansErr:", ansErr);
           ansErrObj = ansErr;
         }
      }

      return new Response(JSON.stringify({ success: true, ansErr: ansErrObj }), { headers: corsHeaders });
    }

    // 2.5 GET /assessments/:id/status -> Poll Processing Status
    if (req.method === 'GET' && path.match(/^\/assessments\/[^/]+\/status$/)) {
      const id = path.split('/')[2];
      const passedDraftToken = req.headers.get('x-draft-token');
      if (!passedDraftToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      const passedDraftHash = await hash(passedDraftToken);

      const { data: assessment } = await supabase.from('assessments').select('status, submission_idempotency_key').eq('id', id).eq('draft_token_hash', passedDraftHash).single();
      if (!assessment) return new Response(JSON.stringify({ error: 'Not found or unauthorized' }), { status: 404, headers: corsHeaders });

      if (['draft', 'submitted', 'scored'].includes(assessment.status)) {
         return new Response(JSON.stringify({ status: 'processing' }), { headers: corsHeaders });
      } else if (['report_rendered', 'completed'].includes(assessment.status)) {
         const { data: rep } = await supabase.from('generated_reports').select('report_token_hash').eq('assessment_id', id).single();
         if (!rep) return new Response(JSON.stringify({ status: 'processing' }), { headers: corsHeaders });
         
         const secret = Deno.env.get('REPORT_TOKEN_SECRET');
         if (!secret) return new Response(JSON.stringify({ status: 'failed', message: 'System Error' }), { status: 500, headers: corsHeaders });

         const reportToken = await generateHMAC(secret, `creative-creature:report:v1:${id}:${assessment.submission_idempotency_key}`);
         return new Response(JSON.stringify({ status: 'completed', report_token: reportToken }), { headers: corsHeaders });
      } else {
         return new Response(JSON.stringify({ status: 'failed', message: 'Processing failed' }), { status: 500, headers: corsHeaders });
      }
    }

    // 3. POST /assessments/:id/submit -> Final Submission & Scoring
    if (req.method === 'POST' && path.match(/^\/assessments\/[^/]+\/submit$/)) {
      const id = path.split('/')[2];
      const idempotencyKey = req.headers.get('idempotency-key');
      if (!idempotencyKey) return new Response(JSON.stringify({ error: 'Idempotency-Key required' }), { status: 400, headers: corsHeaders });
      
      const passedDraftToken = req.headers.get('x-draft-token');
      if (!passedDraftToken) return new Response(JSON.stringify({ error: 'x-draft-token required for submission and idempotency' }), { status: 401, headers: corsHeaders });
      const passedDraftHash = await hash(passedDraftToken);

      // Atomic Status Transition Lock
      const { data: updatedAssessment, error: updateError } = await supabase
        .from('assessments')
        .update({ status: 'submitted', submission_idempotency_key: idempotencyKey })
        .eq('id', id)
        .eq('status', 'draft')
        .eq('draft_token_hash', passedDraftHash) // strictly enforce ownership to even attempt lock
        .select('id, status, submission_idempotency_key, draft_token_hash')
        .single();

      if (updateError || !updatedAssessment) {
        // Concurrency / Idempotency check: loser branch
        const { data: existing } = await supabase.from('assessments')
          .select('id, status, draft_token_hash')
          .eq('id', id)
          .eq('submission_idempotency_key', idempotencyKey)
          .eq('draft_token_hash', passedDraftHash) // enforce ownership
          .single();

        if (existing) {
          // Bounded Poll for report completion (up to 5 seconds)
          let reportObj = null;
          let retries = 5;
          while (retries > 0) {
             // Re-check assessment status to see if it crashed
             const { data: checkAssm } = await supabase.from('assessments').select('status').eq('id', id).single();
             if (checkAssm && ['completed', 'report_rendered'].includes(checkAssm.status)) {
                 const { data: rep } = await supabase.from('generated_reports').select('*').eq('assessment_id', id).single();
                 if (rep && rep.html_snapshot && rep.snapshot_hash) {
                    reportObj = rep;
                    break;
                 }
             }
             // If stuck in submitted/scored for too long across retries, a real implementation would
             // trigger a background job or dead-letter queue here.
             await new Promise(r => setTimeout(r, 1000));
             retries--;
          }

          if (!reportObj) {
             return new Response(JSON.stringify({ 
                status: 'processing', 
                assessment_id: existing.id, 
                retry_after_seconds: 2, 
                status_url: `/assessments/${existing.id}/status` 
             }), { status: 202, headers: corsHeaders });
          }

          const secret = Deno.env.get('REPORT_TOKEN_SECRET');
          if (!secret) return new Response(JSON.stringify({ error: 'Critical Configuration Error: REPORT_TOKEN_SECRET missing' }), { status: 500, headers: corsHeaders });
          const reportToken = await generateHMAC(secret, `creative-creature:report:v1:${existing.id}:${idempotencyKey}`);

          return new Response(JSON.stringify({
             success: true, 
             report_token: reportToken,
             primary_archetype: reportObj.primary_archetype,
             secondary_archetype: reportObj.secondary_archetype,
             current_stage: reportObj.current_stage,
             secondary_stage: reportObj.secondary_stage,
             snapshot_hash: reportObj.snapshot_hash,
             message: 'Returned existing idempotent result' 
          }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: 'Assessment already submitted, locked, or unauthorized', updateError, passedDraftHash, id }), { status: 400, headers: corsHeaders });
      }

      // If we got here, we won the atomic lock. Proceed with calculation.
      if (!updatedAssessment) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });

      // Check revenue required
      const { data: assessmentFull } = await supabase.from('assessments').select('first_name, annual_revenue').eq('id', id).single();
      if (!assessmentFull?.annual_revenue) return new Response(JSON.stringify({ error: 'Annual revenue required' }), { status: 400, headers: corsHeaders });

      // Ensure active configs are published before processing
      const { data: qV } = await supabase.from('questionnaire_versions').select('status').order('published_at', { ascending: false }).limit(1).single();
      const { data: rV } = await supabase.from('rubric_versions').select('*').eq('status', 'published').limit(1).single();
      const { data: tV } = await supabase.from('report_templates').select('status').eq('status', 'published').limit(1).single();

      if (!qV || qV.status !== 'published' || !rV || !tV) {
         // Revert the atomic lock so it can be retried later when configs are ready
         await supabase.from('assessments').update({ status: 'draft', submission_idempotency_key: null }).eq('id', id);
         return new Response(JSON.stringify({ error: 'System Configuration Incomplete. Production submission is currently blocked.' }), { status: 403, headers: corsHeaders });
      }

      // Load answers
      const { data: answersRows } = await supabase.from('assessment_answers').select('*').eq('assessment_id', id);
      const answers: any = {};
      answersRows?.forEach(r => answers[r.question_internal_id] = r.raw_value);

      const scoreResult = scoreAssessment(answers);
      
      // Update state to scored
      await supabase.from('assessments').update({ status: 'scored' }).eq('id', id);
      
      // Deterministic Report Token via HMAC
      const secret = Deno.env.get('REPORT_TOKEN_SECRET');
      if (!secret) return new Response(JSON.stringify({ error: 'Critical Configuration Error: REPORT_TOKEN_SECRET missing' }), { status: 500, headers: corsHeaders });
      
      const tokenData = `creative-creature:report:v1:${id}:${idempotencyKey}`;
      const reportToken = await generateHMAC(secret, tokenData);
      const reportTokenHash = await hash(reportToken);

      const archetypeNames: Record<string, string> = {
        'firefighter_founder': 'The Firefighter Founder',
        'creative_wizard': 'The Creative Wizard',
        'people_pleaser': 'The People Pleaser',
        'control_builder': 'The Control Builder',
        'vision_chaser': 'The Vision Chaser'
      };
      
      // Fetch the short description from the rubric version to avoid hardcoding here
      const rubricConfig = rV.rules_json || {};
      const shortDescription = rubricConfig[scoreResult.primary_archetype] || 'Your archetype dictates your creative direction.';

      // Compose HTML safely
      const sanitizedName = assessmentFull.first_name ? assessmentFull.first_name.replace(/</g, "&lt;") : 'Founder';
      const htmlSnapshot = `
        <div id="report-container">
          <section id="personalized-greeting"><h1>Hi ${sanitizedName}</h1></section>
          <section id="primary-archetype">
            <h2>You are:</h2>
            <h3>${archetypeNames[scoreResult.primary_archetype]}</h3>
            <p>${shortDescription}</p>
          </section>
        </div>
      `;
      const snapshotHash = await hash(htmlSnapshot);

      // Transaction simulation via RPC or multiple inserts
      const { error: arErr } = await supabase.from('assessment_results').insert({
        assessment_id: id,
        primary_archetype: scoreResult.primary_archetype,
        secondary_archetype: scoreResult.secondary_archetype,
        primary_archetype_score: scoreResult.archetype_scores[scoreResult.primary_archetype],
        secondary_archetype_score: scoreResult.archetype_scores[scoreResult.secondary_archetype],
        archetype_score_margin: scoreResult.archetype_scores[scoreResult.primary_archetype] - scoreResult.archetype_scores[scoreResult.secondary_archetype],
        archetype_tie_break_json: { primary: scoreResult.archetype_primary_trace, secondary: scoreResult.archetype_secondary_trace },
        current_stage: scoreResult.current_stage,
        secondary_stage: scoreResult.secondary_stage,
        current_stage_score: scoreResult.stage_scores[scoreResult.current_stage],
        secondary_stage_score: scoreResult.stage_scores[scoreResult.secondary_stage],
        stage_tie_break_json: { primary: scoreResult.stage_primary_trace, secondary: scoreResult.stage_secondary_trace }
      });
      if (arErr) console.error("AR Insert Error:", arErr);

      const { error: grErr } = await supabase.from('generated_reports').insert({
        assessment_id: id,
        report_token_hash: reportTokenHash,
        report_token_key_version: 1,
        html_snapshot: htmlSnapshot,
        snapshot_hash: snapshotHash,
        primary_archetype: scoreResult.primary_archetype,
        secondary_archetype: scoreResult.secondary_archetype,
        current_stage: scoreResult.current_stage,
        secondary_stage: scoreResult.secondary_stage,
        pdf_storage_path: PDF_MAP[scoreResult.primary_archetype]
      });

      // Update assessment to report_rendered and then completed
      await supabase.from('assessments').update({ status: 'report_rendered' }).eq('id', id);
      
      await supabase.from('assessments').update({
        status: 'completed',
        // DO NOT nullify draft_token_hash. Leave it for status polling / idempotent retries.
        completed_at: new Date().toISOString()
      }).eq('id', id);

      // Unified Response Builder
      return new Response(JSON.stringify({ 
         success: true, 
         report_token: reportToken,
         primary_archetype: scoreResult.primary_archetype,
         secondary_archetype: scoreResult.secondary_archetype,
         current_stage: scoreResult.current_stage,
         secondary_stage: scoreResult.secondary_stage,
         snapshot_hash: snapshotHash,
         errors: { arErr, grErr }
      }), { headers: corsHeaders });
    }

    // 4. GET /reports/:token -> Secure Fetch
    if (req.method === 'GET' && path.match(/^\/reports\/[^/]+$/)) {
      const token = path.split('/')[2];
      const tokenHash = await hash(token);

      const { data: report } = await supabase.from('generated_reports').select('assessment_id, html_snapshot, generated_at, pdf_available, primary_archetype').eq('report_token_hash', tokenHash).single();
      if (!report) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });

      const { data: assessment } = await supabase.from('assessments').select('first_name').eq('id', report.assessment_id).single();
      
      const archetypeNames: Record<string, string> = {
        'firefighter_founder': 'The Firefighter Founder',
        'creative_wizard': 'The Creative Wizard',
        'people_pleaser': 'The People Pleaser',
        'control_builder': 'The Control Builder',
        'vision_chaser': 'The Vision Chaser'
      };
      
      const { data: rV } = await supabase.from('rubric_versions').select('rules_json').eq('status', 'published').limit(1).single();
      const rubricConfig = rV?.rules_json || {};
      const shortDescription = rubricConfig[report.primary_archetype] || 'Your archetype dictates your creative direction.';

      const payload = {
        first_name: assessment?.first_name || 'Founder',
        primary_archetype: report.primary_archetype,
        primary_archetype_name: archetypeNames[report.primary_archetype],
        short_description: shortDescription,
        html_snapshot: report.html_snapshot,
        pdf_available: report.pdf_available,
        generated_at: report.generated_at
      };

      return new Response(JSON.stringify(payload), { headers: corsHeaders });
    }

    // 5. GET /reports/:token/pdf/download -> PDF Signed URL Redirect
    if (req.method === 'GET' && path.match(/^\/reports\/[^/]+\/pdf\/download$/)) {
      const token = path.split('/')[2];
      const tokenHash = await hash(token);

      const { data: report } = await supabase.from('generated_reports').select('id, assessment_id, pdf_storage_path').eq('report_token_hash', tokenHash).single();
      if (!report || !report.pdf_storage_path) return new Response('PDF Not found', { status: 404 });

      // Generate 15 minute signed URL with download flag
      const { data: signedUrl, error: urlErr } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(report.pdf_storage_path, 900, { download: true });
      
      if (urlErr || !signedUrl) return new Response('Storage Error', { status: 500 });

      // Track event
      await supabase.from('report_download_events').insert({
        report_id: report.id,
        assessment_id: report.assessment_id,
        primary_archetype: report.pdf_storage_path.replace('.pdf', ''),
        pdf_storage_path: report.pdf_storage_path,
        signed_url_expires_at: new Date(Date.now() + 900000).toISOString(),
        ip_address: req.headers.get('x-forwarded-for'),
        user_agent: req.headers.get('user-agent')
      });

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': signedUrl.signedUrl
        }
      });
    }

    // 6. POST /reports/:token/email -> Queue Email Delivery via Resend
    if (req.method === 'POST' && path.match(/^\/reports\/[^/]+\/email$/)) {
      const token = path.split('/')[2];
      const tokenHash = await hash(token);
      const { email } = await req.json();

      if (!email || !email.includes('@')) return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers: corsHeaders });

      const { data: report } = await supabase.from('generated_reports')
        .select('id, assessment_id, pdf_storage_path')
        .eq('report_token_hash', tokenHash).single();
      
      if (!report) return new Response(JSON.stringify({ error: 'Report not found' }), { status: 404, headers: corsHeaders });

      const { data: assessment } = await supabase.from('assessments').select('first_name').eq('id', report.assessment_id).single();
      
      const archetypeId = report.pdf_storage_path.replace('.pdf', '');

      // Send via Resend
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const webUrl = `${Deno.env.get('FRONTEND_URL')}/report/${token}`;
      const pdfUrl = `${Deno.env.get('FRONTEND_URL')}/api/v1/reports/${token}/pdf/download`;

      const resendReq = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Creative Creature <reports@creativecreature.co>',
          to: email,
          subject: 'Your Agency Archetype Report is Ready',
          html: `
            <h1>Hi ${assessment?.first_name || 'Founder'},</h1>
            <p>Your archetype is the <strong>${archetypeId}</strong>.</p>
            <p><a href="${webUrl}">View Your Personalized Result</a></p>
            <p><a href="${pdfUrl}">Download Your Full Archetype Report</a></p>
          `
        })
      });

      const resendRes = await resendReq.json();
      
      if (!resendReq.ok) {
        // Handle failure
        await supabase.from('email_deliveries').insert({
          assessment_id: report.assessment_id,
          status: 'failed',
          error_details: JSON.stringify(resendRes)
        });
        return new Response(JSON.stringify({ error: 'Failed to queue email' }), { status: 500, headers: corsHeaders });
      }

      await supabase.from('email_deliveries').insert({
        assessment_id: report.assessment_id,
        provider_message_id: resendRes.id,
        status: 'queued'
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // 7. POST /webhooks/resend -> Process email delivery statuses idempotently
    if (req.method === 'POST' && path === '/webhooks/resend') {
      const payload = await req.json();
      const messageId = payload?.data?.email_id;
      const status = payload?.type?.replace('email.', ''); // e.g. email.delivered -> delivered

      if (messageId && status && ['sent', 'delivered', 'bounced', 'complained'].includes(status)) {
        await supabase.from('email_deliveries')
          .update({ status: status, webhook_updated_at: new Date().toISOString() })
          .eq('provider_message_id', messageId);
      }

      return new Response('Webhook received', { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders });
  } catch (error) {
    console.error("Unhandled Exception:", error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers: corsHeaders });
  }

async function handleReadiness(req: Request, path: string) {
  const { getEnvStatus } = await import('./env.ts');
  const envStatus = getEnvStatus();
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check configs
  const { count: qCount } = await supabase.from('questionnaire_versions').select('*', { count: 'exact', head: true }).eq('status', 'published');
  const { count: rCount } = await supabase.from('rubric_versions').select('*', { count: 'exact', head: true }).eq('status', 'published');
  const { count: tCount } = await supabase.from('report_templates').select('*', { count: 'exact', head: true }).eq('status', 'published');

  // Verify Stage Q5
  let stageQ5Configured = false;
  if (qCount && qCount > 0) {
     const { data: qData, error } = await supabase.from('questionnaire_versions').select('config_json').eq('status', 'published').order('created_at', { ascending: false }).limit(1).single();
     if (error) console.error(error);
     if (qData) {
        const q5 = qData.config_json.questions?.find((q: any) => q.internal_id === 'stage_q5');
        if (q5 && q5.options && Array.isArray(q5.options) && q5.options.length === 7) {
            const expectedKeys = ['A','B','C','D','E','F','G'];
            const keys = q5.options.map((o:any) => o.id);
            const stages = q5.options.map((o:any) => o.mapped_stage || o.agency_stage_mapping);
            const expectedStages = ['survival','traction','unstable_growth','operational_strain','plateau_complexity','scale_readiness','asset_stage'];
            if (expectedKeys.every(k => keys.includes(k)) && expectedStages.every(s => stages.includes(s))) {
               stageQ5Configured = true;
            }
        }
     }
  }

  // Verify PDFs
  let pdfMappingsAvailable = 0;
  const expectedTemplates = ['firefighter_founder','creative_wizard','people_pleaser','control_builder','vision_chaser'];
  
  const { data: bucketFilesRoot } = await supabase.storage.from(PDF_BUCKET).list();
  const { data: bucketFilesV1 } = await supabase.storage.from(PDF_BUCKET).list('v1');
  const bucketFiles = [...(bucketFilesRoot || []), ...(bucketFilesV1 || [])];
  if (bucketFiles) {
     for (const t of expectedTemplates) {
         if (PDF_MAP[t]) {
             const expectedFileName = PDF_MAP[t].replace('v1/', '');
             const fileInfo = bucketFiles.find(f => f.name === expectedFileName);
             if (fileInfo && fileInfo.metadata?.mimetype === 'application/pdf') {
                 pdfMappingsAvailable++;
             }
         }
     }
  }

  const questionnairePublished = (qCount ?? 0) > 0;
  const rubricPublished = (rCount ?? 0) > 0;
  const reportTemplatesCount = tCount ?? 0;

  const coreReady = 
     envStatus.reportTokenSecret && 
     questionnairePublished && 
     stageQ5Configured && 
     rubricPublished && 
     reportTemplatesCount === 5 && 
     pdfMappingsAvailable === 5;

  const emailEnabled = envStatus.resendConfigured;

  if (path === '/readiness' || path === '/debug-readiness') {
     return new Response(JSON.stringify({ 
       acceptingSubmissions: coreReady,
       message: coreReady ? "System is fully operational and accepting submissions." : "System configuration is currently in progress.",
       debug: path === '/debug-readiness' ? {
           reportTokenSecret: envStatus.reportTokenSecret,
           questionnairePublished,
           stageQ5Configured,
           rubricPublished,
           reportTemplatesCount,
           pdfMappingsAvailable,
           bucketFiles: bucketFiles
       } : undefined
     }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } else {
     // Admin route
     const authHeader = req.headers.get('Authorization');
     if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
     const token = authHeader.replace('Bearer ', '');
     const { data: { user } } = await supabase.auth.getUser(token);
     if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });
     
     const { data: adminProfile } = await supabase.from('admin_profiles').select('role').eq('id', user.id).single();
     if (!adminProfile) return new Response('Forbidden', { status: 403, headers: corsHeaders });

     return new Response(JSON.stringify({
       isReady: coreReady,
       reportTokenSecret: envStatus.reportTokenSecret,
       questionnairePublished,
       stageQ5Configured,
       rubricPublished,
       reportTemplatesCount,
       pdfMappingsAvailable,
       optionalFeatures: {
          emailConfigured: envStatus.resendConfigured,
          emailEnabled
       }
     }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
});
