import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CHAT_API = 'https://chat.googleapis.com/v1';

export const GOOGLE_CHAT_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.messages.create'
];

const IDENTITY_SCOPES = ['openid', 'email', 'profile'];

export function googleChatConfig() {
  const clientId = clean(process.env.GOOGLE_CHAT_CLIENT_ID);
  const clientSecret = clean(process.env.GOOGLE_CHAT_CLIENT_SECRET);
  const redirectUri = clean(process.env.GOOGLE_CHAT_REDIRECT_URI);
  const encryptionSecret = clean(process.env.GOOGLE_CHAT_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, scopes: [...IDENTITY_SCOPES, ...GOOGLE_CHAT_REQUIRED_SCOPES] };
}

function cipherKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encryptGoogleChatToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptGoogleChatToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Google Chat token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createGoogleChatAuthorizationUrl(accountId) {
  const config = googleChatConfig();
  if (!config) throw new Error('Google Chat is not configured.');
  const state = signSession({ purpose:'google-chat-oauth', accountId }, accountSessionSecret(), 10 * 60);
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

export function verifyGoogleChatOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'google-chat-oauth' && payload?.accountId === accountId);
}

async function tokenRequest(body) {
  const config = googleChatConfig();
  if (!config) throw new Error('Google Chat is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id:config.clientId, client_secret:config.clientSecret, ...body }).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || 'Google Chat token request failed.');
    error.status = response.status;
    error.code = payload?.error || 'GOOGLE_CHAT_TOKEN_ERROR';
    throw error;
  }
  return payload;
}

export function exchangeGoogleChatCode(code) {
  const config = googleChatConfig();
  return tokenRequest({ grant_type:'authorization_code', code:clean(code), redirect_uri:config.redirectUri });
}

export function refreshGoogleChatTokens(refreshToken) {
  return tokenRequest({ grant_type:'refresh_token', refresh_token:clean(refreshToken) });
}

export async function revokeGoogleChatToken(token) {
  if (!token) return false;
  const response = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }
  }).catch(() => null);
  return Boolean(response?.ok);
}

async function jsonRequest(url, { accessToken, method='GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept:'application/json',
      Authorization:`Bearer ${accessToken}`,
      ...(body ? { 'Content-Type':'application/json' } : {})
    },
    ...(body ? { body:JSON.stringify(body) } : {})
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.error_description || 'Google Chat API request failed.');
    error.status = response.status;
    error.code = payload?.error?.status || 'GOOGLE_CHAT_API_ERROR';
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function getGoogleChatIdentity(accessToken) {
  const payload = await jsonRequest(USERINFO_URL, { accessToken });
  return {
    id: clean(payload?.sub),
    email: clean(payload?.email),
    name: clean(payload?.name),
    picture: clean(payload?.picture)
  };
}

function normalizeSpace(space = {}) {
  return {
    name: clean(space.name),
    displayName: clean(space.displayName) || (space.spaceType === 'DIRECT_MESSAGE' ? 'Direct message' : 'Unnamed space'),
    spaceType: clean(space.spaceType),
    type: clean(space.type),
    threadingState: clean(space.spaceThreadingState),
    historyState: clean(space.spaceHistoryState),
    externalUserAllowed: Boolean(space.externalUserAllowed),
    singleUserBotDm: Boolean(space.singleUserBotDm),
    memberCount: Number.isFinite(Number(space.membershipCount)) ? Number(space.membershipCount) : null,
    createTime: space.createTime || null,
    lastActiveTime: space.lastActiveTime || null
  };
}

function normalizeMember(membership = {}) {
  const member = membership.member || {};
  const groupMember = membership.groupMember || {};
  return {
    name: clean(membership.name),
    state: clean(membership.state),
    role: clean(membership.role),
    createTime: membership.createTime || null,
    deleteTime: membership.deleteTime || null,
    member: {
      name: clean(member.name || groupMember.name),
      displayName: clean(member.displayName || groupMember.displayName),
      type: clean(member.type || (groupMember.name ? 'GROUP' : '')),
      domainId: clean(member.domainId)
    }
  };
}

function validSpaceName(value) {
  const name = clean(value);
  if (!/^spaces\/[A-Za-z0-9_-]{1,220}$/.test(name)) {
    throw Object.assign(new Error('Google Chat space is invalid.'), { status:422 });
  }
  return name;
}

export async function listGoogleChatSpaces({ accessToken, limit=200 } = {}) {
  const target = Math.max(1, Math.min(500, Number(limit) || 200));
  const records = [];
  let pageToken = '';
  do {
    const url = new URL(`${CHAT_API}/spaces`);
    url.searchParams.set('pageSize', String(Math.min(1000, target - records.length)));
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await jsonRequest(url, { accessToken });
    records.push(...(payload?.spaces || []).map(normalizeSpace).filter(item => item.name));
    pageToken = clean(payload?.nextPageToken);
  } while (pageToken && records.length < target);
  return { records:records.slice(0, target), truncated:Boolean(pageToken) };
}

export async function listGoogleChatMembers({ accessToken, spaceName, limit=300 } = {}) {
  const parent = validSpaceName(spaceName);
  const target = Math.max(1, Math.min(500, Number(limit) || 300));
  const records = [];
  let pageToken = '';
  do {
    const url = new URL(`${CHAT_API}/${parent}/members`);
    url.searchParams.set('pageSize', String(Math.min(1000, target - records.length)));
    url.searchParams.set('showGroups', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const payload = await jsonRequest(url, { accessToken });
    records.push(...(payload?.memberships || []).map(normalizeMember));
    pageToken = clean(payload?.nextPageToken);
  } while (pageToken && records.length < target);
  return { records:records.slice(0, target), truncated:Boolean(pageToken) };
}

export async function sendGoogleChatMessage({ accessToken, spaceName, text } = {}) {
  const parent = validSpaceName(spaceName);
  const message = clean(text);
  if (!message) throw Object.assign(new Error('Enter a message.'), { status:422 });
  if (message.length > 4000) throw Object.assign(new Error('Google Chat messages are limited to 4,000 characters in Creative Creatures.'), { status:422 });
  const url = new URL(`${CHAT_API}/${parent}/messages`);
  url.searchParams.set('requestId', crypto.randomUUID());
  const payload = await jsonRequest(url, { accessToken, method:'POST', body:{ text:message } });
  return { name:clean(payload?.name), text:clean(payload?.text), createTime:payload?.createTime || null, threadName:clean(payload?.thread?.name), spaceName:parent };
}
