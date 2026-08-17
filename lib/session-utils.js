import crypto from 'node:crypto';

const clean = value => String(value ?? '').trim();
const b64url = value => Buffer.from(value).toString('base64url');
const fromB64url = value => Buffer.from(value, 'base64url').toString('utf8');

export function parseCookies(req) {
  const raw = String(req.headers?.cookie || '');
  return raw.split(';').reduce((out, pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return out;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
    return out;
  }, {});
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function signSession(payload, secret, ttlSeconds = 28800) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const encoded = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySession(token, secret) {
  const raw = clean(token);
  if (!raw || !secret || !raw.includes('.')) return null;
  const [encoded, sig] = raw.split('.', 2);
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(encoded));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function setSessionCookie(res, name, token, maxAge = 28800) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}

export function clearSessionCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return safeEqual(actual, expected);
}

export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(14);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export function accountSessionSecret() {
  return clean(process.env.ACCOUNT_SESSION_SECRET) || clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminSessionSecret() {
  return clean(process.env.ADMIN_SESSION_SECRET) || clean(process.env.ADMIN_PASSWORD);
}

export function requireAdmin(req) {
  const secret = adminSessionSecret();
  if (!secret) return null;
  const token = parseCookies(req).cc_admin_session;
  const payload = verifySession(token, secret);
  return payload?.role === 'admin' ? payload : null;
}
