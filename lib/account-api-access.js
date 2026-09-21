import { accountSessionSecret, parseCookies, verifySession, requireAdmin } from './session-utils.js';

const deny = (status, code, message) => {
  throw Object.assign(new Error(message), { status, code });
};

// Identity comes from signed account-session cookie or admin session.
export function requireAccountSession(req) {
  let session = null;
  try {
    const token = parseCookies(req).cc_account_session;
    if (typeof token === 'string' && token.split('.').length === 2) {
      session = verifySession(token, accountSessionSecret());
    }
  } catch { session = null; }

  if (session?.role === 'account' && typeof session.accountId === 'string' &&
      session.accountId.trim() && Number.isFinite(session.exp) &&
      session.exp > Math.floor(Date.now() / 1000)) {
    if (req.headers?.['sec-fetch-site'] === 'cross-site') {
      deny(403, 'CROSS_SITE_REQUEST', 'Open this page from your Creative Creatures account.');
    }
    return session;
  }

  let admin = null;
  try { admin = requireAdmin(req); } catch {}
  if (admin) {
    const targetAccountId = String(req.query?.accountId || req.query?.tenant || req.query?.account_id || '').trim();
    return { role: 'admin', accountId: targetAccountId, isAdmin: true, username: admin.username };
  }

  deny(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
}

export async function authorizedAccount(req, body, session, config, db, select) {
  if (session?.role === 'admin' || session?.isAdmin) {
    const targetId = String(req.query?.accountId || req.query?.tenant || body?.accountId || body?.tenant || session.accountId || '').trim();
    if (targetId) {
      const params = new URLSearchParams({ select, id: `eq.${targetId}`, limit: '1' });
      const rows = await db(config, `accounts?${params}`);
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
    const params = new URLSearchParams({ select, order: 'created_at.desc', limit: '1' });
    const rows = await db(config, `accounts?${params}`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
    deny(404, 'ACCOUNT_NOT_FOUND', 'No account found for admin view.');
  }

  // Retain compatibility with existing clients, but reject conflicting IDs.
  // Emails and agency URLs are never used as account selectors.
  for (const input of [req.query || {}, body || {}]) {
    for (const key of ['accountId', 'account_id']) {
      if (input[key] !== undefined && input[key] !== session.accountId) {
        deny(403, 'ACCOUNT_ACCESS_DENIED', 'You cannot access another agency account.');
      }
    }
  }
  if (session.memberId) {
    const params = new URLSearchParams({
      select: 'id,status', id: `eq.${session.memberId}`,
      account_id: `eq.${session.accountId}`, limit: '1'
    });
    const rows = await db(config, `account_members?${params}`);
    if (!Array.isArray(rows) || rows[0]?.status !== 'active') {
      deny(401, 'ACCOUNT_ACCESS_REVOKED', 'Your account access is no longer active.');
    }
  }
  const params = new URLSearchParams({ select, id: `eq.${session.accountId}`, limit: '1' });
  const rows = await db(config, `accounts?${params}`);
  if (!Array.isArray(rows) || !rows[0]) {
    deny(401, 'ACCOUNT_ACCESS_REVOKED', 'Your account access is no longer active.');
  }
  return rows[0];
}
