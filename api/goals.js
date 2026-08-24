import { buildValuationSnapshot, withValuationReportData } from '../lib/valuation-engine.js';

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
    select: 'id,diagnostic_run_id,aofi_score,confidence,validation_status,report_data,generated_at,updated_at',
    diagnostic_run_id: `eq.${runId}`,
    limit: '1'
  });
  const rows = await supabaseRequest(config, `scorecards?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getIndexRows(config, runId) {
  const params = new URLSearchParams({
    select: 'index_type,score,confidence,validation_status,category_scores,details,updated_at',
    diagnostic_run_id: `eq.${runId}`
  });
  const rows = await supabaseRequest(config, `index_results?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getEvidenceRows(config, runId) {
  const params = new URLSearchParams({
    select: 'evidence_type,extraction_status,extracted_data,validation_status,updated_at',
    diagnostic_run_id: `eq.${runId}`
  });
  const rows = await supabaseRequest(config, `financial_evidence?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getTargets(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,metric_id,target_type,target_value,baseline_actual_value,resolved_target_value,target_notes,updated_at',
    account_id: `eq.${accountId}`,
    order: 'metric_id.asc'
  });
  const rows = await supabaseRequest(config, `agency_goals?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getProgressRows(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,diagnostic_run_id,metric_id,actual_value,source_type,source_updated_at,note,captured_at,created_at',
    account_id: `eq.${accountId}`,
    order: 'captured_at.desc',
    limit: '450'
  });
  const rows = await supabaseRequest(config, `agency_goal_progress?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getDepartments(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,department,goal,owner_name,status,done_looks_like,target_completion,target_completion_date,updated_at',
    account_id: `eq.${accountId}`,
    order: 'department.asc'
  });
  const rows = await supabaseRequest(config, `department_goals?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function getRocks(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,scorecard_id,source_type,source_key,title,description,owner_name,due,due_date,status,created_at,updated_at',
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

function maxTimestamp(values) {
  const valid = values
    .filter(Boolean)
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map(date => date.getTime()))).toISOString();
}

function metric(id, value, source, displayOverride = null, unavailableSource = 'Data not available', sourceUpdatedAt = null) {
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
    source: available ? source : unavailableSource,
    sourceUpdatedAt: sourceUpdatedAt || null
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

  // Owner Time in Sales / Delivery must come from the explicit 30-day
  // time-allocation question in Owner Independence. Do not infer these
  // percentages from category scores, revenue involvement, or financial data.
  const ownerDelivery = firstNumber([independenceDetails], [
    'ownerTime.deliveryPercent',
    'scores.ownerTime.deliveryPercent',
    'answers.24.activities.Delivery',
    'owner_time.delivery_percent',
    'ownerDeliveryPercent',
    'owner_delivery_percent'
  ]);
  const ownerSales = firstNumber([independenceDetails], [
    'ownerTime.salesPercent',
    'scores.ownerTime.salesPercent',
    'answers.24.activities.Sales',
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
  const valuationSnapshot = scorecard?.report_data?.valuation && typeof scorecard.report_data.valuation === 'object'
    ? scorecard.report_data.valuation
    : null;
  const enterpriseValuation = firstNumber([scorecard?.report_data || {}, ...extracted], [
    'enterpriseValuation', 'enterprise_valuation', 'valuation.enterpriseValue', 'valuation.enterprise_value'
  ]);
  const valuationUnavailable = valuationSnapshot?.status === 'insufficient_evidence'
    ? `Missing valuation evidence: ${(valuationSnapshot.missingInputs || []).join(', ')}`
    : 'Valuation has not been calculated yet';

  const leadershipLevel = leadershipScore === null
    ? null
    : Math.max(0, Math.min(5, Math.round(leadershipScore / 20)));
  const leadershipDisplay = leadershipLevel === null ? null : `${leadershipLevel} / 5`;

  const financialUpdatedAt = maxTimestamp([
    performance.updated_at,
    ...evidenceRows.map(row => row?.updated_at)
  ]);
  const valuationUpdatedAt = maxTimestamp(indexRows.map(row => row?.updated_at));

  return [
    metric('ownerDelivery', ownerDelivery, 'Owner Independence evidence', null, 'Data not available', independence.updated_at),
    metric('ownerSales', ownerSales, 'Owner Independence evidence', null, 'Data not available', independence.updated_at),
    metric('revenue', revenue, 'Financial evidence', null, 'Data not available', financialUpdatedAt),
    metric('cogs', cogs, 'Financial evidence', null, 'Data not available', financialUpdatedAt),
    metric('margin', netMargin, 'Financial evidence', null, 'Data not available', financialUpdatedAt),
    metric('sde', adjustedSDE, 'Agency Performance · Adjusted SDE', null, 'Data not available', financialUpdatedAt),
    metric('leadership', leadershipLevel, 'Agency Strength · Leadership System', leadershipDisplay, 'Data not available', strength.updated_at),
    metric('aofi', aofi, 'Generated Agency Scorecard', null, 'Data not available', scorecard?.generated_at),
    metric('valuation', enterpriseValuation, 'Agency Valuation™ · Step 7B snapshot', null, valuationUnavailable, valuationUpdatedAt)
  ];
}

async function persistValuationSnapshot(config, scorecard, snapshot) {
  const reportData = withValuationReportData(scorecard?.report_data || {}, snapshot);
  const params = new URLSearchParams({ id: `eq.${scorecard.id}` });
  await supabaseRequest(config, `scorecards?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ report_data: reportData, updated_at: new Date().toISOString() })
  });
  return { ...scorecard, report_data: reportData };
}


const DEPARTMENT_SUGGESTION_MAP = [
  { department: 'Leadership', capability: /Leadership System|Leadership Independence|Decision Independence|Strategic Independence/i },
  { department: 'Marketing', capability: /Growth Performance/i },
  { department: 'Sales', capability: /Revenue Infrastructure|Revenue Independence/i },
  { department: 'Onboarding', capability: /People Infrastructure/i },
  { department: 'Billing', capability: /Financial Infrastructure|Cash Performance/i },
  { department: 'Service Delivery', capability: /Operating System|Delivery Independence/i },
  { department: 'Client Success', capability: /Revenue Quality/i }
];

function buildDepartmentSuggestions(scorecard) {
  const report = scorecard?.report_data && typeof scorecard.report_data === 'object' ? scorecard.report_data : {};
  const opportunities = Array.isArray(report.opportunities) ? report.opportunities : [];
  const reports = report.reports && typeof report.reports === 'object' ? report.reports : {};
  const suggestions = {};

  for (const mapping of DEPARTMENT_SUGGESTION_MAP) {
    const match = opportunities.find(item => mapping.capability.test(clean(item?.capability)));
    if (!match) continue;
    const indexKey = clean(match.index);
    const confidence = finite(reports?.[indexKey]?.confidence);
    // Step 8B intentionally requires high-confidence diagnostic evidence.
    // Lower-confidence opportunities remain visible on the Scorecard but do not
    // silently become departmental goals.
    if (confidence === null || confidence < 80) continue;
    const recommendation = clean(match.recommendation);
    if (!recommendation) continue;
    suggestions[mapping.department] = {
      goal: recommendation,
      capability: clean(match.capability),
      score: finite(match.score),
      confidence,
      source: clean(match.indexTitle) || clean(reports?.[indexKey]?.title) || 'Agency Scorecard'
    };
  }
  return suggestions;
}


function formatMetricDisplay(metricDefinition, value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
  const number = Number(value);
  if (metricDefinition.unit === '$') return money(number);
  if (metricDefinition.unit === '%') return percentage(number);
  if (metricDefinition.unit === 'level') return `${Number.isInteger(number) ? number : number.toFixed(1)} / 5`;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function normalizeProgressRow(row) {
  return {
    id: row.id,
    diagnosticRunId: row.diagnostic_run_id || null,
    metricId: row.metric_id,
    actualValue: Number(row.actual_value),
    sourceType: row.source_type || 'manual',
    sourceUpdatedAt: row.source_updated_at || null,
    note: row.note || '',
    capturedAt: row.captured_at || row.created_at || null
  };
}

function latestProgressByMetric(rows) {
  const latest = {};
  for (const row of rows) {
    if (!latest[row.metric_id]) latest[row.metric_id] = row;
  }
  return latest;
}

async function syncDiagnosticProgress(config, accountId, runId, metrics, existingRows) {
  const latestDiagnostic = {};
  for (const row of existingRows) {
    if (row.source_type === 'diagnostic' && !latestDiagnostic[row.metric_id]) latestDiagnostic[row.metric_id] = row;
  }

  const inserts = [];
  for (const current of metrics) {
    if (!current.available || finite(current.actualValue) === null) continue;
    const previous = latestDiagnostic[current.id];
    const sourceUpdatedAt = current.sourceUpdatedAt || null;
    const previousValue = previous ? finite(previous.actual_value) : null;
    const previousRevision = previous?.source_updated_at || null;
    const valueChanged = previousValue === null || Math.abs(previousValue - Number(current.actualValue)) > 0.000001;
    const revisionChanged = sourceUpdatedAt && previousRevision !== sourceUpdatedAt;

    if (!previous || valueChanged || revisionChanged) {
      inserts.push({
        account_id: accountId,
        diagnostic_run_id: runId,
        metric_id: current.id,
        actual_value: Number(current.actualValue),
        source_type: 'diagnostic',
        source_updated_at: sourceUpdatedAt,
        note: 'Captured automatically from current diagnostic / financial evidence.',
        captured_at: new Date().toISOString()
      });
    }
  }

  if (!inserts.length) return existingRows;

  // Insert individually so a concurrent page load hitting the diagnostic revision
  // uniqueness guard cannot prevent the remaining metrics from being captured.
  const saved = [];
  for (const record of inserts) {
    try {
      const rows = await supabaseRequest(config, 'agency_goal_progress', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(record)
      });
      if (Array.isArray(rows) && rows[0]) saved.push(rows[0]);
    } catch (error) {
      // PostgreSQL 23505 = another request already captured this source revision.
      if (error?.payload?.code !== '23505') throw error;
    }
  }
  return [...saved, ...existingRows].sort((a, b) => new Date(b.captured_at || 0) - new Date(a.captured_at || 0));
}

function calculateProgress(metricDefinition, currentActual, target) {
  const actual = finite(currentActual);
  const resolvedTarget = finite(target?.resolvedValue);
  const baseline = finite(target?.baselineValue);
  if (actual === null || resolvedTarget === null || baseline === null) return null;

  const distance = resolvedTarget - baseline;
  let rawPercent;
  if (Math.abs(distance) < 0.000001) {
    rawPercent = Math.abs(actual - resolvedTarget) < 0.000001 ? 100 : 0;
  } else {
    rawPercent = ((actual - baseline) / distance) * 100;
  }
  const percent = Math.max(0, Math.min(100, rawPercent));
  const achieved = rawPercent >= 100;
  return {
    baselineValue: baseline,
    targetValue: resolvedTarget,
    currentValue: actual,
    rawPercent: Math.round(rawPercent * 10) / 10,
    percent: Math.round(percent * 10) / 10,
    achieved,
    state: achieved ? 'achieved' : rawPercent <= 0 ? 'not_started' : 'in_progress',
    remainingValue: resolvedTarget - actual,
    baselineDisplay: formatMetricDisplay(metricDefinition, baseline),
    targetDisplay: formatMetricDisplay(metricDefinition, resolvedTarget),
    currentDisplay: formatMetricDisplay(metricDefinition, actual)
  };
}

function validateProgressActual(definition, value) {
  const number = finite(value);
  if (number === null) return 'Enter a valid current actual value.';
  if (number < 0) return 'Current actual value cannot be negative.';
  if (definition.unit === '%' && number > 100) return 'Percentage actuals must be between 0 and 100.';
  if (definition.unit === 'score' && number > 100) return 'Score actuals must be between 0 and 100.';
  if (definition.unit === 'level' && number > 5) return 'Leadership maturity must be between 0 and 5.';
  return '';
}

async function saveProgressUpdate(config, accountId, runId, body) {
  const metricId = clean(body.metricId);
  const definition = METRICS.find(item => item.id === metricId);
  if (!definition) {
    const error = new Error('Unknown Agency Goal metric.');
    error.status = 422;
    throw error;
  }
  const value = finite(body.actualValue);
  const validation = validateProgressActual(definition, value);
  if (validation) {
    const error = new Error(validation);
    error.status = 422;
    throw error;
  }

  const rows = await supabaseRequest(config, 'agency_goal_progress', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account_id: accountId,
      diagnostic_run_id: runId || null,
      metric_id: metricId,
      actual_value: value,
      source_type: 'manual',
      source_updated_at: null,
      note: clean(body.note),
      captured_at: new Date().toISOString()
    })
  });
  const row = Array.isArray(rows) ? rows[0] || null : rows;
  return row ? normalizeProgressRow(row) : null;
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

  const [indexRows, evidenceRows, targetRows, departmentRows, rockRows, initialProgressRows] = await Promise.all([
    getIndexRows(config, run.id),
    getEvidenceRows(config, run.id),
    getTargets(config, account.id),
    getDepartments(config, account.id),
    getRocks(config, account.id),
    getProgressRows(config, account.id)
  ]);

  // Always derive the Goals valuation from the current persisted diagnostic
  // results. This makes the scorecard snapshot the single valuation source of
  // truth and prevents an old placeholder from surviving a retake.
  const valuationSnapshot = buildValuationSnapshot(indexRows, { diagnosticRunId: run.id });
  const scorecardWithValuation = await persistValuationSnapshot(config, scorecard, valuationSnapshot);

  const sourceMetrics = buildMetrics(scorecardWithValuation, indexRows, evidenceRows);
  const progressRows = await syncDiagnosticProgress(config, account.id, run.id, sourceMetrics, initialProgressRows);
  const latestProgress = latestProgressByMetric(progressRows);
  const progressHistory = {};
  for (const definition of METRICS) {
    progressHistory[definition.id] = progressRows
      .filter(row => row.metric_id === definition.id)
      .slice(0, 20)
      .map(normalizeProgressRow);
  }

  const metrics = sourceMetrics.map(sourceMetric => {
    const latest = latestProgress[sourceMetric.id] || null;
    if (!latest) return {
      ...sourceMetric,
      sourceActualValue: sourceMetric.actualValue,
      sourceActualDisplay: sourceMetric.actualDisplay,
      evidenceAvailable: sourceMetric.available,
      currentSourceType: sourceMetric.available ? 'diagnostic' : null,
      actualUpdatedAt: sourceMetric.sourceUpdatedAt || null
    };
    const actualValue = Number(latest.actual_value);
    return {
      ...sourceMetric,
      sourceActualValue: sourceMetric.actualValue,
      sourceActualDisplay: sourceMetric.actualDisplay,
      evidenceAvailable: sourceMetric.available,
      available: true,
      actualValue,
      actualDisplay: formatMetricDisplay(sourceMetric, actualValue),
      currentSourceType: latest.source_type,
      actualUpdatedAt: latest.captured_at || latest.created_at || null,
      source: latest.source_type === 'manual'
        ? (clean(latest.note) ? `Manual progress update · ${clean(latest.note)}` : 'Manual progress update')
        : sourceMetric.source
    };
  });
  const metricMap = Object.fromEntries(metrics.map(item => [item.id, item]));
  const targets = Object.fromEntries(targetRows.map(row => {
    const storedValue = row.target_value === null ? null : Number(row.target_value);
    const metricValue = metricMap[row.metric_id]?.available ? finite(metricMap[row.metric_id]?.actualValue) : null;
    let baselineValue = row.baseline_actual_value === null ? null : Number(row.baseline_actual_value);
    let resolvedValue = row.resolved_target_value === null ? null : Number(row.resolved_target_value);

    // Step 5 rows predate frozen percentage baselines. Preserve exact targets and
    // provide a safe display fallback for legacy percentage targets until saved again.
    if (resolvedValue === null && storedValue !== null) {
      if (row.target_type === 'number') resolvedValue = storedValue;
      else if (metricValue !== null) resolvedValue = metricValue * (1 + storedValue / 100);
    }
    if (baselineValue === null && row.target_type === 'percent' && metricValue !== null) baselineValue = metricValue;

    return [row.metric_id, {
      id: row.id,
      type: row.target_type,
      value: storedValue === null ? '' : storedValue,
      baselineValue,
      resolvedValue,
      direction: storedValue !== null && storedValue < 0 ? 'decrease' : 'increase',
      notes: row.target_notes || '',
      updatedAt: row.updated_at
    }];
  }));

  const goalProgress = Object.fromEntries(METRICS.map(definition => {
    const current = metricMap[definition.id];
    return [definition.id, calculateProgress(definition, current?.actualValue, targets[definition.id])];
  }));

  const savedDepartments = Object.fromEntries(departmentRows.map(row => [row.department, {
    id: row.id,
    goal: row.goal || '',
    owner: row.owner_name || '',
    status: row.status || 'Needs Definition',
    done: row.done_looks_like || '',
    completion: row.target_completion || '',
    completionDate: row.target_completion_date || '',
    updatedAt: row.updated_at
  }]));

  const departmentSuggestions = buildDepartmentSuggestions(scorecardWithValuation);
  const departments = DEPARTMENTS.map(name => ({
    name,
    ...(savedDepartments[name] || { goal: '', owner: '', status: 'Needs Definition', done: '', completion: '', completionDate: '' }),
    suggestion: departmentSuggestions[name] || null
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
    dueDate: row.due_date || '',
    status: row.status || 'Not started'
  }));

  const targetCount = METRICS.filter(item => targets[item.id] && finite(targets[item.id].resolvedValue) !== null).length;
  const evidenceGaps = metrics.filter(item => item.evidenceAvailable === false).map(item => ({
    metricId: item.id,
    label: item.label,
    reason: item.source || 'Required source evidence has not been supplied.'
  }));
  const definedDepartmentCount = departments.filter(item => clean(item.goal)).length;
  const partialDepartments = departments
    .filter(item => clean(item.goal) && (!clean(item.owner) || !clean(item.done) || !clean(item.completionDate)))
    .map(item => item.name);
  const incompleteRocks = rocks
    .filter(item => !clean(item.owner) || !clean(item.dueDate))
    .map(item => item.title);

  return {
    account: { id: account.id, name: account.name, email: account.email, agencyName: account.agency_name },
    diagnosticRun: { id: run.id, status: run.status },
    scorecard: { id: scorecard.id, aofiScore: Number(scorecard.aofi_score), generatedAt: scorecard.generated_at },
    metrics,
    targets,
    progress: goalProgress,
    progressHistory,
    departments,
    rocks,
    readiness: {
      targetCount,
      targetTotal: METRICS.length,
      definedDepartmentCount,
      departmentTotal: DEPARTMENTS.length,
      rockCount: rocks.length,
      evidenceGaps,
      partialDepartments,
      incompleteRocks,
      canComplete: targetCount === METRICS.length && partialDepartments.length === 0 && incompleteRocks.length === 0
    },
    goalsComplete: account.diagnostic_state?.goalsComplete === true,
    goalsCompletedAt: account.diagnostic_state?.goalsCompletedAt || null
  };
}

function validateExactTarget(definition, value) {
  if (value === null) return 'Enter a valid target value.';
  if (value < 0) return 'Target value cannot be negative.';
  if (definition.unit === '%' && value > 100) return 'Percentage targets must be between 0 and 100.';
  if (definition.unit === 'score' && value > 100) return 'Score targets must be between 0 and 100.';
  if (definition.unit === 'level' && value > 5) return 'Leadership maturity target must be between 0 and 5.';
  return '';
}

function resolveTarget(definition, actualValue, targetType, rawValue, direction) {
  const entered = finite(rawValue);
  if (targetType === 'number') {
    const validation = validateExactTarget(definition, entered);
    if (validation) {
      const error = new Error(validation);
      error.status = 422;
      throw error;
    }
    return { storedValue: entered, baselineValue: actualValue, resolvedValue: entered };
  }

  if (entered === null || entered < 0 || entered > 1000) {
    const error = new Error('Enter a percentage change between 0 and 1000.');
    error.status = 422;
    throw error;
  }
  if (actualValue === null) {
    const error = new Error('A percentage target requires a current actual value. Use a specific number until source data is available.');
    error.status = 422;
    throw error;
  }

  const sign = direction === 'decrease' ? -1 : 1;
  const signedPercent = Math.abs(entered) * sign;
  const resolved = actualValue * (1 + signedPercent / 100);
  if (resolved < 0) {
    const error = new Error('This percentage decrease would create a negative target.');
    error.status = 422;
    throw error;
  }

  const validation = validateExactTarget(definition, resolved);
  if (validation) {
    const error = new Error(validation);
    error.status = 422;
    throw error;
  }

  return {
    storedValue: signedPercent,
    baselineValue: actualValue,
    resolvedValue: resolved
  };
}

async function upsertTarget(config, accountId, body, currentMetric) {
  const definition = METRICS.find(item => item.id === clean(body.metricId));
  if (!definition) {
    const error = new Error('Unknown agency goal metric.');
    error.status = 422;
    throw error;
  }

  const targetType = body.targetType === 'percent' ? 'percent' : 'number';
  const actualValue = currentMetric?.available ? finite(currentMetric.actualValue) : null;
  const target = resolveTarget(definition, actualValue, targetType, body.targetValue, clean(body.targetDirection));

  const path = 'agency_goals?on_conflict=account_id%2Cmetric_id';
  const rows = await supabaseRequest(config, path, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      account_id: accountId,
      metric_id: definition.id,
      target_type: targetType,
      target_value: target.storedValue,
      baseline_actual_value: target.baselineValue,
      resolved_target_value: target.resolvedValue,
      target_notes: clean(body.targetNotes),
      updated_at: new Date().toISOString()
    })
  });

  const row = Array.isArray(rows) ? rows[0] || null : rows;
  return row ? {
    ...row,
    baseline_actual_value: row.baseline_actual_value === null ? null : Number(row.baseline_actual_value),
    resolved_target_value: row.resolved_target_value === null ? null : Number(row.resolved_target_value)
  } : row;
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
  const completion = allowedCompletions.includes(body.completion) ? body.completion : null;
  const completionDate = /^\d{4}-\d{2}-\d{2}$/.test(clean(body.completionDate)) ? clean(body.completionDate) : null;

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
      target_completion_date: completionDate,
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
  const defaultDueDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const input = Array.isArray(items) ? items.slice(0, 20) : [];
  const normalized = input
    .map((item, index) => ({
      sourceType: ['issue', 'opportunity', 'priority', 'manual'].includes(item?.sourceType) ? item.sourceType : 'scorecard',
      sourceKey: normalizeSourceKey(item?.sourceKey, item?.title, index),
      title: clean(item?.title),
      description: clean(item?.description),
      owner: clean(item?.owner) || 'Agency Owner',
      due: ['This month', 'This quarter', 'Next quarter'].includes(item?.due) ? item.due : 'This quarter',
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(clean(item?.dueDate)) ? clean(item.dueDate) : defaultDueDate,
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
    due_date: item.dueDate,
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
  if (body.dueDate !== undefined) patch.due_date = /^\d{4}-\d{2}-\d{2}$/.test(clean(body.dueDate)) ? clean(body.dueDate) : null;
  if (body.title !== undefined) patch.title = clean(body.title);
  if (body.description !== undefined) patch.description = clean(body.description);
  if (body.status !== undefined && ['Not started', 'On track', 'Watch', 'Complete'].includes(body.status)) patch.status = body.status;

  const params = new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: 'id,title,description,owner_name,due,due_date,status,updated_at' });
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
      const model = await loadModel(config, account);
      const currentMetric = model.metrics.find(item => item.id === clean(body.metricId)) || null;
      const row = await upsertTarget(config, account.id, body, currentMetric);
      return json(res, 200, { ok: true, target: row });
    }
    if (action === 'save_progress') {
      const run = await getCurrentRun(config, account.id);
      const row = await saveProgressUpdate(config, account.id, run?.id || null, body);
      return json(res, 200, { ok: true, progress: row });
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
      const model = await loadModel(config, account);
      const readiness = model.readiness || {};
      const blockers = [];
      if (Number(readiness.targetCount || 0) < Number(readiness.targetTotal || METRICS.length)) {
        blockers.push(`Set targets for all ${readiness.targetTotal || METRICS.length} Agency Goal cards.`);
      }
      if (Array.isArray(readiness.partialDepartments) && readiness.partialDepartments.length) {
        blockers.push(`Finish owner, measurable outcome, and completion date for: ${readiness.partialDepartments.join(', ')}.`);
      }
      if (Array.isArray(readiness.incompleteRocks) && readiness.incompleteRocks.length) {
        blockers.push(`Add an owner and due date for: ${readiness.incompleteRocks.join(', ')}.`);
      }
      if (blockers.length) {
        const error = new Error(blockers.join(' '));
        error.status = 409;
        error.code = 'GOALS_INCOMPLETE';
        throw error;
      }
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
