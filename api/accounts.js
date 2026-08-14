const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const SELECT = 'id,name,email,agency_url,agency_url_normalized,agency_name,journey,archetype_result,report_data,diagnostic_state,created_at,updated_at';

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
        const rows = await supabaseRequest(config, `accounts?select=${SELECT}&order=created_at.desc`);
        return json(res, 200, { accounts: (Array.isArray(rows) ? rows : []).map(publicAccount) });
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
      const id = clean(req.query?.id || body.id);
      if (!id) return json(res, 422, { error: 'Account ID is required.' });
      await supabaseRequest(config, `accounts?id=eq.${id}`, { method: 'DELETE' });
      return json(res, 200, { success: true, deletedId: id });
    }

    if (req.method === 'POST') {
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
