import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
];

export function googleCalendarConfig() {
  const clientId = clean(process.env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecret = clean(process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  const redirectUri = clean(process.env.GOOGLE_CALENDAR_REDIRECT_URI);
  const encryptionSecret = clean(process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, scopes: SCOPES };
}

function cipherKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encryptGoogleCalendarToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptGoogleCalendarToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Google Calendar token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createGoogleCalendarAuthorizationUrl(accountId) {
  const config = googleCalendarConfig();
  if (!config) throw new Error('Google Calendar is not configured.');
  const state = signSession({ purpose: 'google-calendar-oauth', accountId }, accountSessionSecret(), 10 * 60);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function verifyGoogleCalendarOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'google-calendar-oauth' && payload?.accountId === accountId);
}

async function tokenRequest(body) {
  const config = googleCalendarConfig();
  if (!config) throw new Error('Google Calendar is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || 'Google Calendar token request failed.');
    error.status = response.status;
    error.code = payload?.error || 'GOOGLE_CALENDAR_TOKEN_ERROR';
    throw error;
  }
  return payload;
}

export function exchangeGoogleCalendarCode(code) {
  const config = googleCalendarConfig();
  return tokenRequest({ grant_type: 'authorization_code', code: clean(code), redirect_uri: config.redirectUri });
}

export function refreshGoogleCalendarTokens(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function revokeGoogleCalendarToken(token) {
  if (!token) return false;
  const response = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).catch(() => null);
  return Boolean(response?.ok);
}

async function apiRequest({ accessToken, path, method = 'GET', query, body }) {
  const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${CALENDAR_API}${path}${suffix}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error_description || 'Google Calendar API request failed.';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function listGoogleCalendars({ accessToken }) {
  const payload = await apiRequest({ accessToken, path: '/users/me/calendarList', query: { maxResults: '250', minAccessRole: 'reader' } });
  return (payload?.items || []).filter(item => !item.deleted).map(item => ({
    id: item.id,
    summary: item.summaryOverride || item.summary || item.id,
    primary: Boolean(item.primary),
    accessRole: item.accessRole || '',
    timeZone: item.timeZone || '',
    backgroundColor: item.backgroundColor || ''
  }));
}

export async function listGoogleCalendarEvents({ accessToken, calendarId = 'primary', maxResults = 20, timeMin, timeMax }) {
  const query = {
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(Math.max(1, Math.min(100, Number(maxResults) || 20))),
    timeMin: timeMin || new Date().toISOString()
  };
  if (timeMax) query.timeMax = timeMax;
  const payload = await apiRequest({ accessToken, path: `/calendars/${encodeURIComponent(calendarId)}/events`, query });
  return (payload?.items || []).map(event => ({
    id: event.id,
    status: event.status,
    summary: event.summary || '(No title)',
    description: event.description || '',
    location: event.location || '',
    htmlLink: event.htmlLink || '',
    start: event.start || {},
    end: event.end || {},
    attendees: (event.attendees || []).map(a => ({ email: a.email, responseStatus: a.responseStatus || '' })),
    organizer: event.organizer || {},
    creator: event.creator || {},
    updated: event.updated || null
  }));
}

function normalizeEventPayload(input = {}) {
  const summary = clean(input.summary);
  if (!summary) throw Object.assign(new Error('Event title is required.'), { status: 422 });
  const allDay = Boolean(input.allDay);
  const timeZone = clean(input.timeZone) || 'UTC';
  let start, end;
  if (allDay) {
    const startDate = clean(input.startDate || input.start);
    const endDate = clean(input.endDate || input.end);
    if (!startDate || !endDate) throw Object.assign(new Error('Start and end dates are required.'), { status: 422 });
    start = { date: startDate };
    end = { date: endDate };
  } else {
    const startDateTime = clean(input.startDateTime || input.start);
    const endDateTime = clean(input.endDateTime || input.end);
    if (!startDateTime || !endDateTime) throw Object.assign(new Error('Start and end times are required.'), { status: 422 });
    const normalizeDateTime = value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
    start = { dateTime: normalizeDateTime(startDateTime), timeZone };
    end = { dateTime: normalizeDateTime(endDateTime), timeZone };
  }
  const attendees = Array.isArray(input.attendees)
    ? input.attendees.map(value => typeof value === 'string' ? { email: clean(value) } : { email: clean(value?.email) }).filter(a => a.email)
    : clean(input.attendees).split(',').map(email => ({ email: clean(email) })).filter(a => a.email);
  return {
    summary,
    description: clean(input.description),
    location: clean(input.location),
    start,
    end,
    attendees
  };
}

export async function createGoogleCalendarEvent({ accessToken, calendarId = 'primary', event }) {
  return apiRequest({ accessToken, path: `/calendars/${encodeURIComponent(calendarId)}/events`, method: 'POST', query: { sendUpdates: 'all' }, body: normalizeEventPayload(event) });
}

export async function updateGoogleCalendarEvent({ accessToken, calendarId = 'primary', eventId, event }) {
  if (!clean(eventId)) throw Object.assign(new Error('Event ID is required.'), { status: 422 });
  return apiRequest({ accessToken, path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, method: 'PATCH', query: { sendUpdates: 'all' }, body: normalizeEventPayload(event) });
}

export async function deleteGoogleCalendarEvent({ accessToken, calendarId = 'primary', eventId }) {
  if (!clean(eventId)) throw Object.assign(new Error('Event ID is required.'), { status: 422 });
  await apiRequest({ accessToken, path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, method: 'DELETE', query: { sendUpdates: 'all' } });
  return true;
}
