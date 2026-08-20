import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export function googleDriveConfig() {
  const clientId = clean(process.env.GOOGLE_DRIVE_CLIENT_ID);
  const clientSecret = clean(process.env.GOOGLE_DRIVE_CLIENT_SECRET);
  const redirectUri = clean(process.env.GOOGLE_DRIVE_REDIRECT_URI);
  const encryptionSecret = clean(process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  const pickerApiKey = clean(process.env.GOOGLE_DRIVE_PICKER_API_KEY);
  const projectNumber = clean(process.env.GOOGLE_DRIVE_PROJECT_NUMBER);
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret || !pickerApiKey || !projectNumber) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, pickerApiKey, projectNumber, scopes: SCOPES };
}

function cipherKey(secret) { return crypto.createHash('sha256').update(String(secret)).digest(); }

export function encryptGoogleDriveToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptGoogleDriveToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored Google Drive token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createGoogleDriveAuthorizationUrl(accountId) {
  const config = googleDriveConfig();
  if (!config) throw new Error('Google Drive is not configured.');
  const state = signSession({ purpose: 'google-drive-oauth', accountId }, accountSessionSecret(), 10 * 60);
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

export function verifyGoogleDriveOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'google-drive-oauth' && payload?.accountId === accountId);
}

async function tokenRequest(body) {
  const config = googleDriveConfig();
  if (!config) throw new Error('Google Drive is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...body }).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || 'Google Drive token request failed.');
    error.status = response.status;
    error.code = payload?.error || 'GOOGLE_DRIVE_TOKEN_ERROR';
    throw error;
  }
  return payload;
}

export function exchangeGoogleDriveCode(code) {
  const config = googleDriveConfig();
  return tokenRequest({ grant_type: 'authorization_code', code: clean(code), redirect_uri: config.redirectUri });
}

export function refreshGoogleDriveTokens(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function revokeGoogleDriveToken(token) {
  if (!token) return false;
  const response = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => null);
  return Boolean(response?.ok);
}

async function apiRequest({ accessToken, path, query }) {
  const suffix = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${DRIVE_API}${path}${suffix}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Google Drive API request failed.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function getGoogleDriveAbout({ accessToken }) {
  const payload = await apiRequest({ accessToken, path: '/about', query: { fields: 'user(displayName,emailAddress,photoLink)' } });
  return { displayName: payload?.user?.displayName || '', email: payload?.user?.emailAddress || '', photoLink: payload?.user?.photoLink || '' };
}

const FILE_FIELDS = 'id,name,mimeType,modifiedTime,createdTime,size,webViewLink,iconLink,thumbnailLink,owners(displayName,emailAddress),parents,trashed';

export async function getGoogleDriveFile({ accessToken, fileId }) {
  if (!clean(fileId)) throw Object.assign(new Error('Google Drive file ID is required.'), { status: 422 });
  const file = await apiRequest({ accessToken, path: `/files/${encodeURIComponent(fileId)}`, query: { fields: FILE_FIELDS, supportsAllDrives: 'true' } });
  return normalizeDriveFile(file);
}

export async function getGoogleDriveFiles({ accessToken, fileIds = [] }) {
  const ids = [...new Set((Array.isArray(fileIds) ? fileIds : []).map(clean).filter(Boolean))].slice(0, 100);
  const settled = await Promise.allSettled(ids.map(fileId => getGoogleDriveFile({ accessToken, fileId })));
  return settled.flatMap((result, index) => result.status === 'fulfilled' ? [result.value] : [{ id: ids[index], unavailable: true, error: result.reason?.message || 'File unavailable' }]);
}

export function normalizeDriveFile(file = {}) {
  const owners = Array.isArray(file.owners) ? file.owners.map(owner => ({ displayName: owner.displayName || '', emailAddress: owner.emailAddress || '' })) : [];
  return {
    id: clean(file.id),
    name: clean(file.name) || 'Untitled',
    mimeType: clean(file.mimeType),
    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    modifiedTime: file.modifiedTime || null,
    createdTime: file.createdTime || null,
    size: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink || '',
    iconLink: file.iconLink || '',
    thumbnailLink: file.thumbnailLink || '',
    owners,
    parents: Array.isArray(file.parents) ? file.parents : [],
    trashed: Boolean(file.trashed)
  };
}
