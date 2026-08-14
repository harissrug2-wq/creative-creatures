import { buildValuationSnapshot, withValuationReportData } from './valuation-engine.js';

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const finiteOrNull = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function normalizeAgencyUrl(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path === '/' ? '' : path}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  }
}

function getSupabaseConfig() {
  const url = clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const secret = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !secret) return null;
  return { url, secret };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.secret,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || 'Database request failed.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function findAccount(config, { accountId, email, agencyUrl }) {
  const select = 'id,name,email,agency_url,agency_name,archetype_result,report_data,diagnostic_state';

  if (accountId && !String(accountId).startsWith('local-')) {
    const params = new URLSearchParams({ select, id: `eq.${accountId}`, limit: '1' });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
  }

  const candidates = [];
  const cleanEmail = lower(email);
  const normalizedUrl = normalizeAgencyUrl(agencyUrl);

  if (cleanEmail) {
    const params = new URLSearchParams({ select, email_normalized: `eq.${cleanEmail}`, limit: '2' });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows)) candidates.push(...rows);
  }

  if (normalizedUrl) {
    const params = new URLSearchParams({ select, agency_url_normalized: `eq.${normalizedUrl}`, limit: '2' });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows)) candidates.push(...rows);
  }

  const unique = new Map(candidates.map(row => [row.id, row]));
  const rows = [...unique.values()];
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) {
    const error = new Error('The supplied identifiers match more than one account.');
    error.status = 409;
    throw error;
  }
  return null;
}

async function getCurrentRun(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,account_id,status,is_current,started_at,generated_at,completed_at',
    account_id: `eq.${accountId}`,
    is_current: 'eq.true',
    limit: '1'
  });
  const rows = await supabaseRequest(config, `diagnostic_runs?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getIndexRows(config, runId) {
  const params = new URLSearchParams({
    select: 'id,index_type,score,confidence,validation_status,progress,complete,answers,category_scores,details,completed_at',
    diagnostic_run_id: `eq.${runId}`,
    order: 'index_type.asc'
  });
  const rows = await supabaseRequest(config, `index_results?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getSavedScorecard(config, runId) {
  const params = new URLSearchParams({
    select: 'id,diagnostic_run_id,performance_score,strength_score,independence_score,aofi_score,confidence,validation_status,report_data,generated_at,updated_at',
    diagnostic_run_id: `eq.${runId}`,
    limit: '1'
  });
  const rows = await supabaseRequest(config, `scorecards?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

const UI_VALIDATION = {
  verified: 'Verified',
  needs_validation: 'Needs Validation',
  contradiction: 'Significant Contradiction'
};
const VALIDATION_RANK = { verified: 0, needs_validation: 1, contradiction: 2 };

function normalizeValidation(value) {
  const text = lower(value).replace(/\s+/g, '_');
  if (text.includes('contradiction')) return 'contradiction';
  if (text.includes('verified') && !text.includes('unverified')) return 'verified';
  return 'needs_validation';
}

function worstValidation(rows) {
  return rows.reduce((worst, row) => {
    const status = normalizeValidation(row.validation_status);
    return VALIDATION_RANK[status] > VALIDATION_RANK[worst] ? status : worst;
  }, 'verified');
}

const AOFI_BANDS = [
  [90, 'Freedom Optimized', 'Highly valuable, scalable, founder-independent.'],
  [80, 'High Performing', 'Strong agency with targeted opportunities.'],
  [70, 'Growth Ready', 'Healthy business with clear capability gaps.'],
  [60, 'Developing', 'Operational improvements required before scaling.'],
  [50, 'Founder Dependent', 'Business relies heavily on founder and inconsistent systems.'],
  [0, 'At Risk', 'Significant operational and financial constraints.']
];

function aofiBand(score) {
  const row = AOFI_BANDS.find(([minimum]) => score >= minimum) || AOFI_BANDS[AOFI_BANDS.length - 1];
  return { label: row[1], meaning: row[2] };
}

const strengthCategoryNames = {
  leadership: 'Leadership System',
  operating: 'Operating System',
  financial: 'Financial Infrastructure',
  revenue: 'Revenue Infrastructure',
  people: 'People Infrastructure'
};
const strengthRecommendations = {
  leadership: 'Clarify the accountability chart, install a weekly leadership cadence, and move KPI ownership to leaders.',
  operating: 'Document core delivery, install QA ownership, and test whether SOPs survive employee turnover.',
  financial: 'Tighten monthly close, budget-versus-actual review, forecasting, and departmental KPI ownership.',
  revenue: 'Standardize CRM use, sales process, lead response, marketing cadence, and RevOps ownership.',
  people: 'Formalize hiring, onboarding, reviews, career paths, incentives, and succession coverage.'
};
const independenceCategoryNames = {
  decision: 'Decision Independence',
  revenue: 'Revenue Independence',
  delivery: 'Delivery Independence',
  leadership: 'Leadership Independence',
  strategic: 'Strategic Independence'
};
const independenceRecommendations = {
  decision: 'Transfer recurring approvals into documented decision rights owned by the leadership team.',
  revenue: 'Move pipeline, referrals, and marketing ownership away from the founder and into a measurable revenue system.',
  delivery: 'Detach the owner from project delivery, client communication, approvals, and fulfillment quality.',
  leadership: 'Make leaders responsible for meetings, planning, departmental accountability, and problem solving.',
  strategic: 'Shift owner time from operations and firefighting toward vision, strategy, coaching, and capital allocation.'
};
const performanceCategoryNames = {
  profitability: 'Profitability',
  growth: 'Growth Performance',
  revenueQuality: 'Revenue Quality',
  revenue_quality: 'Revenue Quality',
  cash: 'Cash Performance',
  capital: 'Capital Allocation'
};
const performanceRecommendations = {
  profitability: 'Improve gross margin, net margin, SDE margin, margin stability, gross profit growth, and profit conversion.',
  growth: 'Build consistent, predictable revenue and net-income growth rather than relying on volatile spikes.',
  revenueQuality: 'Increase recurring revenue, reduce client concentration, diversify revenue, and extend client tenure and contracts.',
  revenue_quality: 'Increase recurring revenue, reduce client concentration, diversify revenue, and extend client tenure and contracts.',
  cash: 'Build cash reserves, improve operating cash flow, strengthen the current ratio, accelerate collections, and reduce leverage.',
  capital: 'Track reinvestment, ROIC-Lite, technology and talent returns, and retained earnings growth.'
};

function categoryRows(row, names, weightFor) {
  const scores = row.category_scores && typeof row.category_scores === 'object' ? row.category_scores : {};
  return Object.entries(scores)
    .map(([key, raw]) => {
      const score = clamp(raw?.categoryScore ?? raw?.convertedPercentage ?? raw?.score ?? raw);
      return { key, name: names[key] || key, score, weight: typeof weightFor === 'function' ? weightFor(key) : weightFor };
    })
    .sort((a, b) => a.score - b.score);
}

function reportFromRow(row) {
  const details = row.details && typeof row.details === 'object' ? row.details : {};
  const score = clamp(row.score);
  const validation = UI_VALIDATION[normalizeValidation(row.validation_status)] || 'Needs Validation';

  if (row.index_type === 'strength') {
    const categories = categoryRows(row, strengthCategoryNames, 20);
    const weakest = categories[0] || { key: 'operating', name: 'Operating System', score: 0 };
    const confidence = clamp(row.confidence ?? details.results?.confidenceScore ?? details.confidenceScore ?? 60);
    return {
      id: 'strength', title: 'Agency Strength Index', score,
      executiveQuestion: 'Can this business continue performing if it doubled in size over the next 24 months?',
      confidence, validation,
      narrative: `The agency scored ${score} across five equally weighted infrastructure systems. ${weakest.name} is the lowest-scoring capability at ${weakest.score}. The questionnaire is an initial operating hypothesis; connected evidence is still required to verify that the systems work under stress.`,
      categories,
      primaryConstraint: `${weakest.name} is the current structural constraint.`,
      recommendation: strengthRecommendations[weakest.key] || strengthRecommendations.operating,
      evidence: ['Agency Strength questionnaire', 'Category scores', 'Agency Scale Test'],
      missingEvidence: ['SOP library and usage', 'Leadership meeting cadence', 'KPI review history', 'Project-management telemetry', 'HR and training records'],
      sourceNote: 'Scoring: five category scores, each calculated from 6 questions x 4 points and averaged equally.'
    };
  }

  if (row.index_type === 'independence') {
    const categories = categoryRows(row, independenceCategoryNames, 20);
    const weakest = categories[0] || { key: 'decision', name: 'Decision Independence', score: 0 };
    const confidence = clamp(row.confidence ?? details.scores?.confidenceScore ?? details.confidenceScore ?? 60);
    return {
      id: 'independence', title: 'Owner Independence Index', score,
      executiveQuestion: 'Can this business succeed without its founder?',
      confidence, validation,
      narrative: `The index measures whether decisions, revenue, delivery, leadership, and strategic activity continue without the owner. ${weakest.name} is the lowest-scoring category at ${weakest.score}. Questionnaire responses establish the hypothesis; calendar, CRM, email, Slack, and financial evidence should validate actual behavior.`,
      categories,
      primaryConstraint: `${weakest.name} creates the strongest founder-dependence signal.`,
      recommendation: independenceRecommendations[weakest.key] || independenceRecommendations.decision,
      evidence: ['Owner Independence questionnaire', 'Five category scores', '90-day absence validation question'],
      missingEvidence: ['Calendar and meeting ownership', 'CRM and pipeline activity', 'Client communication ownership', 'Email and Slack decision patterns'],
      sourceNote: 'Scoring: five category scores averaged equally. The final 90-day absence question validates consistency and confidence.'
    };
  }

  const weights = { profitability: 25, growth: 20, revenueQuality: 20, revenue_quality: 20, cash: 20, capital: 15 };
  const categories = categoryRows(row, performanceCategoryNames, key => weights[key] || 0);
  const weakest = categories[0] || { key: 'profitability', name: 'Profitability', score: 0 };
  const evidenceFiles = details.evidence?.files || details.documents || [];
  const evidence = Array.isArray(evidenceFiles)
    ? evidenceFiles.map(file => file?.label || file?.type || file?.name).filter(Boolean)
    : Object.entries(evidenceFiles || {}).filter(([, value]) => Boolean(value)).map(([key, value]) => value?.name || key);
  const adjustedSDE = finiteOrNull(details.adjustedSDE);
  const roicLite = finiteOrNull(details.roicLite);
  const confidence = clamp(row.confidence ?? details.confidenceScore ?? details.confidence ?? 45);
  return {
    id: 'performance', title: 'Agency Performance Index', score,
    executiveQuestion: 'How effectively does agency management convert revenue into long-term financial value?',
    confidence, validation,
    narrative: `The performance score combines Profitability (25%), Growth (20%), Revenue Quality (20%), Cash Performance (20%), and Capital Allocation (15%). ${weakest.name} is the lowest-scoring capability at ${weakest.score}. Confidence rises only as financial evidence is supplied.`,
    categories,
    primaryConstraint: `${weakest.name} is the largest financial-value constraint.`,
    recommendation: performanceRecommendations[weakest.key] || performanceRecommendations.profitability,
    evidence: evidence.length ? evidence : ['Submitted financial evidence'],
    missingEvidence: Array.isArray(details.missingEvidence) ? details.missingEvidence : ['P&L', 'Balance Sheet', 'A/R Aging', 'Client revenue detail', 'Service revenue mix', 'Owner add-backs'],
    adjustedSDE,
    roicLite,
    evidenceLevel: details.evidenceLevel || details.confidenceLabel || 'Evidence submitted; analysis pending',
    sourceNote: 'Scoring: five capabilities weighted 25/20/20/20/15. Confidence increases as financial evidence is validated.'
  };
}

function ownerArchetype(account) {
  const report = account.report_data && typeof account.report_data === 'object' ? account.report_data : {};
  const result = account.archetype_result && typeof account.archetype_result === 'object' ? account.archetype_result : {};
  return report.archetypeTitle || report.title || result.title || result.name || 'Owner Archetype';
}

function buildModel(account, rows, generatedAt, diagnosticRunId = null) {
  const map = Object.fromEntries(rows.map(row => [row.index_type, row]));
  const required = ['performance', 'strength', 'independence'];
  for (const index of required) {
    const row = map[index];
    if (!row || row.complete !== true || !Number.isFinite(Number(row.score))) {
      const error = new Error(`The ${index} index is not complete in the database.`);
      error.status = 409;
      error.code = 'INDEX_NOT_COMPLETE';
      throw error;
    }
  }

  const reports = {
    performance: reportFromRow(map.performance),
    strength: reportFromRow(map.strength),
    independence: reportFromRow(map.independence)
  };

  const score = Math.round(reports.performance.score * 0.40 + reports.strength.score * 0.40 + reports.independence.score * 0.20);
  const confidence = Math.round(reports.performance.confidence * 0.40 + reports.strength.confidence * 0.40 + reports.independence.confidence * 0.20);
  const validationDb = worstValidation([map.performance, map.strength, map.independence]);
  const categoryRows = Object.values(reports)
    .flatMap(report => report.categories.map(category => ({ ...category, index: report.id, indexTitle: report.title })))
    .sort((a, b) => a.score - b.score);

  const weakest = categoryRows.slice(0, 5);
  const issues = weakest.map(row => ({
    capability: row.name,
    index: row.index,
    indexTitle: row.indexTitle,
    score: row.score,
    description: `${row.indexTitle} is below the other measured capabilities and should be validated before the next planning cycle.`
  }));
  const opportunities = weakest.map(row => ({
    capability: row.name,
    index: row.index,
    indexTitle: row.indexTitle,
    score: row.score,
    estimatedLift: Math.max(1, Math.round((100 - row.score) * 0.18)),
    recommendation: reports[row.index]?.recommendation || 'Validate this capability and assign a clear owner.'
  }));

  const valuation = buildValuationSnapshot(rows, { diagnosticRunId, calculatedAt: generatedAt });
  return withValuationReportData({
    title: 'Agency Scorecard',
    score,
    confidence,
    band: aofiBand(score),
    validation: UI_VALIDATION[validationDb],
    reports,
    weakest,
    issues,
    opportunities,
    archetype: ownerArchetype(account),
    generatedAt
  }, valuation);
}

async function saveScorecard(config, run, model) {
  const now = model.generatedAt || new Date().toISOString();
  const record = {
    diagnostic_run_id: run.id,
    performance_score: model.reports.performance.score,
    strength_score: model.reports.strength.score,
    independence_score: model.reports.independence.score,
    aofi_score: model.score,
    confidence: model.confidence,
    validation_status: normalizeValidation(model.validation),
    report_data: model,
    generated_at: now,
    updated_at: now
  };

  const saved = await supabaseRequest(config, 'scorecards?on_conflict=diagnostic_run_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record)
  });

  const runParams = new URLSearchParams({ id: `eq.${run.id}` });
  await supabaseRequest(config, `diagnostic_runs?${runParams.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'generated', generated_at: now, updated_at: now })
  });

  return Array.isArray(saved) ? saved[0] : saved;
}


async function updateSavedScorecardReport(config, scorecardId, model) {
  if (!scorecardId) return;
  const params = new URLSearchParams({ id: `eq.${scorecardId}` });
  await supabaseRequest(config, `scorecards?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      report_data: model,
      updated_at: new Date().toISOString()
    })
  });
}

async function markAccountGenerated(config, account, model) {
  const current = account.diagnostic_state && typeof account.diagnostic_state === 'object' ? account.diagnostic_state : {};
  const state = {
    ...current,
    count: 3,
    allComplete: true,
    reportReady: true,
    generatedAt: model.generatedAt,
    updatedAt: model.generatedAt
  };
  const params = new URLSearchParams({ id: `eq.${account.id}` });
  await supabaseRequest(config, `accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ diagnostic_state: state, updated_at: model.generatedAt })
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });

  const config = getSupabaseConfig();
  if (!config) return json(res, 503, { error: 'Scorecard database is not configured.', code: 'BACKEND_NOT_CONFIGURED' });

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const query = req.query || {};
    const account = await findAccount(config, {
      accountId: body.accountId || body.account_id || query.accountId || query.account_id,
      email: body.email || query.email,
      agencyUrl: body.agencyUrl || body.agency_url || query.agencyUrl || query.agency_url
    });

    if (!account) return json(res, 404, { error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });
    const run = await getCurrentRun(config, account.id);
    if (!run) return json(res, 404, { error: 'No diagnostic run was found for this account.', code: 'DIAGNOSTIC_RUN_NOT_FOUND' });

    if (req.method === 'GET') {
      const saved = await getSavedScorecard(config, run.id);
      if (!saved?.report_data || !Object.keys(saved.report_data).length) {
        return json(res, 404, { error: 'The Agency Scorecard has not been generated yet.', code: 'SCORECARD_NOT_FOUND' });
      }

      // Step 7B is calculated from the current persisted index results, never
      // from demo values or stale valuation text. Refresh the snapshot when the
      // scorecard is opened so existing completed accounts are upgraded without
      // forcing a retake.
      const rows = await getIndexRows(config, run.id);
      const valuation = buildValuationSnapshot(rows, { diagnosticRunId: run.id });
      const enriched = withValuationReportData(saved.report_data, valuation);
      await updateSavedScorecardReport(config, saved.id, enriched);

      return json(res, 200, {
        ok: true,
        accountId: account.id,
        diagnosticRunId: run.id,
        scorecardId: saved.id,
        scorecard: enriched
      });
    }

    const rows = await getIndexRows(config, run.id);
    const generatedAt = new Date().toISOString();
    const model = buildModel(account, rows, generatedAt, run.id);
    const saved = await saveScorecard(config, run, model);
    await markAccountGenerated(config, account, model);

    return json(res, 200, {
      ok: true,
      accountId: account.id,
      diagnosticRunId: run.id,
      scorecardId: saved?.id || null,
      scorecard: model
    });
  } catch (error) {
    console.error('scorecard API error', error);
    const status = [400, 404, 409, 422].includes(error.status) ? error.status : 500;
    return json(res, status, {
      error: error.message || 'The Agency Scorecard could not be generated.',
      code: error.code || 'SCORECARD_API_ERROR'
    });
  }
}
