const BUCKET = 'diagnostic-evidence';
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MODEL = 'gpt-4.1-mini';

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body || '{}'); }
    catch {
      const error = new Error('The financial evidence request body is invalid JSON.');
      error.status = 400;
      error.code = 'INVALID_JSON_BODY';
      throw error;
    }
  }
  return {};
}

const EVIDENCE_TYPES = new Set([
  'profit_loss',
  'balance_sheet',
  'ar_aging',
  'client_revenue',
  'service_revenue_mix',
  'sde'
]);

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

function storageHeaders(config, extra = {}) {
  const headers = {
    apikey: config.secret,
    ...extra
  };
  // Legacy JWT service_role keys also work as bearer tokens. New sb_secret_
  // keys are API keys and should not be treated as JWTs.
  if (!config.secret.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${config.secret}`;
  }
  return headers;
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

async function storageRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}/storage/v1/${path}`, {
    ...options,
    headers: storageHeaders(config, options.headers || {})
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || 'Storage request failed.');
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
    select: 'id,account_id,status,is_current',
    account_id: `eq.${accountId}`,
    is_current: 'eq.true',
    limit: '1'
  });
  const rows = await supabaseRequest(config, `diagnostic_runs?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findEvidence(config, runId, evidenceType) {
  const params = new URLSearchParams({
    select: 'id,diagnostic_run_id,evidence_type,file_name,file_size_bytes,storage_path,mime_type,extraction_status,extraction_model,extraction_error,extracted_at,extracted_data,validation_status,created_at,updated_at',
    diagnostic_run_id: `eq.${runId}`,
    evidence_type: `eq.${evidenceType}`,
    order: 'updated_at.desc',
    limit: '1'
  });
  const rows = await supabaseRequest(config, `financial_evidence?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function listEvidence(config, runId) {
  const params = new URLSearchParams({
    select: 'id,diagnostic_run_id,evidence_type,file_name,file_size_bytes,storage_path,mime_type,extraction_status,extraction_model,extraction_error,extracted_at,extracted_data,validation_status,created_at,updated_at',
    diagnostic_run_id: `eq.${runId}`,
    order: 'updated_at.asc'
  });
  const rows = await supabaseRequest(config, `financial_evidence?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function saveEvidence(config, runId, evidenceType, patch) {
  const existing = await findEvidence(config, runId, evidenceType);
  const now = new Date().toISOString();
  if (existing) {
    const params = new URLSearchParams({ id: `eq.${existing.id}` });
    const rows = await supabaseRequest(config, `financial_evidence?${params.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...patch, updated_at: now })
    });
    return Array.isArray(rows) ? rows[0] || existing : existing;
  }

  const rows = await supabaseRequest(config, 'financial_evidence', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      diagnostic_run_id: runId,
      evidence_type: evidenceType,
      validation_status: 'unverified',
      ...patch,
      created_at: now,
      updated_at: now
    })
  });
  let created = Array.isArray(rows) ? rows[0] || null : null;
  // Do not allow the upload UI to continue unless the database row can be
  // read back. This prevents a local-only "uploaded" state from masking a
  // failed financial_evidence insert.
  if (!created) created = await findEvidence(config, runId, evidenceType);
  if (!created?.id) {
    const error = new Error('The financial evidence database record could not be created.');
    error.status = 500;
    error.code = 'EVIDENCE_ROW_NOT_CREATED';
    throw error;
  }
  return created;
}

function safeFilename(value) {
  const base = clean(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'financial-evidence.pdf').slice(-140);
}

function encodeStoragePath(path) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

async function createSignedUploadUrl(config, storagePath) {
  const encoded = encodeStoragePath(`${BUCKET}/${storagePath}`);
  const payload = await storageRequest(config, `object/upload/sign/${encoded}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!payload?.url) throw new Error('Supabase did not return a signed upload URL.');
  return /^https?:\/\//i.test(payload.url)
    ? payload.url
    : `${config.url}/storage/v1${payload.url.startsWith('/') ? '' : '/'}${payload.url}`;
}

async function createSignedDownloadUrl(config, storagePath, expiresIn = 600) {
  const encoded = encodeStoragePath(`${BUCKET}/${storagePath}`);
  const payload = await storageRequest(config, `object/sign/${encoded}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn })
  });
  const relative = payload?.signedURL || payload?.signedUrl;
  if (!relative) throw new Error('Supabase did not return a signed download URL.');
  return /^https?:\/\//i.test(relative)
    ? relative
    : `${config.url}/storage/v1${relative.startsWith('/') ? '' : '/'}${relative}`;
}

function nullableNumber() { return { type: ['number', 'null'] }; }
function nullableString() { return { type: ['string', 'null'] }; }

const commonProperties = {
  currency: nullableString(),
  confidence: { type: 'number', minimum: 0, maximum: 100 },
  warnings: { type: 'array', items: { type: 'string' } }
};

const schemas = {
  profit_loss: {
    type: 'object', additionalProperties: false,
    properties: {
      ...commonProperties,
      periodLabel: nullableString(),
      revenueTTM: nullableNumber(),
      revenueYTD: nullableNumber(),
      cogsTTM: nullableNumber(),
      grossProfitTTM: nullableNumber(),
      operatingExpensesTTM: nullableNumber(),
      netIncomeTTM: nullableNumber(),
      netIncomeYTD: nullableNumber(),
      explicitEBITDA: nullableNumber(),
      priorRevenueTTM: nullableNumber(),
      priorCogsTTM: nullableNumber(),
      priorGrossProfitTTM: nullableNumber(),
      priorNetIncomeTTM: nullableNumber(),
      currentTtmStart: nullableString(),
      currentTtmEnd: nullableString(),
      priorTtmStart: nullableString(),
      priorTtmEnd: nullableString(),
      monthlyPeriods: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            period: { type: 'string' },
            isPartial: { type: 'boolean' },
            revenue: nullableNumber(),
            cogs: nullableNumber(),
            grossProfit: nullableNumber(),
            netIncome: nullableNumber()
          },
          required: ['period','isPartial','revenue','cogs','grossProfit','netIncome']
        }
      },
      partialPeriodsIgnored: { type: 'array', items: { type: 'string' } },
      marginStabilityLevel: { type: ['number','null'], minimum: 0, maximum: 4 },
      growthConsistencyLevel: { type: ['number','null'], minimum: 0, maximum: 4 },
      revenuePredictabilityLevel: { type: ['number','null'], minimum: 0, maximum: 4 }
    },
    required: ['currency','confidence','warnings','periodLabel','revenueTTM','revenueYTD','cogsTTM','grossProfitTTM','operatingExpensesTTM','netIncomeTTM','netIncomeYTD','explicitEBITDA','priorRevenueTTM','priorCogsTTM','priorGrossProfitTTM','priorNetIncomeTTM','currentTtmStart','currentTtmEnd','priorTtmStart','priorTtmEnd','monthlyPeriods','partialPeriodsIgnored','marginStabilityLevel','growthConsistencyLevel','revenuePredictabilityLevel']
  },
  balance_sheet: {
    type: 'object', additionalProperties: false,
    properties: {
      ...commonProperties,
      asOfDate: nullableString(),
      cash: nullableNumber(),
      accountsReceivable: nullableNumber(),
      currentAssets: nullableNumber(),
      currentLiabilities: nullableNumber(),
      totalAssets: nullableNumber(),
      totalLiabilities: nullableNumber(),
      totalDebt: nullableNumber()
    },
    required: ['currency','confidence','warnings','asOfDate','cash','accountsReceivable','currentAssets','currentLiabilities','totalAssets','totalLiabilities','totalDebt']
  },
  ar_aging: {
    type: 'object', additionalProperties: false,
    properties: {
      ...commonProperties,
      asOfDate: nullableString(),
      totalAR: nullableNumber(),
      currentAR: nullableNumber(),
      days1to30: nullableNumber(),
      days31to60: nullableNumber(),
      days61to90: nullableNumber(),
      days90Plus: nullableNumber()
    },
    required: ['currency','confidence','warnings','asOfDate','totalAR','currentAR','days1to30','days31to60','days61to90','days90Plus']
  },
  client_revenue: {
    type: 'object', additionalProperties: false,
    properties: {
      ...commonProperties,
      periodLabel: nullableString(),
      totalRevenue: nullableNumber(),
      clients: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { name: { type: 'string' }, revenue: { type: 'number' } },
          required: ['name','revenue']
        }
      }
    },
    required: ['currency','confidence','warnings','periodLabel','totalRevenue','clients']
  },
  service_revenue_mix: {
    type: 'object', additionalProperties: false,
    properties: {
      ...commonProperties,
      periodLabel: nullableString(),
      totalRevenue: nullableNumber(),
      recurringRevenue: nullableNumber(),
      projectRevenue: nullableNumber(),
      services: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            name: { type: 'string' },
            revenue: nullableNumber(),
            percent: nullableNumber()
          },
          required: ['name','revenue','percent']
        }
      }
    },
    required: ['currency','confidence','warnings','periodLabel','totalRevenue','recurringRevenue','projectRevenue','services']
  }
};

const instructions = {
  profit_loss: 'Extract the agency Profit & Loss financial values and the complete monthly series when shown. Identify the latest 24 COMPLETE calendar months, excluding any partial month/date-range period. Current TTM is the most recent 12 complete months; Prior TTM is the immediately preceding 12 complete months. Never sum 24 months into a TTM total. If the report provides explicit TTM totals, also extract them, but preserve the monthly rows so the server can verify the arithmetic. Do not estimate missing values.',
  balance_sheet: 'Extract balance-sheet values from the most relevant/latest period shown. Do not estimate missing values.',
  ar_aging: 'Extract Accounts Receivable aging totals and aging buckets from the latest report period. Do not estimate missing values.',
  client_revenue: 'Extract each client and its revenue for the stated report period. Use only client revenue explicitly supported by the document.',
  service_revenue_mix: 'Extract revenue by service. Only classify recurring versus project revenue when the document explicitly supports that classification.'
};

const roundMoney2 = value => Math.round(Number(value) * 100) / 100;

const MONTHS = {jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};

function parseMonthlyPeriod(value) {
  const raw = clean(value);
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  // Reject obvious subtotal/aggregate columns even if the model mistakenly put
  // them into monthlyPeriods.
  if (/\b(total|ttm|ytd|year\s*to\s*date|trailing|rolling|average|avg)\b/i.test(raw)) return null;

  let match = lowered.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[\-\/, ]+\s*(20\d{2}|19\d{2})\b/i);
  if (match) {
    const month = MONTHS[match[1].toLowerCase()];
    const year = Number(match[2]);
    if (month !== undefined) return { timestamp: Date.UTC(year, month, 1), key: `${year}-${String(month+1).padStart(2,'0')}` };
  }
  match = lowered.match(/\b(20\d{2}|19\d{2})[\-\/](0?[1-9]|1[0-2])(?:[\-\/]\d{1,2})?\b/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2])-1;
    return { timestamp: Date.UTC(year, month, 1), key: `${year}-${String(month+1).padStart(2,'0')}` };
  }
  match = lowered.match(/\b(0?[1-9]|1[0-2])[\-\/](20\d{2}|19\d{2})\b/);
  if (match) {
    const month = Number(match[1])-1;
    const year = Number(match[2]);
    return { timestamp: Date.UTC(year, month, 1), key: `${year}-${String(month+1).padStart(2,'0')}` };
  }
  return null;
}

function normalizeMonthlyPeriods(rows) {
  const parsed = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.isPartial === true || !clean(row.period)) continue;
    const parsedPeriod = parseMonthlyPeriod(row.period);
    if (!parsedPeriod) continue;
    parsed.push({
      ...row,
      _timestamp: parsedPeriod.timestamp,
      _periodKey: parsedPeriod.key,
      _sourceIndex: index,
      revenue: finite(row.revenue),
      cogs: finite(row.cogs),
      grossProfit: finite(row.grossProfit),
      netIncome: finite(row.netIncome)
    });
  }
  // Keep the most complete row when the same month appears more than once.
  const scoreRow = row => ['revenue','cogs','grossProfit','netIncome'].reduce((score,key)=>score+(finite(row[key])!==null?1:0),0);
  const byMonth = new Map();
  for (const row of parsed) {
    const existing = byMonth.get(row._periodKey);
    if (!existing || scoreRow(row) > scoreRow(existing) || (scoreRow(row) === scoreRow(existing) && row._sourceIndex > existing._sourceIndex)) byMonth.set(row._periodKey, row);
  }
  return [...byMonth.values()].sort((a,b)=>a._timestamp-b._timestamp);
}

function deriveMetrics(evidenceType, data) {
  const out = { ...data };
  const pct = (part, whole) => whole && Number.isFinite(part) && Number.isFinite(whole)
    ? Math.round((part / whole) * 10000) / 100
    : null;

  if (evidenceType === 'profit_loss') {
    const rawPeriods = Array.isArray(out.monthlyPeriods) ? out.monthlyPeriods : [];
    // Never trust model ordering. Financial PDFs often list the newest month
    // first. Parse each month, deduplicate, and sort chronologically here.
    const completePeriods = normalizeMonthlyPeriods(rawPeriods);

    const sum = (rows, key) => rows.length && rows.every(row => finite(row[key]) !== null)
      ? roundMoney2(rows.reduce((total, row) => total + Number(row[key]), 0))
      : null;
    const last24 = completePeriods.length >= 24 ? completePeriods.slice(-24) : [];
    const prior12 = last24.length === 24 ? last24.slice(0, 12) : [];
    const current12 = last24.length === 24 ? last24.slice(12) : (completePeriods.length >= 12 ? completePeriods.slice(-12) : []);

    const calculatedCurrent = {
      revenue: sum(current12, 'revenue'),
      cogs: sum(current12, 'cogs'),
      grossProfit: sum(current12, 'grossProfit'),
      netIncome: sum(current12, 'netIncome')
    };
    if (calculatedCurrent.grossProfit === null && calculatedCurrent.revenue !== null && calculatedCurrent.cogs !== null) {
      calculatedCurrent.grossProfit = roundMoney2(calculatedCurrent.revenue - calculatedCurrent.cogs);
    }
    const calculatedPrior = {
      revenue: sum(prior12, 'revenue'),
      cogs: sum(prior12, 'cogs'),
      grossProfit: sum(prior12, 'grossProfit'),
      netIncome: sum(prior12, 'netIncome')
    };
    if (calculatedPrior.grossProfit === null && calculatedPrior.revenue !== null && calculatedPrior.cogs !== null) {
      calculatedPrior.grossProfit = roundMoney2(calculatedPrior.revenue - calculatedPrior.cogs);
    }

    // Prefer deterministic sums from 12 complete monthly rows. Fall back to
    // explicit totals only when the source does not expose a complete series.
    out.revenueTTM = calculatedCurrent.revenue ?? finite(out.revenueTTM);
    out.cogsTTM = calculatedCurrent.cogs ?? finite(out.cogsTTM);
    out.grossProfitTTM = calculatedCurrent.grossProfit ?? finite(out.grossProfitTTM);
    out.netIncomeTTM = calculatedCurrent.netIncome ?? finite(out.netIncomeTTM);
    out.priorRevenueTTM = calculatedPrior.revenue ?? finite(out.priorRevenueTTM);
    out.priorCogsTTM = calculatedPrior.cogs ?? finite(out.priorCogsTTM);
    out.priorGrossProfitTTM = calculatedPrior.grossProfit ?? finite(out.priorGrossProfitTTM);
    out.priorNetIncomeTTM = calculatedPrior.netIncome ?? finite(out.priorNetIncomeTTM);

    if (current12.length === 12) {
      out.currentTtmStart = clean(current12[0].period) || out.currentTtmStart || null;
      out.currentTtmEnd = clean(current12[11].period) || out.currentTtmEnd || null;
    }
    if (prior12.length === 12) {
      out.priorTtmStart = clean(prior12[0].period) || out.priorTtmStart || null;
      out.priorTtmEnd = clean(prior12[11].period) || out.priorTtmEnd || null;
    }

    const revenue = finite(out.revenueTTM);
    const cogs = finite(out.cogsTTM);
    let gross = finite(out.grossProfitTTM);
    if (gross === null && revenue !== null && cogs !== null) gross = roundMoney2(revenue - cogs);
    out.grossProfitTTM = gross;
    out.cogsPercent = revenue !== null && cogs !== null ? pct(cogs, revenue) : null;
    out.grossMarginPercent = revenue !== null && gross !== null ? pct(gross, revenue) : null;
    out.netMargin = revenue !== null && finite(out.netIncomeTTM) !== null ? pct(Number(out.netIncomeTTM), revenue) : null;

    const priorRevenue = finite(out.priorRevenueTTM);
    const priorGross = finite(out.priorGrossProfitTTM);
    const priorNet = finite(out.priorNetIncomeTTM);
    const currentNet = finite(out.netIncomeTTM);
    const deltaRevenue = revenue !== null && priorRevenue !== null ? revenue - priorRevenue : null;
    out.revenueGrowthPercent = priorRevenue && revenue !== null ? pct(revenue - priorRevenue, priorRevenue) : finite(out.revenueGrowthPercent);
    out.grossProfitGrowthPercent = priorGross && gross !== null ? pct(gross - priorGross, priorGross) : finite(out.grossProfitGrowthPercent);
    out.netIncomeGrowthPercent = priorNet && currentNet !== null ? pct(currentNet - priorNet, priorNet) : finite(out.netIncomeGrowthPercent);
    out.profitConversionPercent = deltaRevenue && currentNet !== null && priorNet !== null
      ? pct(currentNet - priorNet, deltaRevenue)
      : finite(out.profitConversionPercent);
    out.marginStabilityLevel = clampLevel(out.marginStabilityLevel);
    out.growthConsistencyLevel = clampLevel(out.growthConsistencyLevel);
    out.revenuePredictabilityLevel = clampLevel(out.revenuePredictabilityLevel);
    out.monthlyPeriods = completePeriods.map(({_timestamp,_periodKey,_sourceIndex,...row}) => row);
    out.ttmCalculationSource = current12.length === 12 ? '12_complete_months_sorted_by_date' : 'explicit_report_totals';
  }

  if (evidenceType === 'balance_sheet') {
    const assets = finite(out.currentAssets);
    const liabilities = finite(out.currentLiabilities);
    out.currentRatio = assets !== null && liabilities !== null && liabilities !== 0
      ? Math.round((assets / liabilities) * 100) / 100
      : null;
  }

  if (evidenceType === 'ar_aging') {
    const total = finite(out.totalAR);
    const overdue = ['days1to30','days31to60','days61to90','days90Plus']
      .map(key => finite(out[key]))
      .filter(value => value !== null)
      .reduce((sum, value) => sum + value, 0);
    out.overduePercent = total !== null && total !== 0 ? pct(overdue, total) : null;
  }

  if (evidenceType === 'client_revenue') {
    const clients = Array.isArray(out.clients) ? out.clients.filter(item => Number.isFinite(Number(item?.revenue))) : [];
    clients.sort((a, b) => Number(b.revenue) - Number(a.revenue));
    const calculatedTotal = clients.reduce((sum, item) => sum + Number(item.revenue), 0);
    const total = finite(out.totalRevenue) ?? (clients.length ? calculatedTotal : null);
    const top = clients[0] ? Number(clients[0].revenue) : null;
    const topFive = clients.slice(0, 5).reduce((sum, item) => sum + Number(item.revenue), 0);
    out.clients = clients;
    out.totalRevenue = total;
    out.clientCount = clients.length || finite(out.clientCount);
    out.topClientRevenue = top ?? finite(out.topClientRevenue);
    out.topClientPercent = total && top !== null ? pct(top, total) : finite(out.topClientPercent);
    out.top5Percent = total && clients.length ? pct(topFive, total) : finite(out.top5Percent);
    out.averageClientRevenue = total !== null && clients.length ? Math.round((total / clients.length) * 100) / 100 : finite(out.averageClientRevenue);
  }

  if (evidenceType === 'service_revenue_mix') {
    const services = Array.isArray(out.services) ? out.services : [];
    const revenueValues = services.map(item => finite(item.revenue)).filter(value => value !== null);
    const calculatedTotal = revenueValues.reduce((sum, value) => sum + value, 0);
    const total = finite(out.totalRevenue) ?? (revenueValues.length ? calculatedTotal : null);
    out.totalRevenue = total;
    out.services = services.map(item => {
      const revenue = finite(item.revenue);
      const percent = finite(item.percent) ?? (total && revenue !== null ? pct(revenue, total) : null);
      return { ...item, revenue, percent };
    }).sort((a, b) => (finite(b.revenue) ?? 0) - (finite(a.revenue) ?? 0));
    out.topServicePercent = out.services[0]?.percent ?? null;
    const recurring = finite(out.recurringRevenue);
    const project = finite(out.projectRevenue);
    out.recurringRevenuePercent = total && recurring !== null ? pct(recurring, total) : finite(out.recurringRevenuePercent);
    out.projectRevenuePercent = total && project !== null ? pct(project, total) : finite(out.projectRevenuePercent);
  }

  return out;
}

function getOutputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

async function extractWithOpenAI({ evidenceType, fileUrl, filename }) {
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured. The PDF is stored safely, but automated extraction cannot run yet.');
    error.status = 503;
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }
  const schema = schemas[evidenceType];
  if (!schema) throw new Error(`No extraction schema exists for ${evidenceType}.`);

  const model = clean(process.env.OPENAI_FINANCIAL_MODEL) || DEFAULT_MODEL;
  const prompt = [
    instructions[evidenceType],
    'This is financial evidence for a marketing agency diagnostic.',
    'Rules:',
    '- Extract only values supported by the document.',
    '- Never invent, forecast, or infer a missing financial value.',
    '- Preserve negative numbers.',
    '- Monetary values must be plain numeric values without currency symbols or commas.',
    '- Percentages must be numeric percentage points, e.g. 24.5 rather than 0.245.',
    '- Use null when a requested value is not present or cannot be calculated exactly from visible values.',
    '- Confidence is extraction confidence (0-100), not a business-performance score.',
    '- Put ambiguity, missing periods, or suspicious report structure in warnings.',
    evidenceType === 'profit_loss' ? '- For P&L reports, read month headers carefully. A partial period such as Aug 1-4 is NOT a complete month and must be marked isPartial=true and excluded from both TTM windows.' : '',
    evidenceType === 'profit_loss' ? '- Return every visible COMPLETE monthly column in monthlyPeriods. Exclude subtotal columns such as Total, TTM, YTD, Average, or Year-to-Date from monthlyPeriods.' : '',
    evidenceType === 'profit_loss' ? '- The server will sort months itself, but each period label MUST include both month and year (example: Jul 2026). Do not omit the year.' : '',
    evidenceType === 'profit_loss' ? '- Net Income means the report bottom-line net income / net operating income for that month, NOT gross profit and NOT revenue minus COGS. Use null if that bottom-line value cannot be read. Never use 0 as a missing-value placeholder.' : '',
    evidenceType === 'profit_loss' ? '- Classify marginStabilityLevel, growthConsistencyLevel, and revenuePredictabilityLevel on the 0-4 Agency Performance rubric using the visible 24-month evidence. Use null only if there is insufficient evidence.' : '',
    evidenceType === 'profit_loss' ? '- Margin Stability: 0 declining/highly volatile; 1 flat or volatile; 2 stable with occasional fluctuations; 3 consistently stable; 4 stable and improving over 24 months.' : '',
    evidenceType === 'profit_loss' ? '- Growth Consistency: 0 revenue declining; 1 highly inconsistent; 2 stable with fluctuations; 3 consistently growing; 4 consistently growing with accelerating profit.' : '',
    evidenceType === 'profit_loss' ? '- Revenue Predictability: 0 extremely volatile; 1 high variability; 2 moderate consistency; 3 predictable; 4 highly predictable recurring growth.' : ''
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', file_url: fileUrl },
          { type: 'input_text', text: prompt }
        ]
      }],
      text: {
        format: {
          type: 'json_schema',
          name: `creative_creatures_${evidenceType}`,
          strict: true,
          schema
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'OpenAI financial extraction failed.');
    error.status = response.status;
    error.code = payload?.error?.code || 'OPENAI_EXTRACTION_FAILED';
    throw error;
  }

  const outputText = getOutputText(payload);
  if (!outputText) throw new Error('OpenAI returned no structured financial extraction.');
  let extracted;
  try { extracted = JSON.parse(outputText); }
  catch { throw new Error('OpenAI returned an unreadable financial extraction.'); }

  return {
    model,
    responseId: payload.id || null,
    extracted: deriveMetrics(evidenceType, extracted)
  };
}

async function requireContext(config, identity) {
  const account = await findAccount(config, identity);
  if (!account) {
    const error = new Error('No matching Creative Creatures account was found.');
    error.status = 404;
    throw error;
  }
  const run = await getCurrentRun(config, account.id);
  if (!run) {
    const error = new Error('Start the Agency Diagnostic before uploading financial evidence.');
    error.status = 409;
    error.code = 'DIAGNOSTIC_RUN_REQUIRED';
    throw error;
  }
  return { account, run };
}

async function prepareUpload(config, body) {
  const evidenceType = clean(body.evidenceType);
  if (!EVIDENCE_TYPES.has(evidenceType) || evidenceType === 'sde') {
    const error = new Error('Unsupported financial evidence type.');
    error.status = 422;
    throw error;
  }
  const filename = safeFilename(body.filename);
  const size = finite(body.size);
  const mimeType = clean(body.mimeType) || 'application/pdf';
  if (!filename.toLowerCase().endsWith('.pdf') && mimeType !== 'application/pdf') {
    const error = new Error('Only PDF financial reports can be uploaded.');
    error.status = 415;
    throw error;
  }
  if (size === null || size <= 0 || size > MAX_FILE_BYTES) {
    const error = new Error('PDF must be 4 MB or smaller.');
    error.status = 413;
    throw error;
  }

  const { account, run } = await requireContext(config, body);
  const existing = await findEvidence(config, run.id, evidenceType);
  const storagePath = `${account.id}/${run.id}/${evidenceType}/${Date.now()}-${filename}`;
  const evidence = await saveEvidence(config, run.id, evidenceType, {
    file_name: filename,
    file_size_bytes: size,
    storage_path: storagePath,
    mime_type: 'application/pdf',
    extraction_status: 'uploaded',
    extraction_model: existing?.extraction_model === 'manual_entry' ? 'manual_entry' : null,
    extraction_error: null,
    extracted_at: existing?.extracted_at || null,
    extracted_data: existing?.extracted_data && typeof existing.extracted_data === 'object' ? existing.extracted_data : {},
    validation_status: existing?.validation_status || 'unverified'
  });
  if (!evidence?.id) {
    const error = new Error('The financial evidence record was not created before upload.');
    error.status = 500;
    error.code = 'EVIDENCE_ROW_NOT_CREATED';
    throw error;
  }
  const signedUploadUrl = await createSignedUploadUrl(config, storagePath);
  return { account, run, evidence, signedUploadUrl, phase: 'database_saved' };
}

async function extractEvidence(config, body) {
  const { account, run } = await requireContext(config, body);
  let evidence = null;
  if (body.evidenceId) {
    const params = new URLSearchParams({
      select: 'id,diagnostic_run_id,evidence_type,file_name,file_size_bytes,storage_path,mime_type,extraction_status,extraction_model,extraction_error,extracted_at,extracted_data,validation_status,created_at,updated_at',
      id: `eq.${body.evidenceId}`,
      diagnostic_run_id: `eq.${run.id}`,
      limit: '1'
    });
    const rows = await supabaseRequest(config, `financial_evidence?${params.toString()}`);
    evidence = Array.isArray(rows) ? rows[0] || null : null;
  } else if (body.evidenceType) {
    evidence = await findEvidence(config, run.id, clean(body.evidenceType));
  }
  if (!evidence || evidence.evidence_type === 'sde' || !evidence.storage_path) {
    const error = new Error('Uploaded financial evidence was not found.');
    error.status = 404;
    throw error;
  }

  await saveEvidence(config, run.id, evidence.evidence_type, {
    extraction_status: 'processing',
    extraction_error: null
  });

  try {
    const signedUrl = await createSignedDownloadUrl(config, evidence.storage_path, 600);
    const result = await extractWithOpenAI({
      evidenceType: evidence.evidence_type,
      fileUrl: signedUrl,
      filename: evidence.file_name || 'financial-evidence.pdf'
    });
    const extractedAt = new Date().toISOString();
    const extractedData = {
      ...result.extracted,
      extraction: {
        source: 'openai_pdf',
        model: result.model,
        responseId: result.responseId,
        extractedAt,
        evidenceType: evidence.evidence_type,
        fileName: evidence.file_name
      }
    };
    const updated = await saveEvidence(config, run.id, evidence.evidence_type, {
      extraction_status: 'processed',
      extraction_model: result.model,
      extraction_error: null,
      extracted_at: extractedAt,
      extracted_data: extractedData,
      validation_status: 'unverified'
    });
    return { account, run, evidence: updated };
  } catch (error) {
    await saveEvidence(config, run.id, evidence.evidence_type, {
      extraction_status: error.code === 'OPENAI_NOT_CONFIGURED' ? 'uploaded' : 'failed',
      extraction_error: clean(error.message).slice(0, 1200)
    }).catch(() => {});
    throw error;
  }
}

async function saveSde(config, body) {
  const { account, run } = await requireContext(config, body);
  const benefits = Array.isArray(body.benefits)
    ? [...new Set(body.benefits.map(clean).filter(Boolean))].slice(0, 30)
    : [];
  const existing = await findEvidence(config, run.id, 'sde');
  const current = existing?.extracted_data && typeof existing.extracted_data === 'object'
    ? existing.extracted_data
    : {};
  const manual = sanitizeManualData('sde', body.values || body.manualData || {});
  const ownershipPercent = finite(body.ownershipPercent);
  const capturedAt = new Date().toISOString();
  const extracted = deriveMetrics('sde', {
    ...current,
    ...manual,
    benefits,
    ownershipPercent: ownershipPercent === null ? (finite(current.ownershipPercent) ?? null) : Math.max(0, Math.min(100, ownershipPercent)),
    source: 'owner_input',
    capturedAt,
    extraction: {
      ...(current.extraction && typeof current.extraction === 'object' ? current.extraction : {}),
      source: 'manual_entry',
      capturedAt,
      evidenceType: 'sde'
    }
  });

  const evidence = await saveEvidence(config, run.id, 'sde', {
    file_name: null,
    file_size_bytes: null,
    storage_path: null,
    mime_type: 'application/json',
    extraction_status: 'processed',
    extraction_model: 'manual_entry',
    extraction_error: null,
    extracted_at: capturedAt,
    extracted_data: extracted,
    validation_status: 'unverified'
  });
  return { account, run, evidence };
}

const MANUAL_FIELDS = {
  profit_loss: {
    strings: ['currency', 'periodLabel'],
    numbers: ['revenueTTM','revenueYTD','cogsTTM','grossProfitTTM','operatingExpensesTTM','netIncomeTTM','netIncomeYTD','explicitEBITDA','revenueGrowthPercent','netIncomeGrowthPercent','grossProfitGrowthPercent','profitConversionPercent'],
    levels: ['marginStabilityLevel','growthConsistencyLevel','revenuePredictabilityLevel']
  },
  balance_sheet: {
    strings: ['currency', 'asOfDate'],
    numbers: ['cash','accountsReceivable','currentAssets','currentLiabilities','totalAssets','totalLiabilities','totalDebt','monthlyOperatingExpenses','ebitdaTTM'],
    levels: ['operatingCashFlowLevel']
  },
  ar_aging: {
    strings: ['currency', 'asOfDate'],
    numbers: ['totalAR','currentAR','days1to30','days31to60','days61to90','days90Plus','collectionRatePercent'],
    levels: []
  },
  client_revenue: {
    strings: ['currency', 'periodLabel'],
    numbers: ['totalRevenue','topClientRevenue','topClientPercent','top5Percent','clientCount','averageClientRevenue','averageClientTenureMonths'],
    levels: ['revenueDiversificationLevel','contractDurationLevel']
  },
  service_revenue_mix: {
    strings: ['currency', 'periodLabel'],
    numbers: ['totalRevenue','recurringRevenue','projectRevenue','recurringRevenuePercent','projectRevenuePercent','topServicePercent'],
    levels: []
  },
  sde: {
    strings: [],
    numbers: ['adjustedSDE','capitalInvested','incrementalOperatingProfit','reinvestmentRatePercent'],
    levels: ['technologyInvestmentLevel','talentInvestmentLevel','retainedEarningsGrowthLevel']
  }
};

function clampLevel(value) {
  const number = finite(value);
  if (number === null) return null;
  return Math.max(0, Math.min(4, Math.round(number)));
}

function sanitizeManualData(evidenceType, raw) {
  const definition = MANUAL_FIELDS[evidenceType];
  if (!definition) return {};
  const input = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of definition.strings) {
    if (input[key] !== undefined) out[key] = clean(input[key]).slice(0, 240) || null;
  }
  for (const key of definition.numbers) {
    if (input[key] !== undefined) out[key] = finite(input[key]);
  }
  for (const key of definition.levels) {
    if (input[key] !== undefined) out[key] = clampLevel(input[key]);
  }
  return out;
}

async function saveManualEvidence(config, body) {
  const evidenceType = clean(body.evidenceType);
  if (!EVIDENCE_TYPES.has(evidenceType)) {
    const error = new Error('Unsupported financial evidence type.');
    error.status = 422;
    throw error;
  }
  if (evidenceType === 'sde') return saveSde(config, body);

  const { account, run } = await requireContext(config, body);
  const existing = await findEvidence(config, run.id, evidenceType);
  const current = existing?.extracted_data && typeof existing.extracted_data === 'object'
    ? existing.extracted_data
    : {};
  const manual = sanitizeManualData(evidenceType, body.values || body.manualData || {});
  const capturedAt = new Date().toISOString();
  const merged = deriveMetrics(evidenceType, {
    ...current,
    ...manual,
    extraction: {
      ...(current.extraction && typeof current.extraction === 'object' ? current.extraction : {}),
      source: 'manual_entry',
      capturedAt,
      evidenceType,
      fileName: existing?.file_name || null
    }
  });

  const evidence = await saveEvidence(config, run.id, evidenceType, {
    extraction_status: 'processed',
    extraction_model: 'manual_entry',
    extraction_error: null,
    extracted_at: capturedAt,
    extracted_data: merged,
    validation_status: existing?.validation_status === 'verified' ? 'verified' : 'unverified'
  });
  return { account, run, evidence };
}

const CATEGORY_WEIGHTS = {
  profitability: 25,
  growth: 20,
  revenueQuality: 20,
  cash: 20,
  capital: 15
};

const METRIC_WEIGHTS = {
  profitability: {
    grossMargin: 20,
    netMargin: 25,
    sdeMargin: 20,
    marginStability: 15,
    grossProfitGrowth: 10,
    profitConversion: 10
  },
  growth: {
    revenueGrowth: 30,
    netIncomeGrowth: 30,
    growthConsistency: 20,
    revenuePredictability: 20
  },
  revenueQuality: {
    recurringRevenue: 25,
    clientConcentration: 25,
    revenueDiversification: 20,
    averageClientTenure: 15,
    contractDuration: 15
  },
  cash: {
    cashReserve: 25,
    operatingCashFlow: 25,
    currentRatio: 20,
    accountsReceivable: 15,
    debtPosition: 15
  },
  capital: {
    returnOnCapital: 30,
    reinvestmentRate: 20,
    technologyInvestment: 15,
    talentInvestment: 15,
    retainedEarningsGrowth: 20
  }
};

const round2 = value => Math.round(Number(value) * 100) / 100;
const pctOf = (part, whole) => {
  const p = finite(part);
  const w = finite(whole);
  if (p === null || w === null || w === 0) return null;
  return round2((p / w) * 100);
};

function scoreBands(value, cutoffs) {
  const number = finite(value);
  if (number === null) return null;
  for (let i = cutoffs.length - 1; i >= 0; i -= 1) {
    if (number >= cutoffs[i]) return i + 1;
  }
  return 0;
}

function scoreGrowth(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number < 0) return 0;
  if (number < 5) return 1;
  if (number < 10) return 2;
  if (number < 20) return 3;
  return 4;
}

function scoreGrossMargin(value) { return scoreBands(value, [30,40,50,60]); }
function scoreNetMargin(value) { return scoreBands(value, [5,10,15,20]); }
function scoreSdeMargin(value) { return scoreBands(value, [10,15,20,25]); }
function scoreProfitConversion(value) { return scoreBands(value, [5,10,20,30]); }
function scoreRecurring(value) { return scoreBands(value, [20,40,60,80]); }
function scoreClientConcentration(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number >= 30) return 0;
  if (number >= 20) return 1;
  if (number >= 15) return 2;
  if (number >= 10) return 3;
  return 4;
}
function scoreClientTenure(months) {
  const number = finite(months);
  if (number === null) return null;
  if (number < 12) return 0;
  if (number < 24) return 1;
  if (number < 36) return 2;
  if (number < 60) return 3;
  return 4;
}
function scoreCashReserve(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number < 1) return 0;
  if (number < 2) return 1;
  if (number < 3) return 2;
  if (number <= 6) return 3;
  return 4;
}
function scoreCurrentRatio(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number < 1) return 0;
  if (number < 1.25) return 1;
  if (number < 1.5) return 2;
  if (number <= 2) return 3;
  return 4;
}
function scoreCollectionRate(value) { return scoreBands(value, [50,70,85,95]); }
function scoreDebtRatio(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number >= 4) return 0;
  if (number >= 3) return 1;
  if (number >= 2) return 2;
  if (number >= 1) return 3;
  return 4;
}
function scoreReturnOnCapital(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number < 0) return 0;
  if (number < 10) return 1;
  if (number < 20) return 2;
  if (number < 30) return 3;
  return 4;
}
function scoreReinvestmentRate(value) { return scoreBands(value, [10,25,40,60]); }

function metricRecord(key, label, rawValue, score, weight) {
  return {
    key,
    label,
    value: finite(rawValue),
    score: score === null ? null : Math.max(0, Math.min(4, Number(score))),
    weight
  };
}

function categoryModel(key, label, metricRows) {
  const totalWeight = Object.values(METRIC_WEIGHTS[key]).reduce((sum, value) => sum + value, 0);
  const available = metricRows.filter(row => row.score !== null);
  const availableWeight = available.reduce((sum, row) => sum + row.weight, 0);
  if (!availableWeight) {
    return { key, label, score: null, coverage: 0, metrics: metricRows };
  }
  const score = Math.round(available.reduce((sum, row) => sum + ((row.score / 4) * 100 * row.weight), 0) / availableWeight);
  return {
    key,
    label,
    score,
    coverage: Math.round((availableWeight / totalWeight) * 100),
    metrics: metricRows
  };
}

function evidenceMap(rows) {
  return Object.fromEntries(rows.map(row => [row.evidence_type, row]));
}

function evidenceData(map, type) {
  const data = map[type]?.extracted_data;
  return data && typeof data === 'object' ? data : {};
}

function buildPerformanceModel(rows) {
  const map = evidenceMap(rows);
  const pnl = evidenceData(map, 'profit_loss');
  const balance = evidenceData(map, 'balance_sheet');
  const ar = evidenceData(map, 'ar_aging');
  const client = evidenceData(map, 'client_revenue');
  const service = evidenceData(map, 'service_revenue_mix');
  const sde = evidenceData(map, 'sde');

  const revenue = finite(pnl.revenueTTM);
  const cogs = finite(pnl.cogsTTM);
  const grossProfit = finite(pnl.grossProfitTTM) ?? (revenue !== null && cogs !== null ? revenue - cogs : null);
  const netIncome = finite(pnl.netIncomeTTM);
  const grossMargin = finite(pnl.grossMarginPercent) ?? pctOf(grossProfit, revenue);
  const netMargin = finite(pnl.netMargin) ?? pctOf(netIncome, revenue);
  const adjustedSDE = finite(sde.adjustedSDE);
  const sdeMargin = pctOf(adjustedSDE, revenue);
  const cashReserveMonths = finite(balance.monthlyOperatingExpenses) && finite(balance.cash) !== null
    ? round2(Number(balance.cash) / Number(balance.monthlyOperatingExpenses))
    : null;
  const currentRatio = finite(balance.currentRatio) ?? (
    finite(balance.currentAssets) !== null && finite(balance.currentLiabilities) !== null && Number(balance.currentLiabilities) !== 0
      ? round2(Number(balance.currentAssets) / Number(balance.currentLiabilities))
      : null
  );
  const ebitda = finite(balance.ebitdaTTM) ?? finite(pnl.explicitEBITDA);
  const debtToEbitda = finite(balance.totalDebt) !== null && ebitda !== null && ebitda > 0
    ? round2(Number(balance.totalDebt) / ebitda)
    : null;
  const capitalInvested = finite(sde.capitalInvested);
  const incrementalOperatingProfit = finite(sde.incrementalOperatingProfit);
  const roicLite = capitalInvested !== null && capitalInvested !== 0 && incrementalOperatingProfit !== null
    ? round2((incrementalOperatingProfit / capitalInvested) * 100)
    : null;

  const profitability = categoryModel('profitability', 'Profitability', [
    metricRecord('grossMargin','Gross Margin',grossMargin,scoreGrossMargin(grossMargin),20),
    metricRecord('netMargin','Net Margin',netMargin,scoreNetMargin(netMargin),25),
    metricRecord('sdeMargin','EBITDA / SDE Margin',sdeMargin,scoreSdeMargin(sdeMargin),20),
    metricRecord('marginStability','Margin Stability',pnl.marginStabilityLevel,clampLevel(pnl.marginStabilityLevel),15),
    metricRecord('grossProfitGrowth','Gross Profit Growth',pnl.grossProfitGrowthPercent,scoreGrowth(pnl.grossProfitGrowthPercent),10),
    metricRecord('profitConversion','Profit Conversion',pnl.profitConversionPercent,scoreProfitConversion(pnl.profitConversionPercent),10)
  ]);

  const growth = categoryModel('growth', 'Growth Performance', [
    metricRecord('revenueGrowth','Revenue Growth',pnl.revenueGrowthPercent,scoreGrowth(pnl.revenueGrowthPercent),30),
    metricRecord('netIncomeGrowth','Net Income Growth',pnl.netIncomeGrowthPercent,scoreGrowth(pnl.netIncomeGrowthPercent),30),
    metricRecord('growthConsistency','Growth Consistency',pnl.growthConsistencyLevel,clampLevel(pnl.growthConsistencyLevel),20),
    metricRecord('revenuePredictability','Revenue Predictability',pnl.revenuePredictabilityLevel,clampLevel(pnl.revenuePredictabilityLevel),20)
  ]);

  const topClientPercent = finite(client.topClientPercent) ?? finite(client.largestClientPercent);
  const recurringRevenuePercent = finite(service.recurringRevenuePercent);
  const revenueQuality = categoryModel('revenueQuality', 'Revenue Quality', [
    metricRecord('recurringRevenue','Recurring Revenue',recurringRevenuePercent,scoreRecurring(recurringRevenuePercent),25),
    metricRecord('clientConcentration','Largest Client Concentration',topClientPercent,scoreClientConcentration(topClientPercent),25),
    metricRecord('revenueDiversification','Revenue Diversification',client.revenueDiversificationLevel,clampLevel(client.revenueDiversificationLevel),20),
    metricRecord('averageClientTenure','Average Client Tenure',client.averageClientTenureMonths,scoreClientTenure(client.averageClientTenureMonths),15),
    metricRecord('contractDuration','Contract Duration',client.contractDurationLevel,clampLevel(client.contractDurationLevel),15)
  ]);

  const cash = categoryModel('cash', 'Cash Performance', [
    metricRecord('cashReserve','Cash Reserve (months)',cashReserveMonths,scoreCashReserve(cashReserveMonths),25),
    metricRecord('operatingCashFlow','Operating Cash Flow',balance.operatingCashFlowLevel,clampLevel(balance.operatingCashFlowLevel),25),
    metricRecord('currentRatio','Current Ratio',currentRatio,scoreCurrentRatio(currentRatio),20),
    metricRecord('accountsReceivable','Collected Within 30 Days',ar.collectionRatePercent,scoreCollectionRate(ar.collectionRatePercent),15),
    metricRecord('debtPosition','Debt-to-EBITDA',debtToEbitda,scoreDebtRatio(debtToEbitda),15)
  ]);

  const capital = categoryModel('capital', 'Capital Allocation', [
    metricRecord('returnOnCapital','Return on Capital / ROIC-Lite',roicLite,scoreReturnOnCapital(roicLite),30),
    metricRecord('reinvestmentRate','Reinvestment Rate',sde.reinvestmentRatePercent,scoreReinvestmentRate(sde.reinvestmentRatePercent),20),
    metricRecord('technologyInvestment','Technology Investment',sde.technologyInvestmentLevel,clampLevel(sde.technologyInvestmentLevel),15),
    metricRecord('talentInvestment','Talent Investment',sde.talentInvestmentLevel,clampLevel(sde.talentInvestmentLevel),15),
    metricRecord('retainedEarningsGrowth','Retained Earnings Growth',sde.retainedEarningsGrowthLevel,clampLevel(sde.retainedEarningsGrowthLevel),20)
  ]);

  const categories = { profitability, growth, revenueQuality, cash, capital };
  const missingCapabilities = Object.values(categories).filter(category => category.score === null).map(category => category.label);
  if (missingCapabilities.length) {
    const error = new Error(`More financial values are required before Performance can be scored: ${missingCapabilities.join(', ')}.`);
    error.status = 422;
    error.code = 'PERFORMANCE_DATA_INCOMPLETE';
    error.missingCapabilities = missingCapabilities;
    throw error;
  }

  const score = Math.round(Object.entries(CATEGORY_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + (categories[key].score * weight / 100), 0));
  const weightedCoverage = Math.round(Object.entries(CATEGORY_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + (categories[key].coverage * weight / 100), 0));
  const allVerified = rows.length > 0 && rows.every(row => row.validation_status === 'verified');
  // The source rubric defines qualitative confidence layers but not a numeric
  // formula. Manual/unverified inputs are therefore conservatively capped at
  // 80; verified evidence can rise to 95. Missing metric coverage lowers it.
  const confidenceCap = allVerified ? 95 : 80;
  const confidence = Math.min(confidenceCap, Math.round(45 + weightedCoverage * 0.5));
  const validationStatus = allVerified ? 'verified' : 'needs_validation';
  const completedAt = new Date().toISOString();

  const missingEvidence = [];
  for (const category of Object.values(categories)) {
    for (const metric of category.metrics) {
      if (metric.score === null) missingEvidence.push(`${category.label}: ${metric.label}`);
    }
  }

  const categoryScores = Object.fromEntries(Object.entries(categories).map(([key, category]) => [key, {
    categoryScore: category.score,
    coverage: category.coverage,
    metrics: category.metrics
  }]));

  const files = rows
    .filter(row => row.file_name)
    .map(row => ({ type: row.evidence_type, name: row.file_name, status: row.extraction_status }));

  const details = {
    score,
    confidence,
    confidenceScore: confidence,
    confidenceLabel: allVerified
      ? `Verified financial evidence · ${weightedCoverage}% rubric coverage`
      : `Manual financial evidence · ${weightedCoverage}% rubric coverage · verification recommended`,
    validationStatus,
    validation: allVerified ? 'green' : 'yellow',
    provisional: false,
    completed: true,
    categoryScores,
    financials: {
      revenueTTM: revenue,
      cogsTTM: cogs,
      cogsPercent: revenue !== null && cogs !== null ? pctOf(cogs, revenue) : null,
      grossProfitTTM: grossProfit,
      grossMarginPercent: grossMargin,
      netIncomeTTM: netIncome,
      netMargin,
      adjustedSDE,
      sdeMarginPercent: sdeMargin,
      cashReserveMonths,
      currentRatio,
      debtToEbitda,
      recurringRevenuePercent,
      topClientPercent,
      roicLite,
      reinvestmentRatePercent: finite(sde.reinvestmentRatePercent)
    },
    adjustedSDE,
    roicLite,
    evidenceLevel: allVerified ? 'Verified financial evidence' : 'Manual evidence with uploaded financial reports',
    evidence: { files },
    missingEvidence,
    scoringVersion: 'performance-rubric-2026-step6b',
    completedAt
  };

  return { score, confidence, validationStatus, weightedCoverage, categoryScores, details };
}

async function upsertPerformanceIndex(config, runId, model) {
  const params = new URLSearchParams({
    select: 'id,completed_at',
    diagnostic_run_id: `eq.${runId}`,
    index_type: 'eq.performance',
    limit: '1'
  });
  const rows = await supabaseRequest(config, `index_results?${params.toString()}`);
  const existing = Array.isArray(rows) ? rows[0] || null : null;
  const record = {
    diagnostic_run_id: runId,
    index_type: 'performance',
    score: model.score,
    confidence: model.confidence,
    validation_status: model.validationStatus,
    progress: 100,
    complete: true,
    answers: {},
    category_scores: model.categoryScores,
    details: model.details,
    completed_at: existing?.completed_at || model.details.completedAt,
    updated_at: new Date().toISOString()
  };

  if (existing?.id) {
    const update = new URLSearchParams({ id: `eq.${existing.id}` });
    const updated = await supabaseRequest(config, `index_results?${update.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(record)
    });
    return Array.isArray(updated) ? updated[0] || record : record;
  }
  const created = await supabaseRequest(config, 'index_results', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(record)
  });
  return Array.isArray(created) ? created[0] || record : record;
}

async function refreshDiagnosticStateAfterPerformance(config, account, run, model) {
  const params = new URLSearchParams({
    select: 'index_type,score,complete,progress,details',
    diagnostic_run_id: `eq.${run.id}`
  });
  const rows = await supabaseRequest(config, `index_results?${params.toString()}`);
  const map = Object.fromEntries((Array.isArray(rows) ? rows : []).map(row => [row.index_type, row]));
  const allComplete = ['strength','independence','performance'].every(index => map[index]?.complete === true && finite(map[index]?.score) !== null);
  const now = new Date().toISOString();
  const current = account.diagnostic_state && typeof account.diagnostic_state === 'object' ? account.diagnostic_state : {};
  const indexes = { ...(current.indexes || {}) };
  indexes.performance = {
    complete: true,
    progress: 100,
    score: model.score,
    details: model.details
  };
  const count = ['strength','independence','performance'].filter(index => index === 'performance' || indexes[index]?.complete === true || map[index]?.complete === true).length;
  const state = {
    ...current,
    indexes,
    count,
    allComplete,
    reportReady: false,
    generatedAt: null,
    updatedAt: now
  };

  const accountParams = new URLSearchParams({ id: `eq.${account.id}` });
  await supabaseRequest(config, `accounts?${accountParams.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ diagnostic_state: state, updated_at: now })
  });

  const runParams = new URLSearchParams({ id: `eq.${run.id}` });
  await supabaseRequest(config, `diagnostic_runs?${runParams.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: allComplete ? 'ready_to_generate' : 'in_progress', generated_at: null, updated_at: now })
  });

  return { allComplete, state };
}

async function calculatePerformance(config, body) {
  const { account, run } = await requireContext(config, body);
  const rows = await listEvidence(config, run.id);
  const model = buildPerformanceModel(rows);
  const indexResult = await upsertPerformanceIndex(config, run.id, model);
  const diagnostic = await refreshDiagnosticStateAfterPerformance(config, account, run, model);
  return {
    account: { id: account.id, name: account.name, email: account.email, agencyName: account.agency_name },
    diagnosticRun: { id: run.id, status: diagnostic.allComplete ? 'ready_to_generate' : 'in_progress' },
    indexResult,
    performance: model
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    return res.end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  const config = getSupabaseConfig();
  if (!config) return json(res, 503, { error: 'Financial evidence backend is not configured.', code: 'BACKEND_NOT_CONFIGURED' });

  try {
    if (req.method === 'GET') {
      const { account, run } = await requireContext(config, {
        accountId: req.query?.accountId,
        email: req.query?.email,
        agencyUrl: req.query?.agencyUrl
      });
      return json(res, 200, { account, diagnosticRun: run, evidence: await listEvidence(config, run.id) });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
    const body = parseBody(req);
    const action = clean(body.action);

    if (action === 'prepare_upload') {
      const result = await prepareUpload(config, body);
      return json(res, 200, result);
    }
    if (action === 'extract') {
      const result = await extractEvidence(config, body);
      return json(res, 200, result);
    }
    if (action === 'save_sde') {
      const result = await saveSde(config, body);
      return json(res, 200, result);
    }
    if (action === 'save_manual') {
      const result = await saveManualEvidence(config, body);
      return json(res, 200, result);
    }
    if (action === 'calculate_performance') {
      const result = await calculatePerformance(config, body);
      return json(res, 200, result);
    }
    return json(res, 422, { error: 'Unknown financial evidence action.' });
  } catch (error) {
    console.error('financial-evidence API error', error);
    const status = Number(error.status) || 500;
    return json(res, status, {
      error: error.message || 'Financial evidence request failed.',
      code: error.code || 'FINANCIAL_EVIDENCE_ERROR',
      phase: error.code === 'DIAGNOSTIC_RUN_REQUIRED' ? 'context' : (error.code === 'EVIDENCE_ROW_NOT_CREATED' ? 'database' : undefined)
    });
  }
}
