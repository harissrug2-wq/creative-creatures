import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const AUTH_URL = 'https://auth.atlassian.com/authorize';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ACCESSIBLE_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';
const API_BASE = 'https://api.atlassian.com/ex/jira';
const SCOPES = ['read:jira-work', 'read:jira-user', 'read:me', 'offline_access'];

export function jiraConfig() {
  const clientId = clean(process.env.JIRA_CLIENT_ID);
  const clientSecret = clean(process.env.JIRA_CLIENT_SECRET);
  const redirectUri = clean(process.env.JIRA_REDIRECT_URI);
  const encryptionSecret = clean(process.env.JIRA_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, scopes: SCOPES };
}

function cipherKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encryptJiraToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptJiraToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Jira token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createJiraAuthorizationUrl(accountId) {
  const c = jiraConfig();
  if (!c) throw new Error('Jira is not configured.');
  const state = signSession({ purpose: 'jira-oauth', accountId }, accountSessionSecret(), 10 * 60);
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: c.clientId,
    scope: c.scopes.join(' '),
    redirect_uri: c.redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent'
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function verifyJiraOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'jira-oauth' && payload?.accountId === accountId);
}

export async function exchangeJiraCode(code) {
  const c = jiraConfig();
  if (!c) throw new Error('Jira is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code: clean(code),
      redirect_uri: c.redirectUri
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || 'Jira token exchange failed.');
    error.status = response.status || 400;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function refreshJiraTokens(refreshToken) {
  const c = jiraConfig();
  if (!c) throw new Error('Jira is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: clean(refreshToken)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || 'Jira token refresh failed.');
    error.status = response.status || 401;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function getJiraAccessibleResources(accessToken) {
  const response = await fetch(ACCESSIBLE_RESOURCES_URL, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ([]));
  if (!response.ok || !Array.isArray(payload)) {
    const error = new Error('Failed to fetch accessible Jira resources.');
    error.status = response.status || 400;
    throw error;
  }
  return payload.map(res => ({
    id: String(res.id || ''),
    name: res.name || 'Jira Workspace',
    url: res.url || '',
    scopes: Array.isArray(res.scopes) ? res.scopes : [],
    avatarUrl: res.avatarUrl || ''
  })).filter(r => r.id);
}

async function jiraJson(path, { accessToken, cloudId, query, method = 'GET', body } = {}) {
  const prefix = cloudId ? `${API_BASE}/${encodeURIComponent(cloudId)}/rest/api/3` : API_BASE;
  const url = new URL(`${prefix}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.errorMessages?.join(', ') || payload?.message || payload?.error || 'Jira API request failed.');
    error.status = response.status || 400;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function listJiraProjects(accessToken, cloudId) {
  const p = await jiraJson('/project/search', { accessToken, cloudId, query: { maxResults: 100 } });
  const values = Array.isArray(p.values) ? p.values : (Array.isArray(p) ? p : []);
  return values.map(pr => ({
    id: String(pr.id || ''),
    key: pr.key || '',
    name: pr.name || 'Project',
    projectTypeKey: pr.projectTypeKey || 'software',
    simplified: Boolean(pr.simplified),
    avatarUrl: pr.avatarUrls?.['48x48'] || pr.avatarUrls?.['32x32'] || ''
  })).filter(pr => pr.id);
}

export async function listJiraIssues(accessToken, cloudId, { maxResults = 100 } = {}) {
  const p = await jiraJson('/search', { accessToken, cloudId, query: { maxResults: Math.min(maxResults, 100), jql: 'order by created DESC' } });
  const issues = Array.isArray(p.issues) ? p.issues : [];
  return issues.map(issue => ({
    id: String(issue.id || ''),
    key: issue.key || '',
    summary: issue.fields?.summary || 'Untitled Issue',
    status: issue.fields?.status?.name || '',
    statusCategory: issue.fields?.status?.statusCategory?.name || '',
    issueType: issue.fields?.issuetype?.name || '',
    priority: issue.fields?.priority?.name || 'Medium',
    assignee: issue.fields?.assignee?.displayName || issue.fields?.assignee?.emailAddress || 'Unassigned',
    creator: issue.fields?.creator?.displayName || '',
    created: issue.fields?.created || null,
    updated: issue.fields?.updated || null,
    projectKey: issue.fields?.project?.key || '',
    projectName: issue.fields?.project?.name || ''
  })).filter(i => i.id);
}

export async function listJiraUsers(accessToken, cloudId) {
  const users = await jiraJson('/users/search', { accessToken, cloudId, query: { maxResults: 100 } });
  const list = Array.isArray(users) ? users : [];
  return list.map(u => ({
    accountId: String(u.accountId || ''),
    displayName: u.displayName || u.emailAddress || 'User',
    emailAddress: u.emailAddress || '',
    active: Boolean(u.active),
    accountType: u.accountType || 'atlassian',
    avatarUrl: u.avatarUrls?.['48x48'] || u.avatarUrls?.['32x32'] || ''
  })).filter(u => u.accountId);
}

export async function getJiraMyself(accessToken, cloudId) {
  const me = await jiraJson('/myself', { accessToken, cloudId });
  return {
    accountId: String(me.accountId || ''),
    displayName: me.displayName || me.emailAddress || 'User',
    emailAddress: me.emailAddress || '',
    active: Boolean(me.active),
    timeZone: me.timeZone || ''
  };
}
