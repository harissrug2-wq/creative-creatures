import crypto from 'node:crypto';
import { accountSessionSecret, parseCookies, requireAdmin, verifySession } from '../lib/session-utils.js';

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function getSupabaseConfig() {
  const url = clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const secret = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return url && secret ? { url, secret } : null;
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

function normalizeAgencyUrl(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path === '/' ? '' : path}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  }
}

async function findAccount(config, { accountId, email, agencyUrl }) {
  const select = 'id,name,email,agency_url,agency_name';
  if (accountId && uuidPattern.test(String(accountId))) {
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

function clipped(value, max = 5000) {
  return clean(value).slice(0, max);
}

function optionalUuid(value) {
  const id = clean(value);
  return id && uuidPattern.test(id) ? id : null;
}

function parseUrl(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
    return parsed.toString().slice(0, 2000);
  } catch {
    const error = new Error('Transcript URL must be a valid http or https URL.');
    error.status = 422;
    throw error;
  }
}

function parseRating(value) {
  if (value === null || value === undefined || value === '') return null;
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    const error = new Error('Meeting rating must be between 0 and 10.');
    error.status = 422;
    throw error;
  }
  return Math.round(rating * 10) / 10;
}

function textArray(value, maxItems, maxLength) {
  const input = Array.isArray(value) ? value : clean(value).split(/\r?\n|,/);
  return input.map(item => clipped(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

async function getRows(config, table, accountId, select, order) {
  const params = new URLSearchParams({ select, account_id: `eq.${accountId}` });
  if (order) params.set('order', order);
  const rows = await supabaseRequest(config, `${table}?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

function accountSession(req) {
  const secret = accountSessionSecret();
  if (!secret) return null;
  const session = verifySession(parseCookies(req).cc_account_session, secret);
  return session?.role === 'account' && session?.accountId ? session : null;
}

async function assertOwnedMeeting(config, accountId, meetingId) {
  if (!meetingId) return null;
  const params = new URLSearchParams({
    select: 'id', id: `eq.${meetingId}`, account_id: `eq.${accountId}`, limit: '1'
  });
  const rows = await supabaseRequest(config, `leadership_meetings?${params.toString()}`);
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('The selected meeting is not available for this agency.');
    error.status = 422;
    throw error;
  }
  return meetingId;
}

async function loadLeadership(config, account) {
  const [meetings, todos, issues, plans, rocks] = await Promise.all([
    getRows(config, 'leadership_meetings', account.id, 'id,title,meeting_date,status,facilitator_name,notes,transcript_url,rating,rocks_total,rocks_on_track,created_at,updated_at', 'meeting_date.desc,created_at.desc'),
    getRows(config, 'leadership_todos', account.id, 'id,meeting_id,title,owner_name,due_date,status,created_at,updated_at', 'status.asc,due_date.asc.nullslast,created_at.desc'),
    getRows(config, 'leadership_issues', account.id, 'id,meeting_id,title,description,owner_name,priority,status,solved_at,created_at,updated_at', 'status.asc,created_at.desc'),
    getRows(config, 'leadership_plans', account.id, 'account_id,core_values,core_focus,ten_year_target,three_year_picture,one_year_plan,quarterly_focus,target_market,three_uniques,proven_process,guarantee,updated_at', null),
    getRows(config, 'rocks', account.id, 'id,scorecard_id,source_type,source_key,title,description,owner_name,due,due_date,status,created_at,updated_at', 'created_at.asc')
  ]);

  const todoCounts = new Map();
  const issueCounts = new Map();
  todos.forEach(row => {
    if (!row.meeting_id) return;
    const item = todoCounts.get(row.meeting_id) || { total: 0, open: 0 };
    item.total += 1;
    if (row.status !== 'complete') item.open += 1;
    todoCounts.set(row.meeting_id, item);
  });
  issues.forEach(row => {
    if (!row.meeting_id) return;
    const item = issueCounts.get(row.meeting_id) || { total: 0, open: 0 };
    item.total += 1;
    if (row.status !== 'solved') item.open += 1;
    issueCounts.set(row.meeting_id, item);
  });

  const enrichedMeetings = meetings.map(row => ({
    ...row,
    todo_count: todoCounts.get(row.id)?.total || 0,
    open_todo_count: todoCounts.get(row.id)?.open || 0,
    issue_count: issueCounts.get(row.id)?.total || 0,
    open_issue_count: issueCounts.get(row.id)?.open || 0
  }));
  const completedRatings = meetings.map(row => Number(row.rating)).filter(Number.isFinite);

  return {
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      agencyName: account.agency_name || account.name
    },
    meetings: enrichedMeetings,
    todos,
    issues,
    rocks: rocks.map(row => ({
      id: row.id,
      scorecardId: row.scorecard_id,
      sourceType: row.source_type,
      sourceKey: row.source_key,
      title: row.title,
      description: row.description || '',
      owner: row.owner_name || '',
      due: row.due || 'This quarter',
      dueDate: row.due_date || '',
      status: row.status || 'Not started'
    })),
    plan: plans[0] || {
      core_values: [], core_focus: '', ten_year_target: '', three_year_picture: '',
      one_year_plan: '', quarterly_focus: '', target_market: '', three_uniques: [],
      proven_process: '', guarantee: '', updated_at: null
    },
    summary: {
      lastMeetingAt: meetings[0]?.meeting_date || null,
      openTodos: todos.filter(row => row.status !== 'complete').length,
      openIssues: issues.filter(row => row.status !== 'solved').length,
      averageRating: completedRatings.length
        ? Math.round((completedRatings.reduce((sum, rating) => sum + rating, 0) / completedRatings.length) * 10) / 10
        : null
    }
  };
}

async function saveMeeting(config, accountId, body) {
  const id = optionalUuid(body.id);
  const title = clipped(body.title, 220);
  const meetingDate = clean(body.meetingDate || body.meeting_date);
  const allowedStatuses = ['planned', 'in_progress', 'completed'];
  const status = allowedStatuses.includes(body.status) ? body.status : 'planned';
  if (!title) {
    const error = new Error('Meeting title is required.');
    error.status = 422;
    throw error;
  }
  if (!datePattern.test(meetingDate)) {
    const error = new Error('Meeting date is required.');
    error.status = 422;
    throw error;
  }

  const record = {
    title,
    meeting_date: meetingDate,
    status,
    facilitator_name: clipped(body.facilitatorName ?? body.facilitator_name, 160),
    notes: clipped(body.notes, 12000),
    transcript_url: parseUrl(body.transcriptUrl ?? body.transcript_url),
    rating: parseRating(body.rating),
    updated_at: new Date().toISOString()
  };

  if (status === 'completed') {
    const rocks = await getRows(config, 'rocks', accountId, 'id,status', null);
    record.rocks_total = rocks.length;
    record.rocks_on_track = rocks.filter(row => ['On track', 'Complete'].includes(row.status)).length;
  }

  if (id) {
    const params = new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' });
    const rows = await supabaseRequest(config, `leadership_meetings?${params.toString()}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record)
    });
    if (!Array.isArray(rows) || !rows[0]) {
      const error = new Error('Meeting not found.');
      error.status = 404;
      throw error;
    }
    return rows[0];
  }

  const rows = await supabaseRequest(config, 'leadership_meetings', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ account_id: accountId, ...record })
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function saveIssue(config, accountId, body) {
  const id = optionalUuid(body.id);
  const title = clipped(body.title, 220);
  if (!title) {
    const error = new Error('Issue title is required.');
    error.status = 422;
    throw error;
  }
  const priority = ['low', 'normal', 'high', 'critical'].includes(body.priority) ? body.priority : 'normal';
  const status = ['open', 'discussing', 'solved'].includes(body.status) ? body.status : 'open';
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const record = {
    meeting_id: meetingId,
    title,
    description: clipped(body.description, 6000),
    owner_name: clipped(body.ownerName ?? body.owner_name, 160),
    priority,
    status,
    solved_at: status === 'solved' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  const path = id
    ? `leadership_issues?${new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' }).toString()}`
    : 'leadership_issues';
  const rows = await supabaseRequest(config, path, {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify(id ? record : { account_id: accountId, ...record })
  });
  if (id && (!Array.isArray(rows) || !rows[0])) {
    const error = new Error('Issue not found.');
    error.status = 404;
    throw error;
  }
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function saveTodo(config, accountId, body) {
  const id = optionalUuid(body.id);
  const title = clipped(body.title, 220);
  if (!title) {
    const error = new Error('To-do title is required.');
    error.status = 422;
    throw error;
  }
  const dueDate = clean(body.dueDate ?? body.due_date);
  if (dueDate && !datePattern.test(dueDate)) {
    const error = new Error('To-do due date is invalid.');
    error.status = 422;
    throw error;
  }
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const record = {
    meeting_id: meetingId,
    title,
    owner_name: clipped(body.ownerName ?? body.owner_name, 160),
    due_date: dueDate || null,
    status: body.status === 'complete' ? 'complete' : 'open',
    updated_at: new Date().toISOString()
  };
  const path = id
    ? `leadership_todos?${new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' }).toString()}`
    : 'leadership_todos';
  const rows = await supabaseRequest(config, path, {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify(id ? record : { account_id: accountId, ...record })
  });
  if (id && (!Array.isArray(rows) || !rows[0])) {
    const error = new Error('To-do not found.');
    error.status = 404;
    throw error;
  }
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function savePlan(config, accountId, body) {
  const record = {
    account_id: accountId,
    core_values: textArray(body.coreValues ?? body.core_values, 12, 120),
    core_focus: clipped(body.coreFocus ?? body.core_focus, 3000),
    ten_year_target: clipped(body.tenYearTarget ?? body.ten_year_target, 3000),
    three_year_picture: clipped(body.threeYearPicture ?? body.three_year_picture, 6000),
    one_year_plan: clipped(body.oneYearPlan ?? body.one_year_plan, 6000),
    quarterly_focus: clipped(body.quarterlyFocus ?? body.quarterly_focus, 4000),
    target_market: clipped(body.targetMarket ?? body.target_market, 4000),
    three_uniques: textArray(body.threeUniques ?? body.three_uniques, 3, 500),
    proven_process: clipped(body.provenProcess ?? body.proven_process, 6000),
    guarantee: clipped(body.guarantee, 4000),
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRequest(config, 'leadership_plans?on_conflict=account_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record)
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function saveRock(config, accountId, body) {
  const id = optionalUuid(body.id);
  const title = clipped(body.title, 220);
  if (!title) {
    const error = new Error('Rock title is required.');
    error.status = 422;
    throw error;
  }
  const dueDate = clean(body.dueDate ?? body.due_date);
  if (dueDate && !datePattern.test(dueDate)) {
    const error = new Error('Rock due date is invalid.');
    error.status = 422;
    throw error;
  }
  const record = {
    title,
    description: clipped(body.description, 6000),
    owner_name: clipped(body.owner, 160),
    due: ['This month', 'This quarter', 'Next quarter'].includes(body.due) ? body.due : 'This quarter',
    due_date: dueDate || null,
    status: ['Not started', 'On track', 'Watch', 'Complete'].includes(body.status) ? body.status : 'Not started',
    updated_at: new Date().toISOString()
  };
  if (id) {
    const params = new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' });
    const rows = await supabaseRequest(config, `rocks?${params.toString()}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record)
    });
    if (!Array.isArray(rows) || !rows[0]) {
      const error = new Error('Rock not found.');
      error.status = 404;
      throw error;
    }
    return rows[0];
  }
  const rows = await supabaseRequest(config, 'rocks', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      account_id: accountId,
      scorecard_id: null,
      source_type: 'manual',
      source_key: `manual:${crypto.randomUUID()}`,
      ...record
    })
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });

  const config = getSupabaseConfig();
  if (!config) return json(res, 503, { error: 'Leadership database is not configured.', code: 'BACKEND_NOT_CONFIGURED' });

  try {
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const suppliedIdentity = req.method === 'GET' ? (req.query || {}) : body;
    const session = accountSession(req);
    const admin = requireAdmin(req);
    if (!session && !admin) return json(res, 401, { error: 'Sign in to open Agency Leadership.', code: 'AUTH_REQUIRED' });
    const identity = session
      ? { accountId: session.accountId }
      : suppliedIdentity;
    const account = await findAccount(config, {
      accountId: identity.accountId || identity.account_id,
      email: identity.email,
      agencyUrl: identity.agencyUrl || identity.agency_url
    });
    if (!account) return json(res, 404, { error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });

    if (req.method === 'GET') {
      const leadership = await loadLeadership(config, account);
      return json(res, 200, { ok: true, leadership });
    }

    const action = clean(body.action);
    if (action === 'save_meeting') {
      const meeting = await saveMeeting(config, account.id, body);
      return json(res, 200, { ok: true, meeting });
    }
    if (action === 'save_issue') {
      const issue = await saveIssue(config, account.id, body);
      return json(res, 200, { ok: true, issue });
    }
    if (action === 'save_todo') {
      const todo = await saveTodo(config, account.id, body);
      return json(res, 200, { ok: true, todo });
    }
    if (action === 'save_plan') {
      const plan = await savePlan(config, account.id, body);
      return json(res, 200, { ok: true, plan });
    }
    if (action === 'save_rock') {
      const rock = await saveRock(config, account.id, body);
      return json(res, 200, { ok: true, rock });
    }
    return json(res, 422, { error: 'Unknown Leadership action.', code: 'INVALID_ACTION' });
  } catch (error) {
    console.error('leadership API error', error);
    const status = [400, 404, 409, 422].includes(error.status) ? error.status : 500;
    return json(res, status, {
      error: error.message || 'Leadership data could not be loaded or saved.',
      code: error.code || 'LEADERSHIP_API_ERROR'
    });
  }
}
