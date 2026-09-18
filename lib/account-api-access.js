import { accountSessionSecret, parseCookies, verifySession } from './session-utils.js';

const deny = (status, code, message) => {
  throw Object.assign(new Error(message), { status, code });
};

// Identity comes exclusively from the signed, HttpOnly account-session cookie.
export function requireAccountSession(req) {
  let session;
  try {
    const token = parseCookies(req).cc_account_session;
    if (typeof token !== 'string' || token.split('.').length !== 2) throw new Error('Invalid cookie');
    session = verifySession(token, accountSessionSecret());
  } catch { session = null; }
  if (session?.role !== 'account' || typeof session.accountId !== 'string' ||
      !session.accountId.trim() || !Number.isFinite(session.exp) ||
      session.exp <= Math.floor(Date.now() / 1000)) {
    deny(401, 'SIGN_IN_REQUIRED', 'Sign in to continue.');
  }
  // Browser requests from another site must not reach account data or writes.
  if (req.headers?.['sec-fetch-site'] === 'cross-site') {
    deny(403, 'CROSS_SITE_REQUEST', 'Open this page from your Creative Creatures account.');
  }
  return session;
}

export async function authorizedAccount(req, body, session, config, db, select) {
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
