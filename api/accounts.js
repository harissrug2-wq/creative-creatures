import { requireAdmin } from '../lib/session-utils.js';
const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const finite = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
const SELECT = 'id,name,email,agency_url,agency_url_normalized,agency_name,journey,source,archetype_result,report_data,diagnostic_state,created_at,updated_at';

const EMPTY_DIAGNOSTIC_STATE = {
  indexes: {},
  count: 0,
  allComplete: false,
  reportReady: false,
  generatedAt: null
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

function deriveAgencyName(agencyUrl) {
  const normalized = normalizeAgencyUrl(agencyUrl);
  const host = normalized.split('/')[0].split(':')[0];
  const first = host.split('.')[0] || 'Agency';
  return first.split(/[-_]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getSupabaseConfig() {
  const url = clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const serviceRole = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRole) return null;
  return { url, serviceRole };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      // Supabase's current sb_secret_* keys are API keys, not JWTs.
      // Send them through `apikey` only. The API gateway maps the
      // secret key to the service role for PostgREST.
      apikey: config.serviceRole,
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

function publicAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    agency_url: row.agency_url,
    agency_url_normalized: row.agency_url_normalized,
    agency_name: row.agency_name,
    journey: row.journey,
    source: row.source,
    archetype_result: row.archetype_result || {},
    report_data: row.report_data || {},
    diagnostic_state: row.diagnostic_state || {},
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function findRows(config, field, value, limit = 2) {
  if (!value) return [];
  const params = new URLSearchParams({ select: SELECT, [field]: `eq.${value}`, limit: String(limit) });
  const rows = await supabaseRequest(config, `accounts?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function findByIdentifiers(config, email, normalizedUrl) {
  const [emailRows, urlRows] = await Promise.all([
    email ? findRows(config, 'email_normalized', email) : Promise.resolve([]),
    normalizedUrl ? findRows(config, 'agency_url_normalized', normalizedUrl) : Promise.resolve([])
  ]);
  const map = new Map();
  [...emailRows, ...urlRows].forEach(row => map.set(row.id, row));
  return [...map.values()];
}

async function updateById(config, id, patch) {
  const params = new URLSearchParams({ id: `eq.${id}`, select: SELECT });
  const rows = await supabaseRequest(config, `accounts?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  return Array.isArray(rows) ? rows[0] : rows;
}


function average(values) {
  const usable = values.map(finite).filter(value => value !== null);
  if (!usable.length) return null;
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 10) / 10;
}

function sum(values) {
  const usable = values.map(finite).filter(value => value !== null);
  if (!usable.length) return null;
  return Math.round(usable.reduce((total, value) => total + value, 0) * 100) / 100;
}

function latestByType(rows = []) {
  const map = new Map();
  rows.forEach(row => {
    const current = map.get(row.evidence_type);
    const currentAt = new Date(current?.updated_at || current?.created_at || 0).getTime();
    const rowAt = new Date(row?.updated_at || row?.created_at || 0).getTime();
    if (!current || rowAt >= currentAt) map.set(row.evidence_type, row);
  });
  return map;
}

function scorecardMomentum(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return { state: 'baseline', delta: 0, label: 'Baseline' };
  }
  const previous = history[history.length - 2];
  const current = history[history.length - 1];
  const delta = Math.round((Number(current.aofi) - Number(previous.aofi)) * 10) / 10;
  if (delta > 0.4) return { state: 'up', delta, label: `Up ${Math.abs(delta).toFixed(1)} pts` };
  if (delta < -0.4) return { state: 'down', delta, label: `Down ${Math.abs(delta).toFixed(1)} pts` };
  return { state: 'flat', delta, label: 'Flat' };
}

function supportedMrr(serviceEvidence) {
  const data = serviceEvidence?.extracted_data && typeof serviceEvidence.extracted_data === 'object'
    ? serviceEvidence.extracted_data
    : {};
  const recurring = finite(data.recurringRevenue);
  if (recurring === null) return null;
  const period = String(data.periodLabel || '').toLowerCase();
  const annualPeriod = /\b(ttm|trailing\s*12|12\s*months?|annual|year(?:ly)?)\b/.test(period);
  return annualPeriod ? Math.round((recurring / 12) * 100) / 100 : null;
}

async function buildAdminPortfolio(config, accountRows) {
  const [runsRaw, cardsRaw, evidenceRaw] = await Promise.all([
    supabaseRequest(config, 'diagnostic_runs?select=id,account_id,status,is_current,started_at,generated_at,completed_at&order=started_at.asc'),
    supabaseRequest(config, 'scorecards?select=id,diagnostic_run_id,performance_score,strength_score,independence_score,aofi_score,confidence,validation_status,report_data,generated_at,updated_at&order=generated_at.asc'),
    supabaseRequest(config, 'financial_evidence?select=diagnostic_run_id,evidence_type,extraction_status,extracted_data,validation_status,created_at,updated_at&order=updated_at.asc')
  ]);

  const accountIds = new Set(accountRows.map(row => String(row.id)));
  const runs = (Array.isArray(runsRaw) ? runsRaw : []).filter(run => accountIds.has(String(run.account_id)));
  const runById = new Map(runs.map(run => [String(run.id), run]));
  const runsByAccount = new Map();

  runs.forEach(run => {
    const key = String(run.account_id);
    if (!runsByAccount.has(key)) runsByAccount.set(key, []);
    runsByAccount.get(key).push(run);
  });

  const cardsByAccount = new Map();
  (Array.isArray(cardsRaw) ? cardsRaw : []).forEach(card => {
    const run = runById.get(String(card.diagnostic_run_id));
    if (!run) return;
    const key = String(run.account_id);
    if (!cardsByAccount.has(key)) cardsByAccount.set(key, []);
    cardsByAccount.get(key).push(card);
  });

  const evidenceByRun = new Map();
  (Array.isArray(evidenceRaw) ? evidenceRaw : []).forEach(row => {
    if (!runById.has(String(row.diagnostic_run_id))) return;
    const key = String(row.diagnostic_run_id);
    if (!evidenceByRun.has(key)) evidenceByRun.set(key, []);
    evidenceByRun.get(key).push(row);
  });

  const enriched = accountRows.map(account => {
    const key = String(account.id);
    const accountRuns = (runsByAccount.get(key) || []).slice().sort((a, b) =>
      new Date(a.started_at || 0) - new Date(b.started_at || 0)
    );
    const currentRun = accountRuns.find(run => run.is_current === true) || accountRuns[accountRuns.length - 1] || null;
    const cards = (cardsByAccount.get(key) || []).slice().sort((a, b) =>
      new Date(a.generated_at || a.updated_at || 0) - new Date(b.generated_at || b.updated_at || 0)
    );

    const history = cards.map(card => {
      const report = card.report_data && typeof card.report_data === 'object' ? card.report_data : {};
      const valuation = report.valuation && typeof report.valuation === 'object' ? report.valuation : {};
      return {
        generatedAt: card.generated_at || card.updated_at || null,
        aofi: finite(card.aofi_score),
        confidence: finite(card.confidence),
        performance: finite(card.performance_score),
        strength: finite(card.strength_score),
        independence: finite(card.independence_score),
        enterpriseValue: valuation.available === true ? finite(valuation.enterpriseValue) : finite(report.enterpriseValuation)
      };
    }).filter(row => row.aofi !== null);

    const latestCard = cards[cards.length - 1] || null;
    const latestHistory = history[history.length - 1] || {};
    const latestReport = latestCard?.report_data && typeof latestCard.report_data === 'object'
      ? latestCard.report_data
      : {};

    const evidence = currentRun ? latestByType(evidenceByRun.get(String(currentRun.id)) || []) : new Map();
    const pnl = evidence.get('profit_loss')?.extracted_data || {};
    const balance = evidence.get('balance_sheet')?.extracted_data || {};
    const service = evidence.get('service_revenue_mix');
    const coverage = [
      evidence.has('profit_loss') ? 'profit_loss' : null,
      evidence.has('balance_sheet') ? 'balance_sheet' : null,
      evidence.has('service_revenue_mix') ? 'service_revenue_mix' : null
    ].filter(Boolean);

    return {
      ...account,
      portfolio: {
        archetype: latestReport.archetype || account?.archetype_result?.title || account?.report_data?.archetypeTitle || '',
        scorecard: {
          aofi: latestHistory.aofi ?? null,
          confidence: latestHistory.confidence ?? null,
          performance: latestHistory.performance ?? null,
          strength: latestHistory.strength ?? null,
          independence: latestHistory.independence ?? null,
          enterpriseValue: latestHistory.enterpriseValue ?? null,
          validation: latestCard?.validation_status || null,
          generatedAt: latestHistory.generatedAt || null,
          momentum: scorecardMomentum(history),
          history
        },
        financials: {
          revenueTtm: finite(pnl.revenueTTM),
          netProfitTtm: finite(pnl.netIncomeTTM),
          cash: finite(balance.cash),
          recurringRevenue: finite(service?.extracted_data?.recurringRevenue),
          mrr: supportedMrr(service),
          coverage
        }
      }
    };
  });

  const scorecards = enriched.map(account => account.portfolio.scorecard).filter(card => card.aofi !== null);
  const financials = enriched.map(account => account.portfolio.financials);
  const valuations = scorecards.map(card => card.enterpriseValue).filter(value => finite(value) !== null);
  const mrr = financials.map(row => row.mrr).filter(value => finite(value) !== null);
  const netProfit = financials.map(row => row.netProfitTtm).filter(value => finite(value) !== null);
  const cash = financials.map(row => row.cash).filter(value => finite(value) !== null);

  return {
    accounts: enriched,
    platform: {
      activeAgencies: enriched.length,
      scorecardsReady: scorecards.length,
      scorecardCoverage: enriched.length ? Math.round((scorecards.length / enriched.length) * 100) : 0,
      averageAofi: average(scorecards.map(card => card.aofi)),
      averageConfidence: average(scorecards.map(card => card.confidence)),
      averagePerformance: average(scorecards.map(card => card.performance)),
      averageStrength: average(scorecards.map(card => card.strength)),
      averageIndependence: average(scorecards.map(card => card.independence)),
      totalValuation: sum(valuations),
      valuationCoverage: valuations.length,
      totalMrr: sum(mrr),
      mrrCoverage: mrr.length,
      totalNetProfitTtm: sum(netProfit),
      netProfitCoverage: netProfit.length,
      totalCash: sum(cash),
      cashCoverage: cash.length,
      pendingTelemetry: [
        { key: 'team_utilization', label: 'Team Utilization', note: 'Will populate from project/time-tracking integrations used by Monitor.' },
        { key: 'lead_to_close', label: 'Lead-to-Close Rate', note: 'Will populate from CRM pipeline telemetry used by Monitor.' },
        { key: 'client_sentiment', label: 'Client Sentiment / NPS', note: 'Will populate when a verified client-sentiment source is connected.' }
      ]
    }
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const config = getSupabaseConfig();
  if (!config) return json(res, 503, { error: 'Account database is not configured.', code: 'BACKEND_NOT_CONFIGURED' });

  try {
    if (req.method === 'GET') {
      if (req.query?.all === 'true' || req.query?.all === '1' || req.query?.list === '1') {
        if (!requireAdmin(req)) return json(res, 401, { error: 'Admin authentication required.' });
        const rows = await supabaseRequest(config, `accounts?select=${SELECT}&order=created_at.desc`);
        const accounts = (Array.isArray(rows) ? rows : []).map(publicAccount);
        if (req.query?.portfolio === '1' || req.query?.portfolio === 'true') {
          const portfolio = await buildAdminPortfolio(config, accounts);
          return json(res, 200, portfolio);
        }
        return json(res, 200, { accounts });
      }

      const email = lower(req.query?.email);
      const normalizedUrl = normalizeAgencyUrl(req.query?.agencyUrl || req.query?.agency_url);
      if (!email && !normalizedUrl) return json(res, 422, { error: 'Enter an email address or agency URL.' });

      const rows = await findByIdentifiers(config, email, normalizedUrl);
      if (!rows.length) return json(res, 404, { error: 'No matching account was found.' });
      if (rows.length > 1) return json(res, 409, { error: 'The email and agency URL belong to different accounts. Use one identifier.' });

      const account = rows[0];
      await updateById(config, account.id, { last_lookup_at: new Date().toISOString() });
      return json(res, 200, { account: publicAccount(account) });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'DELETE') {
      if (!requireAdmin(req)) return json(res, 401, { error: 'Admin authentication required.' });
      const id = clean(req.query?.id || body.id);
      if (!id) return json(res, 422, { error: 'Account ID is required.' });
      await supabaseRequest(config, `accounts?id=eq.${id}`, { method: 'DELETE' });
      return json(res, 200, { success: true, deletedId: id });
    }

    if (req.method === 'POST') {
      if (String(body.source || '').toLowerCase() === 'admin-console' && !requireAdmin(req)) return json(res, 401, { error: 'Admin authentication required.' });
      const name = clean(body.name || `${body.firstName || ''} ${body.lastName || ''}`);
      const email = lower(body.email);
      const agencyUrl = clean(body.agencyUrl || body.agency_url);
      const normalizedUrl = normalizeAgencyUrl(agencyUrl);
      const journey = ['platform', 'diagnostic', 'accelerator'].includes(body.journey) ? body.journey : 'diagnostic';

      if (!name || !email || !normalizedUrl) return json(res, 422, { error: 'Name, email, and agency URL are required.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return json(res, 422, { error: 'Enter a valid email address.' });

      const record = {
        name,
        name_normalized: lower(name),
        email,
        email_normalized: email,
        agency_url: agencyUrl,
        agency_url_normalized: normalizedUrl,
        agency_name: clean(body.agencyName || body.agency_name) || deriveAgencyName(agencyUrl),
        journey,
        source: clean(body.source) || 'owner-archetype',
        archetype_answers: body.archetypeAnswers || body.archetype_answers || {},
        archetype_result: body.archetypeResult || body.archetype_result || {},
        report_data: body.reportData || body.report_data || {},
        updated_at: new Date().toISOString()
      };

      const existing = await findByIdentifiers(config, email, normalizedUrl);
      if (existing.length > 1) return json(res, 409, { error: 'The email and agency URL are already assigned to different accounts.' });

      let account;
      if (existing.length === 1) {
        // Retaking/updating Owner Identity must not overwrite an existing
        // account's diagnostic history. Diagnostic progress is managed only
        // by /api/diagnostic-state.
        account = await updateById(config, existing[0].id, record);
      } else {
        // A truly new account always begins with a clean diagnostic state,
        // regardless of any stale browser payload sent by the client.
        record.diagnostic_state = EMPTY_DIAGNOSTIC_STATE;
        const rows = await supabaseRequest(config, 'accounts', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(record)
        });
        account = Array.isArray(rows) ? rows[0] : rows;
      }
      return json(res, 200, { account: publicAccount(account) });
    }

    if (req.method === 'PATCH') {
      const id = clean(body.id);
      const email = lower(body.email);
      const normalizedUrl = normalizeAgencyUrl(body.agencyUrl || body.agency_url);
      let accountId = id;
      if (!accountId) {
        const rows = await findByIdentifiers(config, email, normalizedUrl);
        if (rows.length !== 1) return json(res, rows.length ? 409 : 404, { error: rows.length ? 'Account lookup is ambiguous.' : 'Account not found.' });
        accountId = rows[0].id;
      }

      const patch = {};
      if (body.diagnosticState || body.diagnostic_state) patch.diagnostic_state = body.diagnosticState || body.diagnostic_state;
      if (body.reportData || body.report_data) patch.report_data = body.reportData || body.report_data;
      if (body.archetypeResult || body.archetype_result) patch.archetype_result = body.archetypeResult || body.archetype_result;
      if (body.journey && ['platform', 'diagnostic', 'accelerator'].includes(body.journey)) patch.journey = body.journey;
      if (!Object.keys(patch).length) return json(res, 422, { error: 'No supported fields were supplied.' });

      const account = await updateById(config, accountId, patch);
      return json(res, 200, { account: publicAccount(account) });
    }

    return json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error('accounts API error', error);
    return json(res, error.status === 400 ? 400 : 500, { error: 'The account could not be saved or loaded.', code: 'ACCOUNT_API_ERROR' });
  }
}
