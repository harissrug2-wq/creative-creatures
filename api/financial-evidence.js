const BUCKET = 'diagnostic-evidence';
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MODEL = 'gpt-5-mini';

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
  const select = 'id,name,email,agency_url,agency_name';
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
  return Array.isArray(rows) ? rows[0] || null : null;
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
      explicitEBITDA: nullableNumber()
    },
    required: ['currency','confidence','warnings','periodLabel','revenueTTM','revenueYTD','cogsTTM','grossProfitTTM','operatingExpensesTTM','netIncomeTTM','netIncomeYTD','explicitEBITDA']
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
  profit_loss: 'Extract the agency Profit & Loss financial values. Prefer Trailing Twelve Months (TTM). If the document contains exactly 12 clearly labeled monthly values, you may sum them for TTM. Do not estimate missing values.',
  balance_sheet: 'Extract balance-sheet values from the most relevant/latest period shown. Do not estimate missing values.',
  ar_aging: 'Extract Accounts Receivable aging totals and aging buckets from the latest report period. Do not estimate missing values.',
  client_revenue: 'Extract each client and its revenue for the stated report period. Use only client revenue explicitly supported by the document.',
  service_revenue_mix: 'Extract revenue by service. Only classify recurring versus project revenue when the document explicitly supports that classification.'
};

function deriveMetrics(evidenceType, data) {
  const out = { ...data };
  const pct = (part, whole) => whole && Number.isFinite(part) && Number.isFinite(whole)
    ? Math.round((part / whole) * 10000) / 100
    : null;

  if (evidenceType === 'profit_loss') {
    const revenue = finite(out.revenueTTM);
    const cogs = finite(out.cogsTTM);
    let gross = finite(out.grossProfitTTM);
    if (gross === null && revenue !== null && cogs !== null) gross = revenue - cogs;
    out.grossProfitTTM = gross;
    out.cogsPercent = revenue !== null && cogs !== null ? pct(cogs, revenue) : null;
    out.grossMarginPercent = revenue !== null && gross !== null ? pct(gross, revenue) : null;
    out.netMargin = revenue !== null && finite(out.netIncomeTTM) !== null ? pct(Number(out.netIncomeTTM), revenue) : null;
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
    out.clientCount = clients.length || null;
    out.topClientRevenue = top;
    out.topClientPercent = total && top !== null ? pct(top, total) : null;
    out.top5Percent = total && clients.length ? pct(topFive, total) : null;
    out.averageClientRevenue = total !== null && clients.length ? Math.round((total / clients.length) * 100) / 100 : null;
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
    out.recurringRevenuePercent = total && recurring !== null ? pct(recurring, total) : null;
    out.projectRevenuePercent = total && project !== null ? pct(project, total) : null;
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
    '- Put ambiguity, missing periods, or suspicious report structure in warnings.'
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
          { type: 'input_file', file_url: fileUrl, filename },
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
  const storagePath = `${account.id}/${run.id}/${evidenceType}/${Date.now()}-${filename}`;
  const evidence = await saveEvidence(config, run.id, evidenceType, {
    file_name: filename,
    file_size_bytes: size,
    storage_path: storagePath,
    mime_type: 'application/pdf',
    extraction_status: 'uploaded',
    extraction_model: null,
    extraction_error: null,
    extracted_at: null,
    extracted_data: {},
    validation_status: 'unverified'
  });
  const signedUploadUrl = await createSignedUploadUrl(config, storagePath);
  return { account, run, evidence, signedUploadUrl };
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
  const ownershipPercent = finite(body.ownershipPercent);
  const extractedAt = new Date().toISOString();
  const evidence = await saveEvidence(config, run.id, 'sde', {
    file_name: null,
    file_size_bytes: null,
    storage_path: null,
    mime_type: 'application/json',
    extraction_status: 'processed',
    extraction_model: 'owner_input',
    extraction_error: null,
    extracted_at: extractedAt,
    extracted_data: {
      benefits,
      ownershipPercent: ownershipPercent === null ? null : Math.max(0, Math.min(100, ownershipPercent)),
      source: 'owner_input',
      capturedAt: extractedAt
    },
    validation_status: 'unverified'
  });
  return { account, run, evidence };
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
    const body = req.body && typeof req.body === 'object' ? req.body : {};
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
    return json(res, 422, { error: 'Unknown financial evidence action.' });
  } catch (error) {
    console.error('financial-evidence API error', error);
    const status = Number(error.status) || 500;
    return json(res, status, {
      error: error.message || 'Financial evidence request failed.',
      code: error.code || 'FINANCIAL_EVIDENCE_ERROR'
    });
  }
}
