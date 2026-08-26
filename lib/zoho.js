import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const DEFAULT_ACCOUNTS_URL = 'https://accounts.zoho.com';
const SCOPES = [
  'ZohoCRM.modules.contacts.ALL',
  'ZohoCRM.modules.accounts.ALL',
  'ZohoCRM.modules.deals.ALL',
  'ZohoCRM.settings.layouts.READ',
  'ZohoCRM.settings.pipeline.READ',
  'ZohoCRM.org.READ'
];
const ACCOUNT_HOSTS = new Set([
  'accounts.zoho.com', 'accounts.zoho.com.au', 'accounts.zoho.eu', 'accounts.zoho.in',
  'accounts.zoho.com.cn', 'accounts.zoho.jp', 'accounts.zoho.sa', 'accounts.zohocloud.ca'
]);
const API_HOST = /^(?:www|sandbox|developer)\.zohoapis\.(?:com|com\.au|eu|in|com\.cn|jp|sa|ca)$/;

function validatedBase(value, kind) {
  let url;
  try { url = new URL(clean(value)); } catch { throw Object.assign(new Error(`Zoho ${kind} URL is invalid.`), { status: 422 }); }
  const validHost = kind === 'accounts server' ? ACCOUNT_HOSTS.has(url.hostname) : API_HOST.test(url.hostname);
  if (url.protocol !== 'https:' || !validHost || (url.pathname !== '/' && url.pathname !== '')) {
    throw Object.assign(new Error(`Zoho ${kind} URL is not trusted.`), { status: 422 });
  }
  return url.origin;
}

export function zohoConfig() {
  const clientId = clean(process.env.ZOHO_CLIENT_ID);
  const clientSecret = clean(process.env.ZOHO_CLIENT_SECRET);
  const redirectUri = clean(process.env.ZOHO_REDIRECT_URI);
  const encryptionSecret = clean(process.env.ZOHO_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  let accountsUrl;
  try { accountsUrl = validatedBase(clean(process.env.ZOHO_ACCOUNTS_URL) || DEFAULT_ACCOUNTS_URL, 'accounts server'); } catch { return null; }
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, accountsUrl, scopes: SCOPES };
}

function cipherKey(secret) { return crypto.createHash('sha256').update(String(secret)).digest(); }

export function encryptZohoToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptZohoToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Zoho CRM token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createZohoAuthorizationUrl(accountId) {
  const config = zohoConfig();
  if (!config) throw new Error('Zoho CRM is not configured.');
  const state = signSession({ purpose: 'zoho-crm-oauth', accountId }, accountSessionSecret(), 10 * 60);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: config.scopes.join(','),
    state
  });
  return `${config.accountsUrl}/oauth/v2/auth?${params.toString()}`;
}

export function verifyZohoOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'zoho-crm-oauth' && payload?.accountId === accountId);
}

async function tokenRequest(accountsServer, values) {
  const base = validatedBase(accountsServer, 'accounts server');
  const response = await fetch(`${base}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(values).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.message || payload?.error || 'Zoho CRM OAuth request failed.');
    error.status = response.status || 502;
    error.code = payload?.error || 'ZOHO_OAUTH_ERROR';
    throw error;
  }
  payload.api_domain = validatedBase(payload.api_domain, 'API domain');
  return payload;
}

export function exchangeZohoCode(code, accountsServer) {
  const config = zohoConfig();
  if (!config) throw new Error('Zoho CRM is not configured.');
  return tokenRequest(accountsServer, {
    grant_type: 'authorization_code', code: clean(code), client_id: config.clientId,
    client_secret: config.clientSecret, redirect_uri: config.redirectUri
  });
}

export function refreshZohoTokens(refreshToken, accountsServer) {
  const config = zohoConfig();
  if (!config) throw new Error('Zoho CRM is not configured.');
  return tokenRequest(accountsServer, {
    grant_type: 'refresh_token', refresh_token: clean(refreshToken),
    client_id: config.clientId, client_secret: config.clientSecret
  });
}

export async function revokeZohoRefreshToken(refreshToken, accountsServer) {
  const token = clean(refreshToken);
  if (!token) return false;
  try {
    const base = validatedBase(accountsServer, 'accounts server');
    const response = await fetch(`${base}/oauth/v2/token/revoke?${new URLSearchParams({ token }).toString()}`, { method:'POST', headers:{ Accept:'application/json' } });
    return response.ok;
  } catch { return false; }
}

async function apiRequest({ accessToken, apiDomain, path, query, method = 'GET', body }) {
  const base = validatedBase(apiDomain, 'API domain');
  const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${base}${path}${suffix}`, {
    method,
    headers: { Accept: 'application/json', Authorization: `Zoho-oauthtoken ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok || payload?.status === 'error' || payload?.code === 'INVALID_TOKEN') {
    const detail = payload?.details?.api_name || payload?.details?.field || payload?.details?.id;
    const error = new Error([payload?.message || payload?.code || 'Zoho CRM API request failed.', detail].filter(Boolean).join(' '));
    error.status = response.status || 502;
    error.code = payload?.code || 'ZOHO_API_ERROR';
    throw error;
  }
  return payload;
}

const recordId = value => {
  const id = clean(value);
  if (!/^\d+$/.test(id)) throw Object.assign(new Error('Zoho CRM record ID is invalid.'), { status: 422 });
  return id;
};
const lookupName = value => value && typeof value === 'object' ? clean(value.name || value.display_value) : clean(value);
const isoDate = value => clean(value) || null;
const normalized = (item, properties) => ({
  id: clean(item?.id), properties, createdAt: isoDate(item?.Created_Time), updatedAt: isoDate(item?.Modified_Time), archived: false
});

const CONTACT_FIELDS = ['First_Name','Last_Name','Email','Phone','Account_Name','Title','Lead_Source','Created_Time','Modified_Time'];
const ACCOUNT_FIELDS = ['Account_Name','Website','Phone','Industry','Billing_City','Billing_State','Billing_Country','Employees','Annual_Revenue','Created_Time','Modified_Time'];
const DEAL_FIELDS = ['Deal_Name','Amount','Stage','Pipeline','Closing_Date','Created_Time','Modified_Time'];

function contactRecord(item) {
  return normalized(item, { firstname:item?.First_Name??null, lastname:item?.Last_Name??null, email:item?.Email??null, phone:item?.Phone??null, company:lookupName(item?.Account_Name)||null, jobtitle:item?.Title??null, leadsource:item?.Lead_Source??null, lifecyclestage:null, createdate:item?.Created_Time??null, lastmodifieddate:item?.Modified_Time??null });
}
function accountRecord(item) {
  let domain = clean(item?.Website);
  try { domain = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`).hostname; } catch {}
  return normalized(item, { name:item?.Account_Name??null, domain:domain||null, phone:item?.Phone??null, industry:item?.Industry??null, city:item?.Billing_City??null, state:item?.Billing_State??null, country:item?.Billing_Country??null, numberofemployees:item?.Employees??null, annualrevenue:item?.Annual_Revenue??null, lifecyclestage:null, createdate:item?.Created_Time??null, hs_lastmodifieddate:item?.Modified_Time??null });
}
function dealRecord(item) {
  return normalized(item, { dealname:item?.Deal_Name??null, amount:item?.Amount??null, dealstage:clean(item?.Stage)||null, pipeline:clean(item?.Pipeline)||null, closedate:item?.Closing_Date??null, createdate:item?.Created_Time??null, hs_lastmodifieddate:item?.Modified_Time??null });
}

async function listRecords({ accessToken, apiDomain, module, fields, limit, mapper }) {
  const payload = await apiRequest({ accessToken, apiDomain, path:`/crm/v8/${module}`, query:{ fields:fields.join(','), per_page:String(Math.min(Math.max(Number(limit)||50,1),200)), page:'1' } });
  return (payload?.data || []).map(mapper).filter(item => item.id);
}
export const listZohoContacts = options => listRecords({ ...options, module:'Contacts', fields:CONTACT_FIELDS, mapper:contactRecord });
export const listZohoAccounts = options => listRecords({ ...options, module:'Accounts', fields:ACCOUNT_FIELDS, mapper:accountRecord });
export const listZohoDeals = options => listRecords({ ...options, module:'Deals', fields:DEAL_FIELDS, mapper:dealRecord });

function pickValues(field) { return Array.isArray(field?.pick_list_values) ? field.pick_list_values : []; }
export async function listZohoDealPipelines({ accessToken, apiDomain }) {
  const payload = await apiRequest({ accessToken, apiDomain, path:'/crm/v8/settings/layouts', query:{ module:'Deals' } });
  const fields = (payload?.layouts || []).flatMap(layout => (layout?.sections || []).flatMap(section => section?.fields || []));
  const pipelineField = fields.find(field => field?.api_name === 'Pipeline');
  const stageField = fields.find(field => field?.api_name === 'Stage');
  if (pipelineField) {
    return pickValues(pipelineField).map((pipeline,index) => ({
      id: clean(pipeline.actual_value || pipeline.id || pipeline.display_value),
      label: clean(pipeline.display_value || pipeline.actual_value || pipeline.id),
      displayOrder: index, archived:false,
      stages:(pipeline.maps || []).map((stage,stageIndex)=>({ id:clean(stage.actual_value || stage.id || stage.display_value), label:clean(stage.display_value || stage.actual_value || stage.id), displayOrder:stageIndex, metadata:{}, archived:false }))
    })).filter(pipeline => pipeline.id);
  }
  const stages = pickValues(stageField).map((stage,index)=>({ id:clean(stage.actual_value || stage.id || stage.display_value), label:clean(stage.display_value || stage.actual_value || stage.id), displayOrder:index, metadata:{}, archived:false })).filter(stage=>stage.id);
  return stages.length ? [{ id:'', label:'Standard', displayOrder:0, archived:false, stages }] : [];
}

export function getZohoOrganization({ accessToken, apiDomain }) {
  return apiRequest({ accessToken, apiDomain, path:'/crm/v8/org' }).then(payload => payload?.org?.[0] || {});
}

async function getRecord({ accessToken, apiDomain, module, id, fields, mapper }) {
  const payload = await apiRequest({ accessToken, apiDomain, path:`/crm/v8/${module}/${recordId(id)}`, query:{ fields:fields.join(',') } });
  const item = payload?.data?.[0];
  if (!item) throw Object.assign(new Error('Zoho CRM did not return the saved record.'), { status: 502 });
  return mapper(item);
}
async function saveRecord({ accessToken, apiDomain, module, id, data, fields, mapper }) {
  const currentId = clean(id);
  const payload = await apiRequest({ accessToken, apiDomain, path:currentId?`/crm/v8/${module}/${recordId(currentId)}`:`/crm/v8/${module}`, method:currentId?'PUT':'POST', body:{data:[data]} });
  const result = payload?.data?.[0] || {};
  if (result.status === 'error' || (result.code && result.code !== 'SUCCESS')) throw Object.assign(new Error(result.message || result.code || 'Zoho CRM could not save the record.'), { status:422, code:result.code });
  const savedId = currentId || clean(result?.details?.id);
  return getRecord({ accessToken, apiDomain, module, id:savedId, fields, mapper });
}
async function deleteRecord({ accessToken, apiDomain, module, id }) {
  const payload = await apiRequest({ accessToken, apiDomain, path:`/crm/v8/${module}/${recordId(id)}`, method:'DELETE' });
  const result = payload?.data?.[0] || {};
  if (result.status === 'error' || (result.code && result.code !== 'SUCCESS')) throw Object.assign(new Error(result.message || result.code || 'Zoho CRM could not archive the record.'), { status:422, code:result.code });
  return true;
}

export const saveZohoContact = options => saveRecord({ ...options, module:'Contacts', fields:CONTACT_FIELDS, mapper:contactRecord });
export const archiveZohoContact = options => deleteRecord({ ...options, module:'Contacts' });
export const saveZohoAccount = options => saveRecord({ ...options, module:'Accounts', fields:ACCOUNT_FIELDS, mapper:accountRecord });
export const archiveZohoAccount = options => deleteRecord({ ...options, module:'Accounts' });
export const saveZohoDeal = options => saveRecord({ ...options, module:'Deals', fields:DEAL_FIELDS, mapper:dealRecord });
export const archiveZohoDeal = options => deleteRecord({ ...options, module:'Deals' });
