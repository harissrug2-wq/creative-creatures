import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const API_BASE = 'https://api.hubapi.com';
const TOKEN_URL = `${API_BASE}/oauth/2026-03/token`;
const INTROSPECT_URL = `${API_BASE}/oauth/2026-03/token/introspect`;
const REVOKE_URL = `${API_BASE}/oauth/2026-03/token/revoke`;
const SCOPES = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write'
];

export function hubSpotConfig() {
  const clientId = clean(process.env.HUBSPOT_CLIENT_ID);
  const clientSecret = clean(process.env.HUBSPOT_CLIENT_SECRET);
  const redirectUri = clean(process.env.HUBSPOT_REDIRECT_URI);
  const encryptionSecret = clean(process.env.HUBSPOT_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, scopes: SCOPES };
}

function cipherKey(secret) { return crypto.createHash('sha256').update(String(secret)).digest(); }

export function encryptHubSpotToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptHubSpotToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored HubSpot token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createHubSpotAuthorizationUrl(accountId) {
  const config = hubSpotConfig();
  if (!config) throw new Error('HubSpot is not configured.');
  const state = signSession({ purpose: 'hubspot-oauth', accountId }, accountSessionSecret(), 10 * 60);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function verifyHubSpotOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'hubspot-oauth' && payload?.accountId === accountId);
}

async function formRequest(url, values, { requireAccessToken = false } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(values).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (requireAccessToken && !payload?.access_token)) {
    const error = new Error(payload?.error_description || payload?.message || payload?.error || 'HubSpot OAuth request failed.');
    error.status = response.status;
    error.code = payload?.error || payload?.category || 'HUBSPOT_OAUTH_ERROR';
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function exchangeHubSpotCode(code) {
  const config = hubSpotConfig();
  if (!config) throw new Error('HubSpot is not configured.');
  return formRequest(TOKEN_URL, {
    grant_type: 'authorization_code',
    code: clean(code),
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret
  }, { requireAccessToken: true });
}

export function refreshHubSpotTokens(refreshToken) {
  const config = hubSpotConfig();
  if (!config) throw new Error('HubSpot is not configured.');
  return formRequest(TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: clean(refreshToken),
    client_id: config.clientId,
    client_secret: config.clientSecret
  }, { requireAccessToken: true });
}

export function introspectHubSpotToken(token, tokenTypeHint = 'access_token') {
  const config = hubSpotConfig();
  if (!config) throw new Error('HubSpot is not configured.');
  return formRequest(INTROSPECT_URL, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    token_type_hint: tokenTypeHint,
    token: clean(token)
  });
}

export async function revokeHubSpotToken(token, tokenTypeHint = 'refresh_token') {
  const config = hubSpotConfig();
  if (!config || !clean(token)) return false;
  try {
    await formRequest(REVOKE_URL, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      token_type_hint: tokenTypeHint,
      token: clean(token)
    });
    return true;
  } catch {
    return false;
  }
}

async function apiRequest({ accessToken, path, query, method = 'GET', body }) {
  const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${API_BASE}${path}${suffix}`, {
    method,
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || 'HubSpot API request failed.');
    error.status = response.status;
    error.code = payload?.category || 'HUBSPOT_API_ERROR';
    error.payload = payload;
    throw error;
  }
  return payload;
}

const objectId = value => {
  const id = clean(value);
  if (!/^\d+$/.test(id)) {
    const error = new Error('HubSpot record ID is invalid.');
    error.status = 422;
    throw error;
  }
  return id;
};

function recordResult(item, names) {
  return { id:item.id, properties:trimProperties(item.properties, names), createdAt:item.createdAt||null, updatedAt:item.updatedAt||null, archived:Boolean(item.archived) };
}

async function saveObject({ accessToken, objectType, id, properties, propertyNames }) {
  const recordId = clean(id);
  const payload = await apiRequest({
    accessToken,
    path: recordId ? `/crm/v3/objects/${objectType}/${objectId(recordId)}` : `/crm/v3/objects/${objectType}`,
    method: recordId ? 'PATCH' : 'POST',
    body: { properties }
  });
  return recordResult(payload, propertyNames);
}

async function archiveObject({ accessToken, objectType, id }) {
  await apiRequest({ accessToken, path: `/crm/v3/objects/${objectType}/${objectId(id)}`, method: 'DELETE' });
  return true;
}

export function getHubSpotAccountDetails({ accessToken }) {
  return apiRequest({ accessToken, path: '/account-info/2026-03/details' });
}

function trimProperties(properties = {}, names = []) {
  return Object.fromEntries(names.map(name => [name, properties?.[name] ?? null]));
}

export async function listHubSpotContacts({ accessToken, limit = 50 }) {
  const properties = ['firstname','lastname','email','phone','company','lifecyclestage','hs_lead_status','createdate','lastmodifieddate'];
  const payload = await apiRequest({ accessToken, path: '/crm/v3/objects/contacts', query: { limit: String(Math.min(Math.max(Number(limit)||50,1),100)), properties: properties.join(',') } });
  return (payload?.results || []).map(item => ({ id:item.id, properties:trimProperties(item.properties, properties), createdAt:item.createdAt||null, updatedAt:item.updatedAt||null, archived:Boolean(item.archived) }));
}

export async function listHubSpotCompanies({ accessToken, limit = 50 }) {
  const properties = ['name','domain','industry','city','state','country','numberofemployees','annualrevenue','lifecyclestage','createdate','hs_lastmodifieddate'];
  const payload = await apiRequest({ accessToken, path: '/crm/v3/objects/companies', query: { limit: String(Math.min(Math.max(Number(limit)||50,1),100)), properties: properties.join(',') } });
  return (payload?.results || []).map(item => ({ id:item.id, properties:trimProperties(item.properties, properties), createdAt:item.createdAt||null, updatedAt:item.updatedAt||null, archived:Boolean(item.archived) }));
}

export async function listHubSpotDeals({ accessToken, limit = 50 }) {
  const properties = ['dealname','amount','dealstage','pipeline','closedate','createdate','hs_lastmodifieddate'];
  const payload = await apiRequest({ accessToken, path: '/crm/v3/objects/deals', query: { limit: String(Math.min(Math.max(Number(limit)||50,1),100)), properties: properties.join(',') } });
  return (payload?.results || []).map(item => ({ id:item.id, properties:trimProperties(item.properties, properties), createdAt:item.createdAt||null, updatedAt:item.updatedAt||null, archived:Boolean(item.archived) }));
}

export async function listHubSpotDealPipelines({ accessToken }) {
  const payload = await apiRequest({ accessToken, path: '/crm/v3/pipelines/deals' });
  return (payload?.results || []).map(pipeline => ({
    id: pipeline.id,
    label: pipeline.label || pipeline.id,
    displayOrder: pipeline.displayOrder ?? null,
    archived: Boolean(pipeline.archived),
    stages: (pipeline.stages || []).map(stage => ({ id:stage.id, label:stage.label||stage.id, displayOrder:stage.displayOrder??null, metadata:stage.metadata||{}, archived:Boolean(stage.archived) }))
  }));
}

const CONTACT_PROPERTIES = ['firstname','lastname','email','phone','company','jobtitle','lifecyclestage'];
const COMPANY_PROPERTIES = ['name','domain','phone','city','state','country','industry','numberofemployees','annualrevenue'];
const DEAL_PROPERTIES = ['dealname','amount','dealstage','pipeline','closedate'];

export function saveHubSpotContact({ accessToken, id, properties }) {
  return saveObject({ accessToken, objectType:'contacts', id, properties, propertyNames:CONTACT_PROPERTIES });
}

export function archiveHubSpotContact({ accessToken, id }) {
  return archiveObject({ accessToken, objectType:'contacts', id });
}

export function saveHubSpotCompany({ accessToken, id, properties }) {
  return saveObject({ accessToken, objectType:'companies', id, properties, propertyNames:COMPANY_PROPERTIES });
}

export function archiveHubSpotCompany({ accessToken, id }) {
  return archiveObject({ accessToken, objectType:'companies', id });
}

export function saveHubSpotDeal({ accessToken, id, properties }) {
  return saveObject({ accessToken, objectType:'deals', id, properties, propertyNames:DEAL_PROPERTIES });
}

export function archiveHubSpotDeal({ accessToken, id }) {
  return archiveObject({ accessToken, objectType:'deals', id });
}
