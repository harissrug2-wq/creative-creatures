import {
  decryptGoogleCalendarToken,
  encryptGoogleCalendarToken,
  googleCalendarConfig,
  listGoogleCalendarEvents,
  refreshGoogleCalendarTokens
} from '../lib/google-calendar.js';

const clean = value => String(value ?? '').trim();
const eventTitlePattern = /(^|\b)(l\s*10|level\s*10|leadership)(\b|$)/i;
const leadershipPlans = new Set(['platform', 'fractional_coo']);

async function db(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.secret,
      Authorization: `Bearer ${config.secret}`,
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

function hasLeadership(account) {
  if (leadershipPlans.has(account?.access_plan)) return true;
  const purchased = Array.isArray(account?.diagnostic_state?.purchasedPlans)
    ? account.diagnostic_state.purchasedPlans
    : [];
  if (purchased.some(plan => leadershipPlans.has(plan))) return true;
  return account?.access_plan === 'accelerator'
    && account?.diagnostic_state?.acceleratorCompleted === true;
}

function eventDate(event) {
  const raw = clean(event?.start?.date || event?.start?.dateTime);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
}

function timestamp(value) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function googleMeetUrl(event) {
  const direct = clean(event?.hangoutLink);
  if (direct) return direct.slice(0, 2000);
  const entryPoints = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints
    : [];
  const video = entryPoints.find(entry => entry?.entryPointType === 'video');
  return clean(video?.uri).slice(0, 2000);
}

async function patchConnection(config, connection, patch) {
  const params = new URLSearchParams({ id: `eq.${connection.id}`, select: '*' });
  const rows = await db(config, `google_calendar_connections?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  return Array.isArray(rows) ? rows[0] || connection : connection;
}

async function calendarAccess(config, connection) {
  const google = googleCalendarConfig();
  if (!google) throw new Error('Google Calendar environment variables are incomplete.');
  const expiresAt = Date.parse(connection.access_token_expires_at || '');
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 120000) {
    return {
      connection,
      accessToken: decryptGoogleCalendarToken(connection.access_token_encrypted, google.encryptionSecret)
    };
  }
  if (!connection.refresh_token_encrypted) {
    throw new Error('Google Calendar access expired and no refresh token is available.');
  }
  const refreshToken = decryptGoogleCalendarToken(
    connection.refresh_token_encrypted,
    google.encryptionSecret
  );
  const tokens = await refreshGoogleCalendarTokens(refreshToken);
  const updated = await patchConnection(config, connection, {
    access_token_encrypted: encryptGoogleCalendarToken(tokens.access_token, google.encryptionSecret),
    refresh_token_encrypted: connection.refresh_token_encrypted,
    access_token_expires_at: new Date(
      Date.now() + (Number(tokens.expires_in) || 3600) * 1000
    ).toISOString(),
    scope: tokens.scope || connection.scope || google.scopes.join(' '),
    status: 'connected',
    last_error: null
  });
  return { connection: updated, accessToken: tokens.access_token };
}

async function accountForConnection(config, accountId) {
  const params = new URLSearchParams({
    select: 'id,access_plan,diagnostic_state',
    id: `eq.${accountId}`,
    limit: '1'
  });
  const rows = await db(config, `accounts?${params.toString()}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function defaultTeam(config, accountId) {
  const params = new URLSearchParams({
    select: 'id', account_id: `eq.${accountId}`, is_default: 'eq.true', limit: '1'
  });
  const existing = await db(config, `leadership_teams?${params.toString()}`);
  if (Array.isArray(existing) && existing[0]) return existing[0];
  try {
    const rows = await db(config, 'leadership_teams', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ account_id: accountId, name: 'Leadership Team', is_default: true })
    });
    if (Array.isArray(rows) && rows[0]) return rows[0];
  } catch (error) {
    if (error?.payload?.code !== '23505') throw error;
  }
  const rows = await db(config, `leadership_teams?${params.toString()}`);
  if (Array.isArray(rows) && rows[0]) return rows[0];
  throw new Error('The default Leadership team could not be created.');
}

async function syncEvent(config, connection, team, event) {
  const meetingDate = eventDate(event);
  if (!event?.id || !meetingDate) return 'skipped';
  const params = new URLSearchParams({
    select: 'id,source_updated_at,meeting_url',
    account_id: `eq.${connection.account_id}`,
    calendar_event_id: `eq.${event.id}`,
    limit: '1'
  });
  const existing = await db(config, `leadership_meetings?${params.toString()}`);
  const sourceUpdatedAt = timestamp(event.updated);
  const meetingUrl = googleMeetUrl(event);
  const record = {
    team_id: team.id,
    title: clean(event.summary).slice(0, 220) || `Weekly Leadership L10 — ${meetingDate}`,
    meeting_date: meetingDate,
    source: 'google_calendar',
    calendar_event_id: clean(event.id).slice(0, 500),
    calendar_html_url: clean(event.htmlLink).slice(0, 2000),
    meeting_url: meetingUrl,
    starts_at: timestamp(event.start?.dateTime),
    ends_at: timestamp(event.end?.dateTime),
    calendar_status: event.status === 'cancelled' ? 'cancelled' : 'scheduled',
    source_updated_at: sourceUpdatedAt,
    updated_at: new Date().toISOString()
  };
  if (Array.isArray(existing) && existing[0]) {
    const sameSource = existing[0].source_updated_at === sourceUpdatedAt;
    const sameMeetingUrl = clean(existing[0].meeting_url) === meetingUrl;
    if (sameSource && sameMeetingUrl) return 'unchanged';
    const updateParams = new URLSearchParams({ id: `eq.${existing[0].id}` });
    await db(config, `leadership_meetings?${updateParams.toString()}`, {
      method: 'PATCH', body: JSON.stringify(record)
    });
    return 'updated';
  }
  await db(config, 'leadership_meetings', {
    method: 'POST',
    body: JSON.stringify({
      account_id: connection.account_id,
      status: 'planned',
      agenda: {},
      ...record
    })
  });
  return 'created';
}

async function syncConnection(config, connection, range) {
  const account = await accountForConnection(config, connection.account_id);
  if (!account || !hasLeadership(account)) return { skippedPlan: 1 };
  try {
    const access = await calendarAccess(config, connection);
    const events = await listGoogleCalendarEvents({
      accessToken: access.accessToken,
      calendarId: access.connection.calendar_id || 'primary',
      maxResults: 100,
      timeMin: range.timeMin,
      timeMax: range.timeMax
    });
    const matches = events.filter(event => eventTitlePattern.test(clean(event?.summary)) && eventDate(event));
    const team = matches.length ? await defaultTeam(config, connection.account_id) : null;
    const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, matched: matches.length };
    for (const event of matches) {
      const result = await syncEvent(config, access.connection, team, event);
      counts[result] += 1;
    }
    await patchConnection(config, access.connection, { status: 'connected', last_error: null });
    return counts;
  } catch (error) {
    await patchConnection(config, connection, {
      status: 'error',
      last_error: clean(error?.message || 'Calendar sync failed.').slice(0, 1000)
    }).catch(() => null);
    throw error;
  }
}

export async function runLeadershipCalendarSync(config) {
  if (!config || !googleCalendarConfig()) {
    throw new Error('Calendar sync environment variables are incomplete.');
  }
  try {
    const connections = await db(
      config,
      'google_calendar_connections?select=*&status=in.(connected,error)&order=created_at.asc'
    );
    const now = new Date();
    const from = new Date(now);
    const to = new Date(now);
    from.setUTCDate(from.getUTCDate() - 30);
    to.setUTCDate(to.getUTCDate() + 180);
    const range = { timeMin: from.toISOString(), timeMax: to.toISOString() };
    const totals = {
      connections: Array.isArray(connections) ? connections.length : 0,
      succeeded: 0, failed: 0, skippedPlan: 0,
      matched: 0, created: 0, updated: 0, unchanged: 0, skipped: 0
    };
    const errors = [];
    for (const connection of connections || []) {
      try {
        const result = await syncConnection(config, connection, range);
        if (result.skippedPlan) {
          totals.skippedPlan += 1;
          continue;
        }
        totals.succeeded += 1;
        for (const key of ['matched', 'created', 'updated', 'unchanged', 'skipped']) {
          totals[key] += result[key] || 0;
        }
      } catch (error) {
        totals.failed += 1;
        errors.push({ accountId: connection.account_id, error: clean(error?.message).slice(0, 300) });
      }
    }
    return { ok: true, range, ...totals, errors };
  } catch (error) {
    console.error('Leadership calendar cron failed:', error);
    throw error;
  }
}
