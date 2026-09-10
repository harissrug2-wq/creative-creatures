import crypto from 'node:crypto';
import { accountSessionSecret, parseCookies, requireAdmin, verifySession } from '../lib/session-utils.js';
import { runLeadershipCalendarSync } from '../lib/leadership-calendar-sync.js';
import {
  attachMeetingTranscript,
  deleteMeetingTranscript,
  getMeetingTranscript,
  processMeetingTranscript
} from '../lib/leadership-transcripts.js';

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
const sectionKeys = ['segue', 'headlines', 'scorecard', 'rocks', 'todos', 'ids', 'conclude'];
const sectionDefinitions = [
  { key: 'segue', position: 1, minutes: 5 },
  { key: 'headlines', position: 2, minutes: 5 },
  { key: 'scorecard', position: 3, minutes: 5 },
  { key: 'rocks', position: 4, minutes: 5 },
  { key: 'todos', position: 5, minutes: 10 },
  { key: 'ids', position: 6, minutes: 60 },
  { key: 'conclude', position: 7, minutes: 5 }
];
const leadershipPlans = new Set(['platform', 'fractional_coo']);

function getSupabaseConfig() {
  const url = clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
  const secret = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return url && secret ? { url, secret } : null;
}

function cronAuthorized(req) {
  const secret = clean(process.env.CRON_SECRET);
  const supplied = clean(req.headers.authorization).replace(/^Bearer\s+/i, '');
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.secret,
      'Content-Type': 'application/json',
      ...options.headers
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
  const select = 'id,name,email,agency_url,agency_name,journey,access_plan,diagnostic_state';
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

function parseTimestamp(value, fieldName) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} must be a valid date and time.`);
    error.status = 422;
    throw error;
  }
  return parsed.toISOString();
}

function parseNumber(value, fieldName, { min = null, max = null, nullable = true } = {}) {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    const error = new Error(`${fieldName} is required.`);
    error.status = 422;
    throw error;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || (min !== null && number < min) || (max !== null && number > max)) {
    const error = new Error(`${fieldName} is invalid.`);
    error.status = 422;
    throw error;
  }
  return number;
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

function parseAgenda(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const list = (items, max = 100) => (Array.isArray(items) ? items : []).slice(0, max).map(item => ({
    id: clipped(item?.id || crypto.randomUUID(), 80),
    text: clipped(item?.text, 1000)
  })).filter(item => item.text);
  const ratings = (Array.isArray(input.ratings) ? input.ratings : []).slice(0, 100).map(item => ({
    id: clipped(item?.id || crypto.randomUUID(), 80),
    name: clipped(item?.name, 160),
    score: parseRating(item?.score),
    note: clipped(item?.note, 1000)
  })).filter(item => item.name || item.score !== null || item.note);
  const rockNotes = {};
  Object.entries(input.rockNotes && typeof input.rockNotes === 'object' ? input.rockNotes : {}).slice(0, 200).forEach(([id, note]) => {
    if (!uuidPattern.test(id)) return;
    rockNotes[id] = { note: clipped(note?.note, 1000) };
  });
  return {
    version: 1,
    goodNews: list(input.goodNews),
    headlines: list(input.headlines),
    cascadeMessages: list(input.cascadeMessages),
    ratings,
    rockNotes
  };
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

async function requireLeadershipAccess(config, session) {
  if (!session?.memberId) return;
  const params = new URLSearchParams({
    select: 'id,departments,status',
    id: `eq.${session.memberId}`,
    account_id: `eq.${session.accountId}`,
    limit: '1'
  });
  const rows = await supabaseRequest(config, `account_members?${params.toString()}`);
  const member = Array.isArray(rows) ? rows[0] : null;
  if (!member || member.status !== 'active') {
    const error = new Error('Your account access is no longer active.');
    error.status = 401;
    throw error;
  }
  if (!Array.isArray(member.departments) || !member.departments.includes('leadership')) {
    const error = new Error('Your account does not have access to Leadership.');
    error.status = 403;
    throw error;
  }
}

function accountHasLeadership(account) {
  if (leadershipPlans.has(account?.access_plan)) return true;
  const purchased = Array.isArray(account?.diagnostic_state?.purchasedPlans)
    ? account.diagnostic_state.purchasedPlans
    : [];
  if (purchased.some(plan => leadershipPlans.has(plan))) return true;
  return account?.access_plan === 'accelerator'
    && account?.diagnostic_state?.acceleratorCompleted === true;
}

function requireLeadershipPlan(account) {
  if (accountHasLeadership(account)) return;
  const error = new Error('Agency Leadership is not included in this account plan.');
  error.status = 403;
  throw error;
}

async function assertOwnedMeeting(config, accountId, meetingId) {
  if (!meetingId) return null;
  const params = new URLSearchParams({
    select: 'id,title,meeting_date', id: `eq.${meetingId}`, account_id: `eq.${accountId}`, limit: '1'
  });
  const rows = await supabaseRequest(config, `leadership_meetings?${params.toString()}`);
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('The selected meeting is not available for this agency.');
    error.status = 422;
    throw error;
  }
  return rows[0];
}

async function assertOwnedTeam(config, accountId, teamId) {
  const id = optionalUuid(teamId);
  if (!id) {
    const error = new Error('A valid Leadership team is required.');
    error.status = 422;
    throw error;
  }
  const params = new URLSearchParams({
    select: 'id,name,is_default', id: `eq.${id}`, account_id: `eq.${accountId}`, limit: '1'
  });
  const rows = await supabaseRequest(config, `leadership_teams?${params.toString()}`);
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('The selected Leadership team is not available for this agency.');
    error.status = 422;
    throw error;
  }
  return rows[0];
}

async function ensureDefaultTeam(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,name,is_default', account_id: `eq.${accountId}`, is_default: 'eq.true', limit: '1'
  });
  const existing = await supabaseRequest(config, `leadership_teams?${params.toString()}`);
  if (Array.isArray(existing) && existing[0]) return existing[0];
  try {
    const rows = await supabaseRequest(config, 'leadership_teams', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ account_id: accountId, name: 'Leadership Team', is_default: true })
    });
    if (Array.isArray(rows) && rows[0]) return rows[0];
  } catch (error) {
    if (error?.payload?.code !== '23505') throw error;
  }
  const rows = await supabaseRequest(config, `leadership_teams?${params.toString()}`);
  if (Array.isArray(rows) && rows[0]) return rows[0];
  const error = new Error('The default Leadership team could not be created.');
  error.status = 500;
  throw error;
}

async function assertOwnedMetric(config, accountId, metricId) {
  const id = optionalUuid(metricId);
  if (!id) {
    const error = new Error('A valid scorecard metric is required.');
    error.status = 422;
    throw error;
  }
  const params = new URLSearchParams({
    select: 'id,team_id', id: `eq.${id}`, account_id: `eq.${accountId}`, limit: '1'
  });
  const rows = await supabaseRequest(config, `leadership_metrics?${params.toString()}`);
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('The selected metric is not available for this agency.');
    error.status = 422;
    throw error;
  }
  return rows[0];
}

async function loadLeadership(config, account) {
  const [meetings, todos, issues, plans, rocks, teams, teamMembers, metrics, metricEntries, headlines, attendees, sections, meetingItems] = await Promise.all([
    getRows(config, 'leadership_meetings', account.id, 'id,team_id,title,meeting_date,status,facilitator_name,notes,transcript_url,rating,rocks_total,rocks_on_track,source,calendar_event_id,calendar_html_url,source_updated_at,agenda,starts_at,ends_at,started_at,completed_at,current_section,meeting_url,calendar_status,transcript_status,transcript_provider,transcript_external_id,transcript_error,transcript_received_at,transcript_processed_at,created_at,updated_at', 'meeting_date.desc,created_at.desc'),
    getRows(config, 'leadership_todos', account.id, 'id,meeting_id,title,owner_name,due_date,status,created_at,updated_at', 'status.asc,due_date.asc.nullslast,created_at.desc'),
    getRows(config, 'leadership_issues', account.id, 'id,meeting_id,title,description,owner_name,priority,status,solved_at,created_at,updated_at', 'status.asc,created_at.desc'),
    getRows(config, 'leadership_plans', account.id, 'account_id,core_values,core_focus,ten_year_target,three_year_picture,one_year_plan,quarterly_focus,target_market,three_uniques,proven_process,guarantee,updated_at', null),
    getRows(config, 'rocks', account.id, 'id,scorecard_id,source_type,source_key,title,description,owner_name,due,due_date,status,created_at,updated_at', 'created_at.asc'),
    getRows(config, 'leadership_teams', account.id, 'id,name,is_default,cadence,meeting_weekday,meeting_time,duration_minutes,calendar_id,active,created_at,updated_at', 'is_default.desc,name.asc'),
    getRows(config, 'leadership_team_members', account.id, 'id,team_id,member_id,display_name,email,meeting_role,active,created_at,updated_at', 'display_name.asc'),
    getRows(config, 'leadership_metrics', account.id, 'id,team_id,name,owner_name,unit,direction,target_value,target_min,target_max,active,sort_order,created_at,updated_at', 'sort_order.asc,created_at.asc'),
    getRows(config, 'leadership_metric_entries', account.id, 'id,metric_id,week_start,value,status,note,source,recorded_at,created_at,updated_at', 'week_start.desc,created_at.desc'),
    getRows(config, 'leadership_headlines', account.id, 'id,meeting_id,kind,headline,sort_order,created_at,updated_at', 'sort_order.asc,created_at.asc'),
    getRows(config, 'leadership_meeting_attendees', account.id, 'id,meeting_id,member_id,display_name,attended,rating,rating_note,created_at,updated_at', 'display_name.asc'),
    getRows(config, 'leadership_meeting_sections', account.id, 'id,meeting_id,section_key,position,duration_minutes,status,started_at,completed_at,notes,created_at,updated_at', 'position.asc'),
    getRows(config, 'leadership_meeting_items', account.id, 'id,meeting_id,section_key,item_type,source_id,snapshot,outcome,sort_order,created_at,updated_at', 'sort_order.asc,created_at.asc')
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

  const today = new Date().toISOString().slice(0, 10);
  const meetingGroup = row => {
    if (row.status === 'in_progress') return 0;
    if (row.status === 'planned' && row.meeting_date >= today) return 1;
    return 2;
  };
  const enrichedMeetings = meetings.map(row => ({
    ...row,
    todo_count: todoCounts.get(row.id)?.total || 0,
    open_todo_count: todoCounts.get(row.id)?.open || 0,
    issue_count: issueCounts.get(row.id)?.total || 0,
    open_issue_count: issueCounts.get(row.id)?.open || 0
  })).sort((left, right) => {
    const groupDifference = meetingGroup(left) - meetingGroup(right);
    if (groupDifference) return groupDifference;
    const dateDifference = left.meeting_date.localeCompare(right.meeting_date);
    if (meetingGroup(left) < 2) return dateDifference;
    return -dateDifference || right.created_at.localeCompare(left.created_at);
  });
  const completedMeetings = meetings.filter(row => row.status === 'completed');
  const completedRatings = completedMeetings
    .filter(row => row.rating !== null && row.rating !== undefined && row.rating !== '')
    .map(row => Number(row.rating))
    .filter(Number.isFinite);
  const lastCompletedMeeting = completedMeetings[0] || null;

  return {
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      agencyName: account.agency_name || account.name
    },
    meetings: enrichedMeetings,
    teams,
    teamMembers,
    metrics,
    metricEntries,
    headlines,
    attendees,
    sections,
    meetingItems,
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
      lastMeetingAt: lastCompletedMeeting?.meeting_date || null,
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

  const team = body.teamId || body.team_id
    ? await assertOwnedTeam(config, accountId, body.teamId || body.team_id)
    : await ensureDefaultTeam(config, accountId);
  const hasStartsAt = Object.hasOwn(body, 'startsAt') || Object.hasOwn(body, 'starts_at');
  const hasEndsAt = Object.hasOwn(body, 'endsAt') || Object.hasOwn(body, 'ends_at');
  const hasMeetingUrl = Object.hasOwn(body, 'meetingUrl') || Object.hasOwn(body, 'meeting_url');
  const startsAt = hasStartsAt ? parseTimestamp(body.startsAt ?? body.starts_at, 'Meeting start') : null;
  const endsAt = hasEndsAt ? parseTimestamp(body.endsAt ?? body.ends_at, 'Meeting end') : null;
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    const error = new Error('Meeting end must be after its start.');
    error.status = 422;
    throw error;
  }

  const record = {
    team_id: team.id,
    title,
    meeting_date: meetingDate,
    status,
    facilitator_name: clipped(body.facilitatorName ?? body.facilitator_name, 160),
    notes: clipped(body.notes, 12000),
    transcript_url: parseUrl(body.transcriptUrl ?? body.transcript_url),
    rating: parseRating(body.rating),
    agenda: parseAgenda(body.agenda),
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  if (hasStartsAt) record.starts_at = startsAt;
  if (hasEndsAt) record.ends_at = endsAt;
  if (hasMeetingUrl) record.meeting_url = parseUrl(body.meetingUrl ?? body.meeting_url);

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

async function syncCalendarMeeting(config, accountId, body) {
  const eventId = clipped(body.calendarEventId, 500);
  const meetingDate = clean(body.meetingDate);
  if (!eventId || !datePattern.test(meetingDate)) {
    const error = new Error('A valid calendar event and date are required.');
    error.status = 422;
    throw error;
  }
  const team = await ensureDefaultTeam(config, accountId);
  const params = new URLSearchParams({
    select: 'id,source_updated_at', account_id: `eq.${accountId}`,
    calendar_event_id: `eq.${eventId}`, limit: '1'
  });
  const existing = await supabaseRequest(config, `leadership_meetings?${params.toString()}`);
  let sourceUpdatedAt = null;
  if (body.sourceUpdatedAt) {
    const parsedSourceDate = new Date(body.sourceUpdatedAt);
    if (!Number.isNaN(parsedSourceDate.getTime())) sourceUpdatedAt = parsedSourceDate.toISOString();
  }
  const record = {
    team_id: team.id,
    title: clipped(body.title, 220) || `Weekly Leadership L10 — ${meetingDate}`,
    meeting_date: meetingDate,
    source: 'google_calendar',
    calendar_event_id: eventId,
    calendar_html_url: parseUrl(body.calendarHtmlUrl),
    starts_at: parseTimestamp(body.startsAt, 'Meeting start'),
    ends_at: parseTimestamp(body.endsAt, 'Meeting end'),
    calendar_status: body.calendarStatus === 'cancelled' ? 'cancelled' : 'scheduled',
    source_updated_at: sourceUpdatedAt,
    updated_at: new Date().toISOString()
  };
  if (Array.isArray(existing) && existing[0]) {
    if (existing[0].source_updated_at === sourceUpdatedAt) return { meeting: existing[0], changed: false };
    const updateParams = new URLSearchParams({ id: `eq.${existing[0].id}`, account_id: `eq.${accountId}`, select: '*' });
    const rows = await supabaseRequest(config, `leadership_meetings?${updateParams.toString()}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record)
    });
    return { meeting: rows?.[0] || existing[0], changed: true };
  }
  const rows = await supabaseRequest(config, 'leadership_meetings', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ account_id: accountId, status: 'planned', agenda: {}, ...record })
  });
  return { meeting: rows?.[0] || null, changed: true };
}

async function saveTeam(config, accountId, body) {
  const id = optionalUuid(body.id);
  const name = clipped(body.name, 160);
  if (!name) {
    const error = new Error('Team name is required.');
    error.status = 422;
    throw error;
  }
  const cadence = ['weekly', 'biweekly', 'monthly'].includes(body.cadence) ? body.cadence : 'weekly';
  const weekday = body.meetingWeekday ?? body.meeting_weekday;
  const meetingWeekday = weekday === '' || weekday === null || weekday === undefined
    ? null
    : parseNumber(weekday, 'Meeting weekday', { min: 0, max: 6, nullable: false });
  const duration = parseNumber(body.durationMinutes ?? body.duration_minutes ?? 90, 'Meeting duration', {
    min: 15, max: 480, nullable: false
  });
  const record = {
    name,
    cadence,
    meeting_weekday: meetingWeekday,
    meeting_time: clean(body.meetingTime ?? body.meeting_time) || null,
    duration_minutes: Math.round(duration),
    calendar_id: clipped(body.calendarId ?? body.calendar_id, 500) || null,
    active: body.active !== false,
    updated_at: new Date().toISOString()
  };
  const path = id
    ? `leadership_teams?${new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' }).toString()}`
    : 'leadership_teams';
  const rows = await supabaseRequest(config, path, {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify(id ? record : { account_id: accountId, is_default: false, ...record })
  });
  if (id && (!Array.isArray(rows) || !rows[0])) {
    const error = new Error('Leadership team not found.');
    error.status = 404;
    throw error;
  }
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function saveMetric(config, accountId, body) {
  const id = optionalUuid(body.id);
  const name = clipped(body.name, 180);
  if (!name) {
    const error = new Error('Metric name is required.');
    error.status = 422;
    throw error;
  }
  const team = body.teamId || body.team_id
    ? await assertOwnedTeam(config, accountId, body.teamId || body.team_id)
    : await ensureDefaultTeam(config, accountId);
  const direction = ['higher', 'lower', 'range'].includes(body.direction) ? body.direction : 'higher';
  const record = {
    team_id: team.id,
    name,
    owner_name: clipped(body.ownerName ?? body.owner_name, 160),
    unit: clipped(body.unit, 40) || 'number',
    direction,
    target_value: parseNumber(body.targetValue ?? body.target_value, 'Target value'),
    target_min: parseNumber(body.targetMin ?? body.target_min, 'Minimum target'),
    target_max: parseNumber(body.targetMax ?? body.target_max, 'Maximum target'),
    active: body.active !== false,
    sort_order: Math.round(parseNumber(body.sortOrder ?? body.sort_order ?? 0, 'Sort order', {
      min: 0, max: 10000, nullable: false
    })),
    updated_at: new Date().toISOString()
  };
  if (direction === 'range' && record.target_min !== null && record.target_max !== null
    && record.target_min > record.target_max) {
    const error = new Error('Minimum target cannot exceed maximum target.');
    error.status = 422;
    throw error;
  }
  const path = id
    ? `leadership_metrics?${new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' }).toString()}`
    : 'leadership_metrics';
  const rows = await supabaseRequest(config, path, {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify(id ? record : { account_id: accountId, ...record })
  });
  if (id && (!Array.isArray(rows) || !rows[0])) {
    const error = new Error('Scorecard metric not found.');
    error.status = 404;
    throw error;
  }
  return Array.isArray(rows) ? rows[0] || null : rows;
}

function metricStatus(metric, value) {
  if (value === null) return 'no_data';
  const target = metric.target_value === null ? null : Number(metric.target_value);
  const minimum = metric.target_min === null ? null : Number(metric.target_min);
  const maximum = metric.target_max === null ? null : Number(metric.target_max);
  if (metric.direction === 'lower') return target === null ? 'no_data' : value <= target ? 'on_track' : 'off_track';
  if (metric.direction === 'range') {
    if (minimum !== null && value < minimum) return 'off_track';
    if (maximum !== null && value > maximum) return 'off_track';
    return minimum === null && maximum === null ? 'no_data' : 'on_track';
  }
  return target === null ? 'no_data' : value >= target ? 'on_track' : 'off_track';
}

async function saveMetricEntry(config, accountId, body) {
  const metric = await assertOwnedMetric(config, accountId, body.metricId ?? body.metric_id);
  const weekStart = clean(body.weekStart ?? body.week_start);
  if (!datePattern.test(weekStart)) {
    const error = new Error('Week start date is required.');
    error.status = 422;
    throw error;
  }
  const value = parseNumber(body.value, 'Metric value');
  const metricRows = await supabaseRequest(config, `leadership_metrics?${new URLSearchParams({
    select: 'id,direction,target_value,target_min,target_max', id: `eq.${metric.id}`, account_id: `eq.${accountId}`, limit: '1'
  }).toString()}`);
  const definition = metricRows?.[0];
  const record = {
    account_id: accountId,
    metric_id: metric.id,
    week_start: weekStart,
    value,
    status: metricStatus(definition, value),
    note: clipped(body.note, 1000),
    source: ['manual', 'integration', 'meeting'].includes(body.source) ? body.source : 'manual',
    recorded_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const rows = await supabaseRequest(config, 'leadership_metric_entries?on_conflict=metric_id,week_start', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record)
  });
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function saveHeadline(config, accountId, body) {
  const id = optionalUuid(body.id);
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const headline = clipped(body.headline ?? body.text, 1000);
  if (!headline) {
    const error = new Error('Headline text is required.');
    error.status = 422;
    throw error;
  }
  const kind = ['good_news', 'customer', 'employee'].includes(body.kind) ? body.kind : 'customer';
  const record = {
    meeting_id: meetingId,
    kind,
    headline,
    sort_order: Math.round(parseNumber(body.sortOrder ?? body.sort_order ?? 0, 'Sort order', {
      min: 0, max: 10000, nullable: false
    })),
    updated_at: new Date().toISOString()
  };
  const path = id
    ? `leadership_headlines?${new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' }).toString()}`
    : 'leadership_headlines';
  const rows = await supabaseRequest(config, path, {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify(id ? record : { account_id: accountId, ...record })
  });
  if (id && (!Array.isArray(rows) || !rows[0])) {
    const error = new Error('Headline not found.');
    error.status = 404;
    throw error;
  }
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function saveAttendee(config, accountId, body) {
  const id = optionalUuid(body.id);
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const displayName = clipped(body.displayName ?? body.display_name, 160);
  if (!displayName) {
    const error = new Error('Attendee name is required.');
    error.status = 422;
    throw error;
  }
  const memberId = optionalUuid(body.memberId ?? body.member_id);
  if (memberId) {
    const params = new URLSearchParams({
      select: 'id', id: `eq.${memberId}`, account_id: `eq.${accountId}`, status: 'eq.active', limit: '1'
    });
    const members = await supabaseRequest(config, `account_members?${params.toString()}`);
    if (!Array.isArray(members) || !members[0]) {
      const error = new Error('The selected attendee is not an active agency user.');
      error.status = 422;
      throw error;
    }
  }
  const attendeeRating = parseRating(body.rating);
  if (attendeeRating !== null && attendeeRating < 1) {
    const error = new Error('Attendee rating must be between 1 and 10.');
    error.status = 422;
    throw error;
  }
  const record = {
    meeting_id: meetingId,
    member_id: memberId,
    display_name: displayName,
    attended: body.attended !== false,
    rating: attendeeRating,
    rating_note: clipped(body.ratingNote ?? body.rating_note, 1000),
    updated_at: new Date().toISOString()
  };
  const path = id
    ? `leadership_meeting_attendees?${new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}`, select: '*' }).toString()}`
    : 'leadership_meeting_attendees';
  const rows = await supabaseRequest(config, path, {
    method: id ? 'PATCH' : 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify(id ? record : { account_id: accountId, ...record })
  });
  if (id && (!Array.isArray(rows) || !rows[0])) {
    const error = new Error('Meeting attendee not found.');
    error.status = 404;
    throw error;
  }
  return Array.isArray(rows) ? rows[0] || null : rows;
}

async function meetingRows(config, table, accountId, meetingId, select = '*', order = '') {
  const params = new URLSearchParams({
    select, account_id: `eq.${accountId}`, meeting_id: `eq.${meetingId}`
  });
  if (order) params.set('order', order);
  const rows = await supabaseRequest(config, `${table}?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function snapshotMeetingItems(config, accountId, meetingId, teamId) {
  const existing = await meetingRows(config, 'leadership_meeting_items', accountId, meetingId, 'id');
  if (existing.length) return existing;
  const [rocks, todos, issues, metrics, entries] = await Promise.all([
    getRows(config, 'rocks', accountId, 'id,title,description,owner_name,due,due_date,status', 'created_at.asc'),
    getRows(config, 'leadership_todos', accountId, 'id,title,owner_name,due_date,status', 'created_at.asc'),
    getRows(config, 'leadership_issues', accountId, 'id,title,description,owner_name,priority,status', 'created_at.asc'),
    getRows(config, 'leadership_metrics', accountId, 'id,team_id,name,owner_name,unit,direction,target_value,target_min,target_max,active,sort_order', 'sort_order.asc'),
    getRows(config, 'leadership_metric_entries', accountId, 'id,metric_id,week_start,value,status,note,source', 'week_start.desc')
  ]);
  const latestEntry = new Map();
  entries.forEach(entry => {
    if (!latestEntry.has(entry.metric_id)) latestEntry.set(entry.metric_id, entry);
  });
  const records = [];
  const add = (sectionKey, itemType, sourceId, snapshot, sortOrder) => records.push({
    account_id: accountId,
    meeting_id: meetingId,
    section_key: sectionKey,
    item_type: itemType,
    source_id: sourceId,
    snapshot,
    outcome: {},
    sort_order: sortOrder
  });
  rocks.forEach((rock, index) => add('rocks', 'rock', rock.id, rock, index));
  todos.filter(todo => todo.status !== 'complete').forEach((todo, index) => add('todos', 'todo', todo.id, todo, index));
  issues.filter(issue => issue.status !== 'solved').forEach((issue, index) => add('ids', 'issue', issue.id, issue, index));
  metrics.filter(metric => metric.active && metric.team_id === teamId).forEach((metric, index) => add(
    'scorecard', 'metric', metric.id, { ...metric, latestEntry: latestEntry.get(metric.id) || null }, index
  ));
  if (!records.length) return [];
  const rows = await supabaseRequest(config, 'leadership_meeting_items', {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(records)
  });
  return Array.isArray(rows) ? rows : [];
}

async function startMeeting(config, accountId, body) {
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const params = new URLSearchParams({
    select: 'id,team_id,status,started_at', id: `eq.${meetingId}`, account_id: `eq.${accountId}`, limit: '1'
  });
  const meeting = (await supabaseRequest(config, `leadership_meetings?${params.toString()}`))?.[0];
  if (meeting.status === 'completed') {
    const error = new Error('A completed meeting cannot be restarted.');
    error.status = 409;
    throw error;
  }
  const team = meeting.team_id
    ? await assertOwnedTeam(config, accountId, meeting.team_id)
    : await ensureDefaultTeam(config, accountId);
  const existingSections = await meetingRows(
    config, 'leadership_meeting_sections', accountId, meetingId, 'id,section_key,status', 'position.asc'
  );
  let currentSection = existingSections.find(section => section.status === 'current')?.section_key || 'segue';
  if (!existingSections.length) {
    const now = new Date().toISOString();
    await supabaseRequest(config, 'leadership_meeting_sections', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(sectionDefinitions.map(section => ({
        account_id: accountId,
        meeting_id: meetingId,
        section_key: section.key,
        position: section.position,
        duration_minutes: section.minutes,
        status: section.key === 'segue' ? 'current' : 'pending',
        started_at: section.key === 'segue' ? now : null
      })))
    });
    currentSection = 'segue';
  }
  await snapshotMeetingItems(config, accountId, meetingId, team.id);
  const now = new Date().toISOString();
  const updateParams = new URLSearchParams({ id: `eq.${meetingId}`, account_id: `eq.${accountId}`, select: '*' });
  const rows = await supabaseRequest(config, `leadership_meetings?${updateParams.toString()}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      team_id: team.id,
      status: 'in_progress',
      current_section: currentSection,
      started_at: meeting.started_at || now,
      updated_at: now
    })
  });
  return rows?.[0] || null;
}

async function setMeetingSection(config, accountId, body) {
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const sectionKey = clean(body.sectionKey ?? body.section_key);
  if (!sectionKeys.includes(sectionKey)) {
    const error = new Error('A valid meeting section is required.');
    error.status = 422;
    throw error;
  }
  const now = new Date().toISOString();
  const currentParams = new URLSearchParams({
    meeting_id: `eq.${meetingId}`, account_id: `eq.${accountId}`, status: 'eq.current'
  });
  await supabaseRequest(config, `leadership_meeting_sections?${currentParams.toString()}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'completed', completed_at: now, updated_at: now })
  });
  const targetParams = new URLSearchParams({
    meeting_id: `eq.${meetingId}`, account_id: `eq.${accountId}`, section_key: `eq.${sectionKey}`, select: '*'
  });
  const sections = await supabaseRequest(config, `leadership_meeting_sections?${targetParams.toString()}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'current', started_at: now, completed_at: null, updated_at: now })
  });
  if (!Array.isArray(sections) || !sections[0]) {
    const error = new Error('Start the meeting before changing sections.');
    error.status = 409;
    throw error;
  }
  const meetingParams = new URLSearchParams({ id: `eq.${meetingId}`, account_id: `eq.${accountId}`, select: '*' });
  const meetings = await supabaseRequest(config, `leadership_meetings?${meetingParams.toString()}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'in_progress', current_section: sectionKey, updated_at: now })
  });
  return { meeting: meetings?.[0] || null, section: sections[0] };
}

async function saveMeetingItemOutcome(config, accountId, body) {
  const id = optionalUuid(body.id);
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  if (!id || !meetingId) {
    const error = new Error('A valid meeting item is required.');
    error.status = 422;
    throw error;
  }
  await assertOwnedMeeting(config, accountId, meetingId);
  const outcome = body.outcome && typeof body.outcome === 'object' && !Array.isArray(body.outcome)
    ? body.outcome
    : {};
  const params = new URLSearchParams({
    id: `eq.${id}`, meeting_id: `eq.${meetingId}`, account_id: `eq.${accountId}`, select: '*'
  });
  const rows = await supabaseRequest(config, `leadership_meeting_items?${params.toString()}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ outcome, updated_at: new Date().toISOString() })
  });
  if (!Array.isArray(rows) || !rows[0]) {
    const error = new Error('Meeting item not found.');
    error.status = 404;
    throw error;
  }
  return rows[0];
}

async function completeMeeting(config, accountId, body) {
  const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
  await assertOwnedMeeting(config, accountId, meetingId);
  const [rocks, attendees] = await Promise.all([
    getRows(config, 'rocks', accountId, 'id,status', null),
    meetingRows(config, 'leadership_meeting_attendees', accountId, meetingId, 'rating,attended')
  ]);
  const ratings = attendees.filter(row => row.attended && Number.isFinite(Number(row.rating)))
    .map(row => Number(row.rating));
  const rating = ratings.length
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
    : null;
  const now = new Date().toISOString();
  const sectionParams = new URLSearchParams({ meeting_id: `eq.${meetingId}`, account_id: `eq.${accountId}` });
  await supabaseRequest(config, `leadership_meeting_sections?${sectionParams.toString()}`, {
    method: 'PATCH', body: JSON.stringify({
      status: 'completed', completed_at: now, updated_at: now
    })
  });
  const params = new URLSearchParams({ id: `eq.${meetingId}`, account_id: `eq.${accountId}`, select: '*' });
  const rows = await supabaseRequest(config, `leadership_meetings?${params.toString()}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'completed',
      current_section: 'conclude',
      completed_at: now,
      rating,
      rocks_total: rocks.length,
      rocks_on_track: rocks.filter(row => ['On track', 'Complete'].includes(row.status)).length,
      updated_at: now
    })
  });
  return rows?.[0] || null;
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

async function deleteLeadershipItem(config, accountId, body) {
  const id = optionalUuid(body.id);
  const table = body.itemType === 'todo' ? 'leadership_todos' : body.itemType === 'issue' ? 'leadership_issues' : '';
  if (!id || !table) {
    const error = new Error('A valid Leadership item is required.');
    error.status = 422;
    throw error;
  }
  const params = new URLSearchParams({ id: `eq.${id}`, account_id: `eq.${accountId}` });
  await supabaseRequest(config, `${table}?${params.toString()}`, { method: 'DELETE' });
  return true;
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
    if (req.method === 'GET' && clean(req.query?.cron) === 'calendar') {
      if (!cronAuthorized(req)) return json(res, 401, { error: 'Unauthorized.' });
      const result = await runLeadershipCalendarSync(config);
      return json(res, 200, result);
    }
    const body = req.method === 'POST'
      ? (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}))
      : {};
    const suppliedIdentity = req.method === 'GET' ? (req.query || {}) : body;
    const session = accountSession(req);
    const admin = requireAdmin(req);
    if (!session && !admin) return json(res, 401, { error: 'Sign in to open Agency Leadership.', code: 'AUTH_REQUIRED' });
    if (session) await requireLeadershipAccess(config, session);
    const identity = session
      ? { accountId: session.accountId }
      : suppliedIdentity;
    const account = await findAccount(config, {
      accountId: identity.accountId || identity.account_id,
      email: identity.email,
      agencyUrl: identity.agencyUrl || identity.agency_url
    });
    if (!account) return json(res, 404, { error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });
    if (session) requireLeadershipPlan(account);

    if (req.method === 'GET') {
      const leadership = await loadLeadership(config, account);
      return json(res, 200, { ok: true, leadership });
    }

    const action = clean(body.action);
    if (action === 'save_meeting') {
      const meeting = await saveMeeting(config, account.id, body);
      return json(res, 200, { ok: true, meeting });
    }
    if (['get_transcript', 'attach_transcript', 'process_transcript', 'delete_transcript'].includes(action)) {
      const meetingId = optionalUuid(body.meetingId ?? body.meeting_id);
      if (!meetingId) return json(res, 422, { error: 'A valid meeting is required.' });
      const ownedMeeting = await assertOwnedMeeting(config, account.id, meetingId);
      const context = {
        config,
        request: supabaseRequest,
        accountId: account.id,
        meetingId,
        meetingDate: ownedMeeting.meeting_date
      };
      if (action === 'get_transcript') {
        const transcript = await getMeetingTranscript(context);
        return json(res, 200, { ok: true, transcript });
      }
      if (action === 'attach_transcript') {
        const transcript = await attachMeetingTranscript({ ...context, body });
        return json(res, 200, { ok: true, transcript });
      }
      if (action === 'process_transcript') {
        const transcript = await processMeetingTranscript(context);
        return json(res, 200, { ok: true, transcript });
      }
      await deleteMeetingTranscript(context);
      return json(res, 200, { ok: true });
    }
    if (action === 'sync_calendar_meeting') {
      const result = await syncCalendarMeeting(config, account.id, body);
      return json(res, 200, { ok: true, ...result });
    }
    if (action === 'save_team') {
      if (session?.memberId) return json(res, 403, { error: 'Only the agency owner can manage Leadership teams.' });
      const team = await saveTeam(config, account.id, body);
      return json(res, 200, { ok: true, team });
    }
    if (action === 'save_metric') {
      const metric = await saveMetric(config, account.id, body);
      return json(res, 200, { ok: true, metric });
    }
    if (action === 'save_metric_entry') {
      const entry = await saveMetricEntry(config, account.id, body);
      return json(res, 200, { ok: true, entry });
    }
    if (action === 'save_headline') {
      const headline = await saveHeadline(config, account.id, body);
      return json(res, 200, { ok: true, headline });
    }
    if (action === 'save_attendee') {
      const attendee = await saveAttendee(config, account.id, body);
      return json(res, 200, { ok: true, attendee });
    }
    if (action === 'start_meeting') {
      const meeting = await startMeeting(config, account.id, body);
      return json(res, 200, { ok: true, meeting });
    }
    if (action === 'set_meeting_section') {
      const result = await setMeetingSection(config, account.id, body);
      return json(res, 200, { ok: true, ...result });
    }
    if (action === 'save_meeting_item_outcome') {
      const item = await saveMeetingItemOutcome(config, account.id, body);
      return json(res, 200, { ok: true, item });
    }
    if (action === 'complete_meeting') {
      const meeting = await completeMeeting(config, account.id, body);
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
    if (action === 'delete_leadership_item') {
      await deleteLeadershipItem(config, account.id, body);
      return json(res, 200, { ok: true });
    }
    return json(res, 422, { error: 'Unknown Leadership action.', code: 'INVALID_ACTION' });
  } catch (error) {
    console.error('leadership API error', error);
    const status = [400, 401, 403, 404, 409, 422, 503].includes(error.status) ? error.status : 500;
    return json(res, status, {
      error: error.message || 'Leadership data could not be loaded or saved.',
      code: error.code || 'LEADERSHIP_API_ERROR'
    });
  }
}
