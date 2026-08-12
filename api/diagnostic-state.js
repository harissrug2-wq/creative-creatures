const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const INDEXES = ['strength', 'independence', 'performance'];

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
      // sb_secret_* is an opaque API key, not a JWT.
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
  if (accountId && !String(accountId).startsWith('local-')) {
    const params = new URLSearchParams({
      select: 'id,name,email,agency_url,agency_name,diagnostic_state,report_data',
      id: `eq.${accountId}`,
      limit: '1'
    });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
  }

  const cleanEmail = lower(email);
  const normalizedUrl = normalizeAgencyUrl(agencyUrl);
  const candidates = [];

  if (cleanEmail) {
    const params = new URLSearchParams({
      select: 'id,name,email,agency_url,agency_name,diagnostic_state,report_data',
      email_normalized: `eq.${cleanEmail}`,
      limit: '2'
    });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows)) candidates.push(...rows);
  }

  if (normalizedUrl) {
    const params = new URLSearchParams({
      select: 'id,name,email,agency_url,agency_name,diagnostic_state,report_data',
      agency_url_normalized: `eq.${normalizedUrl}`,
      limit: '2'
    });
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

async function updateAccountCompatibilityState(config, accountId, diagnosticState, reportData) {
  const params = new URLSearchParams({ id: `eq.${accountId}`, select: 'id' });
  const patch = {
    diagnostic_state: diagnosticState || {},
    updated_at: new Date().toISOString()
  };
  if (reportData && typeof reportData === 'object') patch.report_data = reportData;

  await supabaseRequest(config, `accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });
}

async function getOrCreateCurrentRun(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,account_id,status,is_current,started_at,generated_at,completed_at',
    account_id: `eq.${accountId}`,
    is_current: 'eq.true',
    limit: '1'
  });
  const rows = await supabaseRequest(config, `diagnostic_runs?${params.toString()}`);
  if (Array.isArray(rows) && rows[0]) return rows[0];

  const created = await supabaseRequest(config, 'diagnostic_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ account_id: accountId, status: 'in_progress', is_current: true })
  });
  return Array.isArray(created) ? created[0] : created;
}

function normalizeValidation(value) {
  const text = clean(value).toLowerCase();
  if (text.includes('contradiction')) return 'contradiction';
  if (text.includes('verified')) return 'verified';
  return 'needs_validation';
}

function percent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number * 100) / 100));
}

function extractCategoryScores(index, details = {}) {
  if (!details || typeof details !== 'object') return {};

  if (index === 'strength') {
    return details.results?.categoryScores || details.categoryScores || {};
  }

  if (index === 'independence') {
    const categoryDetails = details.scores?.categoryDetails || details.categoryDetails || {};
    return Object.fromEntries(
      Object.entries(categoryDetails).map(([key, value]) => [
        key,
        Number(value?.categoryScore ?? value?.convertedPercentage ?? 0)
      ])
    );
  }

  if (index === 'performance') {
    return details.categoryScores || {};
  }

  return {};
}

function extractConfidence(index, details = {}) {
  if (index === 'strength') return percent(details.results?.confidenceScore ?? details.confidenceScore);
  if (index === 'independence') return percent(details.scores?.confidenceScore ?? details.confidenceScore);
  if (index === 'performance') return percent(details.confidenceScore);
  return null;
}

function extractValidation(index, details = {}) {
  if (index === 'strength') return normalizeValidation(details.results?.validationStatus ?? details.validationStatus);
  if (index === 'independence') return normalizeValidation(details.scores?.validationStatus ?? details.validationStatus);
  if (index === 'performance') return normalizeValidation(details.validationStatus);
  return 'needs_validation';
}

function extractAnswers(details = {}) {
  return details && typeof details === 'object' && details.answers && typeof details.answers === 'object'
    ? details.answers
    : {};
}

async function upsertIndexResult(config, runId, indexType, data = {}) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const params = new URLSearchParams({
    select: 'id,completed_at',
    diagnostic_run_id: `eq.${runId}`,
    index_type: `eq.${indexType}`,
    limit: '1'
  });
  const rows = await supabaseRequest(config, `index_results?${params.toString()}`);
  const existing = Array.isArray(rows) ? rows[0] : null;
  const complete = data.complete === true;

  const record = {
    diagnostic_run_id: runId,
    index_type: indexType,
    score: data.score === null || data.score === undefined ? null : percent(data.score),
    confidence: extractConfidence(indexType, details),
    validation_status: extractValidation(indexType, details),
    progress: Math.round(percent(data.progress ?? (complete ? 100 : 0)) ?? 0),
    complete,
    answers: extractAnswers(details),
    category_scores: extractCategoryScores(indexType, details),
    details,
    completed_at: complete ? (existing?.completed_at || details.completedAt || new Date().toISOString()) : null,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    const updateParams = new URLSearchParams({ id: `eq.${existing.id}` });
    await supabaseRequest(config, `index_results?${updateParams.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(record)
    });
    return existing.id;
  }

  const created = await supabaseRequest(config, 'index_results', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(record)
  });
  return Array.isArray(created) ? created[0]?.id : created?.id;
}

async function updateRun(config, run, state) {
  const indexes = state?.indexes || {};
  const completeCount = INDEXES.filter(index => indexes[index]?.complete === true).length;
  const allComplete = state?.allComplete === true || completeCount === INDEXES.length;
  const reportReady = state?.reportReady === true;

  const status = reportReady
    ? 'generated'
    : allComplete
      ? 'ready_to_generate'
      : 'in_progress';

  const patch = {
    status,
    updated_at: new Date().toISOString()
  };

  if (reportReady) patch.generated_at = state.generatedAt || new Date().toISOString();

  const params = new URLSearchParams({ id: `eq.${run.id}` });
  await supabaseRequest(config, `diagnostic_runs?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });

  return { ...run, ...patch };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const config = getSupabaseConfig();
  if (!config) {
    return json(res, 503, {
      error: 'Diagnostic database is not configured.',
      code: 'BACKEND_NOT_CONFIGURED'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const diagnosticState = body.diagnosticState || body.diagnostic_state || {};
    const reportData = body.reportData || body.report_data || {};

    const account = await findAccount(config, {
      accountId: body.accountId || body.account_id,
      email: body.email,
      agencyUrl: body.agencyUrl || body.agency_url
    });

    if (!account) return json(res, 404, { error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });

    // Keep the existing account JSON in sync during the migration period so
    // returning users and the current frontend continue to work unchanged.
    await updateAccountCompatibilityState(config, account.id, diagnosticState, reportData);

    const run = await getOrCreateCurrentRun(config, account.id);
    const indexes = diagnosticState.indexes || {};

    for (const index of INDEXES) {
      const data = indexes[index];
      if (!data || typeof data !== 'object') continue;
      await upsertIndexResult(config, run.id, index, data);
    }

    const updatedRun = await updateRun(config, run, diagnosticState);

    return json(res, 200, {
      ok: true,
      accountId: account.id,
      diagnosticRun: {
        id: updatedRun.id,
        status: updatedRun.status,
        generated_at: updatedRun.generated_at || null
      }
    });
  } catch (error) {
    console.error('diagnostic-state API error', error);
    const status = [400, 404, 409, 422].includes(error.status) ? error.status : 500;
    return json(res, status, {
      error: 'Diagnostic progress could not be saved.',
      code: 'DIAGNOSTIC_SYNC_ERROR'
    });
  }
}
