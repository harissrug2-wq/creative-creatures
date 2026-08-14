const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const DEPARTMENTS = ['Leadership', 'Marketing', 'Sales', 'Onboarding', 'Billing', 'Service Delivery', 'Client Success'];
const METRICS = [
  { id: 'ownerDelivery', group: 'Owner Dependency', label: 'Owner Time in Delivery (%)', unit: '%' },
  { id: 'ownerSales', group: 'Owner Dependency', label: 'Owner Time in Sales (%)', unit: '%' },
  { id: 'revenue', group: 'Financial', label: 'Revenue (TTM)', unit: '$' },
  { id: 'cogs', group: 'Financial', label: 'COGS % of Revenue', unit: '%' },
  { id: 'margin', group: 'Financial', label: 'Net (Profit) Margin', unit: '%' },
  { id: 'sde', group: 'Financial', label: 'SDE', unit: '$' },
  { id: 'leadership', group: 'Operational', label: 'Leadership Maturity Level', unit: 'level' },
  { id: 'aofi', group: 'Operational', label: 'Agency Owner Freedom Index (AOFI) Score', unit: 'score' },
  { id: 'valuation', group: 'Agency Value', label: 'Enterprise Valuation', unit: '$' }
];

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
  const select = 'id,name,email,agency_url,agency_name,diagnostic_state';

  if (accountId && !String(accountId).startsWith('local-')) {
    const params = new URLSearchParams({ select, id: `eq.${accountId}`, limit: '1' });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
  }

  const candidates = [];
  const normalizedEmail = lower(email);
  const normalizedUrl = normalizeAgencyUrl(agencyUrl);

  if (normalizedEmail) {
    const params = new URLSearchParams({ select, email_normalized: `eq.${normalizedEmail}`, limit: '2' });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows)) candidates.push(...rows);
  }

  if (normalizedUrl) {
    const params = new URLSearchParams({ select, agency_url_normalized: `eq.${normalizedUrl}`, limit: '2' });
    const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
    if (Array.isArray(rows)) candidates.push(...rows);
  }

  const unique = [...new Map(candidates.map(row => [row.id, row])).values()];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) {
    const error = new Error('The supplied identifiers match more than one account.');
    error.status = 409;
    throw error;
  }
  return null;
}

async function getCurrentRun(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,account_id,status,is_current,generated_at',
    account_id: `eq.${accountId}`,
    is_current: 'eq.true',
    limit: '1'
  });
  const rows = await supabaseRequest(config, `diagnostic_runs?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getScorecard(config, runId) {
  const params = new URLSearchParams({
    select: 'id,diagnostic_run_id,aofi_score,confidence,validation_status,report_data,generated_at',
    diagnostic_run_id: `eq.${runId}`,
    limit: '1'
  });
  const rows = await supabaseRequest(config, `scorecards?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getIndexRows(config, runId) {
  const params = new URLSearchParams({
    select: 'index_type,score,confidence,validation_status,category_scores,details',
    diagnostic_run_id: `eq.${runId}`
  });
  const rows = await supabaseRequest(config, `index_results?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getEvidenceRows(config, runId) {
  const params = new URLSearchParams({
    select: 'evidence_type,extraction_status,extracted_data,validation_status',
    diagnostic_run_id: `eq.${runId}`
  });
  const rows = await supabaseRequest(config, `financial_evidence?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getTargets(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,metric_id,target_type,target_value,target_notes,updated_at',
    account_id: `eq.${accountId}`,
    order: 'metric_id.asc'
  });
  const rows = await supabaseRequest(config, `agency_goals?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getDepartments(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,department,goal,owner_name,status,done_looks_like,target_completion,updated_at',
    account_id: `eq.${accountId}`,
    order: 'department.asc'
  });
  const rows = await supabaseRequest(config, `department_goals?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getRocks(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,scorecard_id,source_type,source_key,title,description,owner_name,due,status,created_at,updated_at',
    account_id: `eq.${accountId}`,
    order: 'created_at.asc'
  });
  const rows = await supabaseRequest(config, `rocks?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

function getPath(object, path) {
  if (!object || typeof object !== 'object') return null;
  const parts = path.split('.');
  let current = object;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return null;
    current = current[part];
  }
  return current;
}

function firstNumber(objects, paths) {
  for (const object of objects) {
    for (const path of paths) {
      const value = finite(getPath(object, path));
      if (value !== null) return value;
    }
  }
  return null;
}

function evidenceObjects(rows) {
  return rows
    .map(row => row?.extracted_data)
    .filter(value => value && typeof value === 'object' && Object.keys(value).length);
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(Number(value));
}

function percentage(value) {
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function metric(id, value, source, displayOverride = null) {
  const definition = METRICS.find(item => item.id === id);
  const available = value !== null && value !== undefined && value !== '';
  let actualDisplay = '—';
  if (available) {
    if (displayOverride) actualDisplay = displayOverride;
    else if (definition.unit === '$') actualDisplay = money(value);
    else if (definition.unit === '%') actualDisplay = percentage(value);
    else actualDisplay = String(value);
  }
  return {
    ...definition,
    available,
    actualValue: available ? Number(value) : null,
    actualDisplay,
    source: available ? source : 'Data not available'
  };
}

function buildMetrics(scorecard, indexRows, evidenceRows) {
  const indexMap = Object.fromEntries(indexRows.map(row => [row.index_type, row]));
  const performance = indexMap.performance || {};
  const strength = indexMap.strength || {};
  const independence = indexMap.independence || {};
  const performanceDetails = performance.details || {};
  const independenceDetails = independence.details || {};
  const strengthCategories = strength.category_scores || {};
  const extracted = evidenceObjects(evidenceRows);

  const ownerDelivery = firstNumber([independenceDetails, ...extracted], [
    'ownerTime.deliveryPercent',
    'scores.ownerTime.deliveryPercent',
    'timeAllocation.allocations.Delivery',
    'scores.timeAllocation.allocations.Delivery',
    'answers.24.allocations.Delivery',
    'owner_time.delivery_percent',
    'ownerDeliveryPercent',
    'owner_delivery_percent'
  ]);
  const ownerSales = firstNumber([independenceDetails, ...extracted], [
    'ownerTime.salesPercent',
    'scores.ownerTime.salesPercent',
    'timeAllocation.allocations.Sales',
    'scores.timeAllocation.allocations.Sales',
    'answers.24.allocations.Sales',
    'owner_time.sales_percent',
    'ownerSalesPercent',
    'owner_sales_percent'
  ]);
  const revenue = firstNumber([...extracted, performanceDetails], [
    'revenueTTM', 'ttmRevenue', 'revenue_ttm', 'financials.revenueTTM', 'financials.revenue_ttm', 'metrics.revenueTTM'
  ]);
  const cogs = firstNumber([...extracted, performanceDetails], [
    'cogsPercent', 'cogs_percent', 'cogsPct', 'financials.cogsPercent', 'financials.cogs_percent', 'metrics.cogsPercent'
  ]);
  const netMargin = firstNumber([...extracted, performanceDetails], [
    'netMargin', 'net_margin', 'netProfitMargin', 'net_profit_margin', 'financials.netMargin', 'metrics.netMargin'
  ]);
  const adjustedSDE = firstNumber([performanceDetails, ...extracted], [
    'adjustedSDE', 'adjustedSde', 'adjusted_sde', 'sde', 'financials.adjustedSDE', 'metrics.adjustedSDE'
  ]);
  const leadershipScore = firstNumber([strengthCategories], ['leadership', 'leadershipSystem', 'leadership_system']);
  const aofi = finite(scorecard?.aofi_score);
  const enterpriseValuation = firstNumber([scorecard?.report_data || {}, ...extracted], [
    'enterpriseValuation', 'enterprise_valuation', 'valuation.enterpriseValue', 'valuation.enterprise_value'
  ]);

  const leadershipDisplay = leadershipScore === null
    ? null
    : `${Math.max(0, Math.min(5, Math.round(leadershipScore / 20)))} / 5`;

  return [
    metric('ownerDelivery', ownerDelivery, 'Owner Independence · 30-day time allocation'),
    metric('ownerSales', ownerSales, 'Owner Independence · 30-day time allocation'),
    metric('revenue', revenue, 'Financial evidence'),
    metric('cogs', cogs, 'Financial evidence'),
    metric('margin', netMargin, 'Financial evidence'),
    metric('sde', adjustedSDE, 'Agency Performance · Adjusted SDE'),
    metric('leadership', leadershipScore, 'Agency Strength · Leadership System', leadershipDisplay),
    metric('aofi', aofi, 'Generated Agency Scorecard'),
    metric('valuation', enterpriseValuation, 'Approved valuation output')
  ];
}

async function loadModel(config, account) {
  const run = await getCurrentRun(config, account.id);
  if (!run) {
    const error = new Error('Complete the diagnostic before defining Agency Goals.');
    error.status = 409;
    error.code = 'DIAGNOSTIC_REQUIRED';
    throw error;
  }

  const scorecard = await getScorecard(config, run.id);
  if (!scorecard) {
    const error = new Error('Generate the Agency Scorecard before defining Agency Goals.');
    error.status = 409;
    error.code = 'SCORECARD_REQUIRED';
    throw error;
  }

  const [indexRows, evidenceRows, targetRows, departmentRows, rockRows] = await Promise.all([
    getIndexRows(config, run.id),
    getEvidenceRows(config, run.id),
    getTargets(config, account.id),
    getDepartments(config, account.id),
    getRocks(config, account.id)
  ]);

  const targets = Object.fromEntries(targetRows.map(row => [row.metric_id, {
    id: row.id,
    type: row.target_type,
    value: row.target_value === null ? '' : Number(row.target_value),
    notes: row.target_notes || '',
    updatedAt: row.updated_at
  }]));

  const savedDepartments = Object.fromEntries(departmentRows.map(row => [row.department, {
    id: row.id,
    goal: row.goal || '',
    owner: row.owner_name || '',
    status: row.status || 'Needs Definition',
    done: row.done_looks_like || '',
    completion: row.target_completion || 'This month',
    updatedAt: row.updated_at
  }]));

  const departments = DEPARTMENTS.map(name => ({
    name,
    ...(savedDepartments[name] || { goal: '', owner: '', status: 'Needs Definition', done: '', completion: 'This month' })
  }));

  const rocks = rockRows.map(row => ({
    id: row.id,
    scorecardId: row.scorecard_id,
    sourceType: row.source_type,
    sourceKey: row.source_key,
    title: row.title,
    description: row.description || '',
    owner: row.owner_name || 'Agency Owner',
    due: row.due || 'This quarter',
    status: row.status || 'Not started'
  }));

  return {
    account: { id: account.id, name: account.name, email: account.email, agencyName: account.agency_name },
    diagnosticRun: { id: run.id, status: run.status },
    scorecard: { id: scorecard.id, aofiScore: Number(scorecard.aofi_score), generatedAt: scorecard.generated_at },
    metrics: buildMetrics(scorecard, indexRows, evidenceRows),
    targets,
    departments,
    rocks,
    goalsComplete: account.diagnostic_state?.goalsComplete === true,
    goalsCompletedAt: account.diagnostic_state?.goalsCompletedAt || null
  };
}

async function upsertTarget(config, accountId, body) {
  const definition = METRICS.find(item => item.id === clean(body.metricId));
  if (!definition) {
    const error = new Error('Unknown agency goal metric.');
    error.status = 422;
    throw error;
  }
  const targetType = body.targetType === 'percent' ? 'percent' : 'number';
  const targetValue = finite(body.targetValue);
  if (targetValue === null) {
    const error = new Error('Enter a valid target value.');
    error.status = 422;
    throw error;
  }

  const path = 'agency_goals?on_conflict=account_id%2Cmetric_id';
  const rows = await supabaseRequest(config, path, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      account_id: accountId,
      metric_id: definition.id,
      target_type: targetType,
      target_value: targetValue,
      target_notes: clean(body.targetNotes),
      updated_at: new Date().toISOString()
    })
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function upsertDepartment(config, accountId, body) {
  const department = clean(body.department);
  if (!DEPARTMENTS.includes(department)) {
    const error = new Error('Unknown department.');
    error.status = 422;
    throw error;
  }
  const allowedStatuses = ['Needs Definition', 'On Track', 'Watch', 'Off Track'];
  const allowedCompletions = ['This month', 'This quarter', 'Next quarter', 'This year'];
  const status = allowedStatuses.includes(body.status) ? body.status : 'Needs Definition';
  const completion = allowedCompletions.includes(body.completion) ? body.completion : 'This month';

  const rows = await supabaseRequest(config, 'department_goals?on_conflict=account_id%2Cdepartment', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      account_id: accountId,
      department,
      goal: clean(body.goal),
      owner_name: clean(body.owner),
      status,
      done_looks_like: clean(body.done),
      target_completion: completion,
      updated_at: new Date().toISOString()
    })
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function normalizeSourceKey(value, title, index) {
  const explicit = clean(value);
  if (explicit) return explicit.slice(0, 220);
  const slug = lower(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);
  return `scorecard:${slug || 'rock'}:${index}`;
}

async function createRocks(config, accountId, scorecardId, items) {
  const input = Array.isArray(items) ? items.slice(0, 20) : [];
  const normalized = input
    .map((item, index) => ({
      sourceType: ['issue', 'opportunity', 'priority', 'manual'].includes(item?.sourceType) ? item.sourceType : 'scorecard',
      sourceKey: normalizeSourceKey(item?.sourceKey, item?.title, index),
      title: clean(item?.title),
      description: clean(item?.description),
      owner: clean(item?.owner) || 'Agency Owner',
      due: ['This month', 'This quarter', 'Next quarter'].includes(item?.due) ? item.due : 'This quarter',
      status: ['Not started', 'On track', 'Watch', 'Complete'].includes(item?.status) ? item.status : 'Not started'
    }))
    .filter(item => item.title);

  if (!normalized.length) return { added: 0, rows: [] };

  const sourceKeys = [...new Set(normalized.map(item => item.sourceKey))];
  const existing = await getRocks(config, accountId);
  const existingKeys = new Set((existing || []).map(row => row.source_key));

  const records = normalized.map(item => ({
    account_id: accountId,
    scorecard_id: scorecardId || null,
    source_type: item.sourceType,
    source_key: item.sourceKey,
    title: item.title,
    description: item.description,
    owner_name: item.owner,
    due: item.due,
    status: item.status,
    updated_at: new Date().toISOString()
  }));

  const rows = await supabaseRequest(config, 'rocks?on_conflict=account_id%2Csource_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(records)
  });

  return { added: sourceKeys.filter(key => !existingKeys.has(key)).length, rows: Array.isArray(rows) ? rows : [] };
}

async function updateRock(config, accountId, body) {
  const id = clean(body.id);
  if (!id) {
    const error = new Error('Rock ID is required.');
    error.status = 422;
    throw error;
  }
  const patch = { updated_at: new Date().toISOString() };
  if (body.owner !== undefined) patch.owner_name = clean(body.owner);
  if (body.due !== undefined && ['This month', 'This quarter', 'Next quarter'].includes(body.due)) patch.due = body.due;
  if (body.status !== undefined && ['Not started', 'On track', 'Watch', 'Complete'].includes(body.status)) patch.status = body.status;

  const params = new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: 'id,owner_name,due,status,updated_at' });
  const rows = await supabaseRequest(config, `rocks?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function markGoalsComplete(config, account) {
  const current = account.diagnostic_state && typeof account.diagnostic_state === 'object' ? account.diagnostic_state : {};
  const completedAt = new Date().toISOString();
  const diagnosticState = { ...current, goalsComplete: true, goalsCompletedAt: completedAt, updatedAt: completedAt };
  const params = new URLSearchParams({ id: `eq.${account.id}` });
  await supabaseRequest(config, `accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ diagnostic_state: diagnosticState, updated_at: completedAt })
  });
  return completedAt;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const config = getSupabaseConfig();
  if (!config) return json(res, 503, { error: 'Goals database is not configured.', code: 'BACKEND_NOT_CONFIGURED' });

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const query = req.query || {};
    const identity = req.method === 'GET' ? query : body;
    const account = await findAccount(config, {
      accountId: identity.accountId || identity.account_id,
      email: identity.email,
      agencyUrl: identity.agencyUrl || identity.agency_url
    });
    if (!account) return json(res, 404, { error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });

    if (req.method === 'GET') {
      const model = await loadModel(config, account);
      return json(res, 200, { ok: true, goals: model });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

    const action = clean(body.action);
    if (action === 'set_target') {
      const row = await upsertTarget(config, account.id, body);
      return json(res, 200, { ok: true, target: row });
    }
    if (action === 'save_department') {
      const row = await upsertDepartment(config, account.id, body);
      return json(res, 200, { ok: true, department: row });
    }
    if (action === 'create_rocks') {
      const run = await getCurrentRun(config, account.id);
      const scorecard = run ? await getScorecard(config, run.id) : null;
      if (!scorecard) return json(res, 409, { error: 'Generate the Agency Scorecard before creating Rocks.', code: 'SCORECARD_REQUIRED' });
      const result = await createRocks(config, account.id, scorecard.id, body.rocks);
      return json(res, 200, { ok: true, ...result });
    }
    if (action === 'update_rock') {
      const row = await updateRock(config, account.id, body);
      return json(res, 200, { ok: true, rock: row });
    }
    if (action === 'complete') {
      const completedAt = await markGoalsComplete(config, account);
      return json(res, 200, { ok: true, completedAt });
    }

    return json(res, 422, { error: 'Unknown Goals action.', code: 'INVALID_ACTION' });
  } catch (error) {
    console.error('goals API error', error);
    const status = [400, 404, 409, 422].includes(error.status) ? error.status : 500;
    return json(res, status, {
      error: error.message || 'Agency Goals could not be loaded or saved.',
      code: error.code || 'GOALS_API_ERROR'
    });
  }
}
