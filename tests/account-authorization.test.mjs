import test from 'node:test';
import assert from 'node:assert/strict';
import goals from '../api/goals.js';
import scorecard from '../api/scorecard.js';
import accountAuth from '../api/account-auth.js';
import { signSession } from '../lib/session-utils.js';

process.env.ACCOUNT_SESSION_SECRET = 'local-authorization-regression-test-only';
process.env.SUPABASE_URL = 'https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-test-key';
const token = (extra = {}, ttl = 300) => signSession({ role: 'account', accountId: 'agency-a', ...extra }, process.env.ACCOUNT_SESSION_SECRET, ttl);

async function request(handler, { cookie = token(), method = 'GET', query = {}, body = {}, member = 'active', missing = false, headers = {} } = {}) {
  const calls = [];
  const oldFetch = globalThis.fetch, oldError = console.error;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, ...options });
    let payload = [];
    if (parsed.pathname.endsWith('/accounts')) payload = missing ? [] : [{ id: 'agency-a', diagnostic_state: {} }];
    if (parsed.pathname.endsWith('/account_members')) payload = member === null ? [] : [{ id: 'member-a', status: member }];
    if (parsed.pathname.endsWith('/department_goals')) payload = [JSON.parse(options.body)];
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  console.error = () => {};
  const response = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
  try {
    await handler({ method, query, body, headers: { ...(cookie === null ? {} : { cookie: `cc_account_session=${cookie}` }), ...headers } }, response);
  } finally { globalThis.fetch = oldFetch; console.error = oldError; }
  return { ...response, calls };
}

for (const [name, handler] of [['goals', goals], ['scorecard', scorecard]]) {
  for (const method of ['GET', 'POST']) {
    for (const [label, cookie] of [
      ['missing', null], ['tampered', token() + 'x'], ['expired', token({}, -1)],
      ['wrong role', token({ role: 'admin' })], ['malformed encoding', '%ZZ'],
      ['extra token segment', token() + '.extra']
    ]) test(`${name} ${method}: ${label} session denied before database access`, async () => {
      const r = await request(handler, { method, cookie });
      assert.equal(r.statusCode, 401); assert.equal(r.calls.length, 0);
      assert.equal(r.headers['Cache-Control'], 'no-store');
      assert.equal(r.headers['Access-Control-Allow-Origin'], undefined);
    });
    for (const key of ['accountId', 'account_id']) test(`${name} ${method}: rejects other account via ${key}`, async () => {
      const r = await request(handler, { method, [method === 'GET' ? 'query' : 'body']: { [key]: 'agency-b' } });
      assert.equal(r.statusCode, 403); assert.equal(r.calls.length, 0);
    });
  }
  test(`${name}: email and URL cannot select another agency`, async () => {
    const r = await request(handler, { query: { email: 'b@example.invalid', agencyUrl: 'other.invalid' } });
    assert.equal(r.statusCode, name === 'goals' ? 409 : 404);
    assert.equal(r.calls[0].url.searchParams.get('id'), 'eq.agency-a');
    assert.equal(r.calls[1].url.searchParams.get('account_id'), 'eq.agency-a');
    assert.ok(r.calls.every(c => !c.url.searchParams.has('email_normalized') && !c.url.searchParams.has('agency_url_normalized')));
  });
  for (const member of ['disabled', null]) test(`${name}: revoked or missing membership denied`, async () => {
    const r = await request(handler, { cookie: token({ memberId: 'member-a' }), member });
    assert.equal(r.statusCode, 401); assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url.searchParams.get('account_id'), 'eq.agency-a');
  });
  test(`${name}: active member uses its signed account`, async () => {
    const r = await request(handler, { cookie: token({ memberId: 'member-a' }) });
    assert.equal(r.statusCode, name === 'goals' ? 409 : 404);
    assert.equal(r.calls[1].url.searchParams.get('id'), 'eq.agency-a');
  });
  test(`${name}: deleted account denied`, async () => {
    assert.equal((await request(handler, { missing: true })).statusCode, 401);
  });
  test(`${name}: cross-site browser request denied`, async () => {
    const r = await request(handler, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(r.statusCode, 403); assert.equal(r.calls.length, 0);
  });
}

test('goals: legitimate write persists only the signed account ID', async () => {
  const r = await request(goals, { method: 'POST', body: { action: 'save_department', department: 'Leadership', goal: 'Improve delivery', email: 'other@example.invalid' } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.data.department.account_id, 'agency-a');
  assert.equal(JSON.parse(r.calls[1].body).account_id, 'agency-a');
});

test('goals: member restricted to assigned department when saving department goal', async () => {
  const calls = [];
  const oldFetch = globalThis.fetch, oldError = console.error;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, ...options });
    if (parsed.pathname.endsWith('/account_members')) {
      return new Response(JSON.stringify([{ id: 'member-a', status: 'active', departments: ['marketing'] }]), { status: 200 });
    }
    if (parsed.pathname.endsWith('/accounts')) {
      return new Response(JSON.stringify([{ id: 'agency-a', diagnostic_state: {} }]), { status: 200 });
    }
    if (parsed.pathname.endsWith('/department_goals')) {
      return new Response(JSON.stringify([JSON.parse(options.body || '{}')]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };
  console.error = () => {};
  try {
    const cookie = token({ memberId: 'member-a' });
    const denied = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await goals({ method: 'POST', body: { action: 'save_department', department: 'Leadership', goal: 'Denied' }, headers: { cookie: `cc_account_session=${cookie}` } }, denied);
    assert.equal(denied.statusCode, 403);

    const allowed = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await goals({ method: 'POST', body: { action: 'save_department', department: 'Marketing', goal: 'Allowed' }, headers: { cookie: `cc_account_session=${cookie}` } }, allowed);
    assert.equal(allowed.statusCode, 200);
  } finally {
    globalThis.fetch = oldFetch;
    console.error = oldError;
  }
});

test('account-auth: workspace_invite_user enforced for owner entitlement and member restriction', async () => {
  const calls = [];
  const oldFetch = globalThis.fetch, oldError = console.error;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ url: parsed, ...options });
    if (parsed.pathname.endsWith('/accounts')) {
      return new Response(JSON.stringify([{ id: 'agency-a', access_plan: 'platform', name: 'Agency A', email: 'owner@agency-a.com' }]), { status: 200 });
    }
    if (parsed.pathname.endsWith('/account_members')) {
      if (options.method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        return new Response(JSON.stringify([{ id: 'member-b', name: body.name, email: body.email, departments: body.departments, status: 'active' }]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: 'member-a', status: 'active', departments: ['marketing'] }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };
  console.error = () => {};
  try {
    // 1. Authorized Owner with platform access can invite user
    const ownerCookie = token();
    const ownerRes = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await accountAuth({
      method: 'POST',
      body: { action: 'workspace_invite_user', name: 'Alex Morgan', email: 'alex@agency-a.com', password: 'TemporaryPassword123!', departments: ['Marketing'] },
      headers: { cookie: `cc_account_session=${ownerCookie}` }
    }, ownerRes);
    assert.equal(ownerRes.statusCode, 200);
    assert.equal(ownerRes.data.success, true);
    assert.equal(typeof ownerRes.data.emailSent, 'boolean');
    assert.equal(ownerRes.data.user.email, 'alex@agency-a.com');

    // 2. Member session is denied workspace_invite_user (HTTP 403)
    const memberCookie = token({ memberId: 'member-a' });
    const memberRes = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await accountAuth({
      method: 'POST',
      body: { action: 'workspace_invite_user', name: 'Sam Taylor', email: 'sam@agency-a.com', password: 'TemporaryPassword123!', departments: ['Sales'] },
      headers: { cookie: `cc_account_session=${memberCookie}` }
    }, memberRes);
    assert.equal(memberRes.statusCode, 403);
  } finally {
    globalThis.fetch = oldFetch;
    console.error = oldError;
  }
});test('account-auth: request_integration action handles email sending and returns emailed status', async () => {
  const oldFetch = globalThis.fetch, oldError = console.error;
  let sentEmailPayload = null;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'api.resend.com') {
      sentEmailPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };
  console.error = () => {};
  try {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.RESEND_FROM_EMAIL = 'support@creativecreatures.org';
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await accountAuth({
      method: 'POST',
      body: { action: 'request_integration', integrationName: 'Salesforce', useCase: 'Sync CRM leads', category: 'CRM' },
      headers: {}
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.emailed, true);
    assert.equal(sentEmailPayload.to[0], 'creature@creativecreatures.org');
    assert.ok(sentEmailPayload.subject.includes('Salesforce'));
  } finally {
    globalThis.fetch = oldFetch;
    console.error = oldError;
  }
});

test('account-auth: ghl_connect and ghl_callback OAuth flow', async () => {
  process.env.GHL_CLIENT_ID = 'ghl_client_test';
  process.env.GHL_CLIENT_SECRET = 'ghl_secret_test';
  process.env.GHL_REDIRECT_URI = 'http://localhost:5173/integrations/ghl/callback/';
  const ownerCookie = token({ role: 'account', accountId: 'agency-a' });
  const oldFetch = globalThis.fetch, oldError = console.error;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/oauth/token')) {
      return new Response(JSON.stringify({
        access_token: 'ghl_at_123',
        refresh_token: 'ghl_rt_123',
        expires_in: 86400,
        locationId: 'loc_agency_a',
        userType: 'Location'
      }), { status: 200 });
    }
    if (parsed.pathname.includes('/locations/')) {
      return new Response(JSON.stringify({ location: { id: 'loc_agency_a', name: 'Test Agency Location', timezone: 'America/New_York' } }), { status: 200 });
    }
    if (parsed.pathname.includes('/ghl_connections')) {
      return new Response(JSON.stringify([{
        id: 'ghl_conn_123',
        account_id: 'agency-a',
        location_id: 'loc_agency_a',
        company_id: '',
        location_name: 'Test Agency Location',
        location_email: '',
        location_phone: '',
        timezone: 'America/New_York',
        currency: 'USD',
        country: 'US',
        user_id: '',
        user_type: 'Location',
        scopes: [],
        status: 'connected',
        last_synced_at: null,
        last_sync_error: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]), { status: 200 });
    }
    if (parsed.pathname.endsWith('/accounts')) {
      return new Response(JSON.stringify([{ id: 'agency-a', access_plan: 'platform', diagnostic_state: {} }]), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };
  console.error = () => {};
  try {
    // 1. ghl_connect returns authorizationUrl
    const connectRes = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await accountAuth({
      method: 'GET',
      query: { action: 'ghl_connect' },
      headers: { cookie: `cc_account_session=${ownerCookie}` }
    }, connectRes);
    assert.equal(connectRes.statusCode, 200);
    assert.ok(connectRes.data.authorizationUrl.includes('/oauth/chooselocation'));
    const urlObj = new URL(connectRes.data.authorizationUrl);
    const state = urlObj.searchParams.get('state');

    // 2. POST ghl_callback completes connection
    const callbackRes = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.data = JSON.parse(value); } };
    await accountAuth({
      method: 'POST',
      body: { action: 'ghl_callback', code: 'valid_code_123', state },
      headers: { cookie: `cc_account_session=${ownerCookie}` }
    }, callbackRes);
    assert.equal(callbackRes.statusCode, 200);
    assert.equal(callbackRes.data.connected, true);
    assert.equal(callbackRes.data.connection.locationId, 'loc_agency_a');
  } finally {
    globalThis.fetch = oldFetch;
    console.error = oldError;
  }
});

