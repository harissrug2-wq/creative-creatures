import crypto from 'node:crypto';
import { fail, clean, json, jsonBody, rawBody, verifyWebhook } from './stripe-billing.js';
import { accountSessionSecret, parseCookies, verifySession, setSessionCookie, clearSessionCookie } from './session-utils.js';

const uuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');
const digest = v => crypto.createHash('sha256').update(v).digest('hex');
const stamp = () => new Date().toISOString();
const eq = v => encodeURIComponent(v);
const accountId = v => /^acct_[a-zA-Z0-9]+$/.test(v || '');
const STATE_COOKIE = 'cc_stripe_connect_state';
const API_VERSION = '2024-06-20';

export function connectConfig() {
  if (process.env.STRIPE_CONNECT_ENABLED !== 'true') throw fail(503, 'Agency Stripe billing is not enabled yet.');
  const key = clean(process.env.STRIPE_CONNECT_SECRET_KEY);
  const clientId = clean(process.env.STRIPE_CONNECT_CLIENT_ID);
  const origin = clean(process.env.STRIPE_CONNECT_APP_URL).replace(/\/$/, '');
  const webhook = clean(process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(key) || !/^ca_[A-Za-z0-9]+$/.test(clientId) || !webhook || !accountSessionSecret()) throw fail(503, 'Agency Stripe configuration is incomplete.');
  try { if (new URL(origin).origin !== origin || !origin.startsWith('https://')) throw new Error(); }
  catch { throw fail(503, 'STRIPE_CONNECT_APP_URL must be an HTTPS origin.'); }
  return { key, clientId, origin, webhook, live: key.startsWith('sk_live_'), redirect: `${origin}/api/agency-stripe/?action=callback` };
}

export async function connectDb(path, method = 'GET', body, prefer = 'return=representation') {
  const url = clean(process.env.SUPABASE_URL).replace(/\/$/, ''), key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) throw fail(503, 'Agency billing storage is not configured.');
  const r = await fetch(`${url}/rest/v1/${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw fail(r.status === 409 ? 409 : 503, r.status === 409 ? 'This Stripe account or request is already assigned. Refresh and try again.' : 'Agency billing storage is unavailable. Check the Connect migration.');
  return data;
}

// The connected account is always loaded from the signed agency session, never request input.
export async function stripeRequest(cfg, path, { connected, body, key, oauth = false, platform = false } = {}) {
  if (!oauth && !platform && !accountId(connected)) throw fail(403, 'A connected agency Stripe account is required.');
  const headers = { Authorization: `Bearer ${cfg.key}`, 'Stripe-Version': API_VERSION };
  if (connected) headers['Stripe-Account'] = connected;
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (key) headers['Idempotency-Key'] = key;
  let r;
  try { r = await fetch(`${oauth ? 'https://connect.stripe.com/oauth/' : 'https://api.stripe.com/v1/'}${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? new URLSearchParams(body).toString() : undefined, signal: AbortSignal.timeout(20000) }); }
  catch { throw fail(502, 'Stripe did not respond. Retry this same request; do not create a replacement invoice.'); }
  const data = await r.json().catch(() => null);
  if (!r.ok || !data) {
    console.error('Agency Stripe request failed', { status: r.status, requestId: r.headers?.get('request-id'), code: data?.error?.code });
    throw fail(r.status === 404 ? 404 : 502, r.status === 404 ? 'That Stripe record was not found in this agency account.' : 'Stripe could not complete this request. Check account permissions and try again.');
  }
  if (typeof data.livemode === 'boolean' && data.livemode !== cfg.live) throw fail(409, 'Stripe test/live mode mismatch.');
  return data;
}

async function identity(req) {
  const session = verifySession(parseCookies(req).cc_account_session, accountSessionSecret());
  if (session?.role !== 'account' || session.memberId || !uuid(session.accountId)) throw fail(403, 'Sign in as the agency owner to manage Stripe billing.');
  const rows = await connectDb(`accounts?id=eq.${eq(session.accountId)}&select=id,access_plan,journey,diagnostic_state&limit=1`);
  if (!rows?.[0]) throw fail(401, 'Agency account no longer exists.');
  const a = rows[0], plans = [a.access_plan || a.journey, ...(Array.isArray(a.diagnostic_state?.purchasedPlans) ? a.diagnostic_state.purchasedPlans : [])];
  if (!plans.some(p => ['platform', 'fractional_coo'].includes(p)) && !(plans.includes('accelerator') && a.diagnostic_state?.acceleratorCompleted === true)) throw fail(403, 'Agency billing requires a plan with integrations access.');
  return session.accountId;
}
const connectionPath = (agency, cfg) => `agency_stripe_connections?account_id=eq.${eq(agency)}&livemode=eq.${cfg.live}`;
async function connection(agency, cfg, required = true) {
  const row = (await connectDb(`${connectionPath(agency, cfg)}&limit=1`))?.[0];
  if (required && (row?.status !== 'connected' || !accountId(row.stripe_account_id))) throw fail(409, 'Connect your agency Stripe account first.');
  return row;
}
function publicConnection(row, cfg) {
  return { connected: row?.status === 'connected', configured: true, environment: cfg.live ? 'production' : 'test', name: row?.display_name || '', stripeAccountId: row?.stripe_account_id || '', reconnectRequired: row?.status === 'disconnected' };
}
function customerView(c) { return { id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || '' }; }
export function invoiceView(i) {
  const url = clean(i.hosted_invoice_url);
  return { id: i.id, number: i.number || i.id, customerId: typeof i.customer === 'string' ? i.customer : i.customer?.id, customerName: i.customer_name || '', customerEmail: i.customer_email || '', description: i.description || '', status: i.status, currency: i.currency, total: i.total, amountDue: i.amount_due, created: i.created, dueDate: i.due_date, hostedUrl: /^https:\/\/invoice\.stripe\.com\//.test(url) ? url : '', manageable: i.metadata?.cc_source === 'agency_billing' && i.metadata?.cc_ready === 'true' };
}
export function customerInput(input) {
  const name = clean(input.name), email = clean(input.email), phone = clean(input.phone);
  if (!name || name.length > 200 || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || phone.length > 40) throw fail(422, 'Enter a customer name and valid email.');
  return { name, email, phone };
}
export function invoiceInput(input) {
  const customer = clean(input.customerId), description = clean(input.description);
  const amount = clean(input.amount), currency = clean(input.currency).toLowerCase(), days = Number(input.daysUntilDue);
  if (!/^cus_[a-zA-Z0-9]+$/.test(customer) || !description || description.length > 500) throw fail(422, 'Choose a customer and enter an invoice description.');
  if (!['usd', 'gbp', 'eur', 'cad', 'aud'].includes(currency) || !/^\d{1,6}(\.\d{1,2})?$/.test(amount)) throw fail(422, 'Enter a supported currency and amount with at most two decimal places.');
  const [whole, fraction = ''] = amount.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (cents < 100 || cents > 99999999 || !Number.isInteger(days) || days < 1 || days > 90) throw fail(422, 'Invoice amount must be at least 1.00, with payment due in 1–90 days.');
  return { customer, description, cents, currency, days };
}

// Durable request identity prevents accidental duplicate invoices, including browser retries.
async function operation(agency, cfg, row, requestId, kind, input, run) {
  if (!uuid(requestId)) throw fail(422, 'A request ID is required. Reload the billing page.');
  const hash = digest(JSON.stringify(input));
  const filter = `agency_stripe_operations?account_id=eq.${eq(agency)}&livemode=eq.${cfg.live}&request_id=eq.${eq(requestId)}`;
  await connectDb('agency_stripe_operations?on_conflict=account_id,livemode,request_id', 'POST', { account_id: agency, livemode: cfg.live, request_id: requestId, kind, input_hash: hash, stripe_account_id: row.stripe_account_id }, 'resolution=ignore-duplicates,return=representation');
  const op = (await connectDb(`${filter}&limit=1`))?.[0];
  if (!op || op.input_hash !== hash || op.kind !== kind || op.stripe_account_id !== row.stripe_account_id) throw fail(409, 'This request ID belongs to a different billing operation.');
  if (op.result) return op.result;
  if (Date.now() - Date.parse(op.created_at) > 23 * 3600000) throw fail(409, 'This unfinished request is too old to retry safely. Check Stripe before creating another.');
  const base = `cc-agency-${agency}-${cfg.live}-${requestId}`;
  const result = await run(base);
  await connectDb(filter, 'PATCH', { result });
  return result;
}

async function connectStart(req, res, agency, cfg) {
  const existing = await connection(agency, cfg, false);
  if (existing?.status === 'connected') throw fail(409, 'Disconnect the current Stripe account before connecting another.');
  const state = crypto.randomBytes(32).toString('hex');
  await connectDb('agency_stripe_oauth_states', 'POST', { state_hash: digest(state), account_id: agency, livemode: cfg.live, expires_at: new Date(Date.now() + 600000).toISOString() });
  setSessionCookie(res, STATE_COOKIE, state, 600);
  const params = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, scope: 'read_write', redirect_uri: cfg.redirect, state });
  return json(res, 200, { authorizationUrl: `https://connect.stripe.com/oauth/authorize?${params}` });
}
async function callback(req, res, agency, cfg) {
  const state = clean(req.query.state), cookie = parseCookies(req)[STATE_COOKIE];
  if (!/^[a-f0-9]{64}$/.test(state) || !cookie || state !== cookie) throw fail(403, 'Stripe authorization state is invalid. Start the connection again.');
  const used = await connectDb(`agency_stripe_oauth_states?state_hash=eq.${digest(state)}&account_id=eq.${eq(agency)}&livemode=eq.${cfg.live}&expires_at=gt.${eq(stamp())}`, 'DELETE');
  clearSessionCookie(res, STATE_COOKIE);
  if (!used?.length) throw fail(403, 'Stripe authorization expired or was already used. Start again.');
  if (req.query.error) throw fail(400, 'Stripe connection was cancelled. Return to Integrations to try again.');
  if (!clean(req.query.code)) throw fail(422, 'Stripe did not return an authorization code.');
  const token = await stripeRequest(cfg, 'token', { oauth: true, body: { grant_type: 'authorization_code', code: clean(req.query.code) } });
  if (!accountId(token.stripe_user_id) || token.scope !== 'read_write' || token.livemode !== cfg.live) throw fail(409, 'Stripe did not grant the required billing access in this environment.');
  const platform = await stripeRequest(cfg, 'account', { platform: true });
  if (token.stripe_user_id === platform.id) throw fail(409, 'Connect the agency’s Stripe account, not the Creative Creatures platform account.');
  const details = await stripeRequest(cfg, 'account', { connected: token.stripe_user_id });
  const existing = await connection(agency, cfg, false);
  if (existing?.status === 'connected') throw fail(409, 'An account was connected in another tab. Refresh Integrations.');
  // Unique constraints prevent one Stripe account being assigned to two agencies.
  const claimed = await connectDb('rpc/agency_stripe_claim', 'POST', { p_account_id: agency, p_livemode: cfg.live, p_stripe_account_id: details.id, p_display_name: details.business_profile?.name || details.settings?.dashboard?.display_name || 'Agency Stripe account' });
  if (claimed?.error) throw fail(409, claimed.error);
  res.statusCode = 303; res.setHeader('Location', `${cfg.origin}/integrations/stripe/`); res.end();
}

async function webhook(req, res, cfg) {
  if (req.method !== 'POST') throw fail(405, 'Method not allowed.');
  const event = verifyWebhook(await rawBody(req), req.headers['stripe-signature'], cfg.webhook);
  if (event.livemode !== cfg.live || !accountId(event.account)) throw fail(400, 'Incorrect Connect webhook environment or account.');
  if (event.type === 'account.application.deauthorized') {
    if (!Number.isSafeInteger(event.created)) throw fail(400, 'Invalid event timestamp.');
    // Ignore old deauthorizations after a later successful reauthorization.
    await connectDb(`agency_stripe_connections?stripe_account_id=eq.${eq(event.account)}&livemode=eq.${cfg.live}&connected_at=lte.${eq(new Date(event.created * 1000 + 999).toISOString())}`, 'PATCH', { status: 'disconnected', updated_at: stamp() });
  }
  // Customer/invoice lists are fetched live, so no cached payment status can go stale.
  return json(res, 200, { received: true });
}

export default async function agencyStripeHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const action = clean(req.query?.action);
    if (action === 'status' && process.env.STRIPE_CONNECT_ENABLED !== 'true') {
      await identity(req); return json(res, 200, { connection: { connected: false, configured: false } });
    }
    const cfg = connectConfig();
    if (action === 'webhook') return await webhook(req, res, cfg);
    const agency = await identity(req);
    if (req.method === 'GET') {
      if (action === 'callback') return await callback(req, res, agency, cfg);
      if (action === 'status') return json(res, 200, { connection: publicConnection(await connection(agency, cfg, false), cfg) });
      throw fail(405, 'Use POST for billing actions.');
    }
    if (req.method !== 'POST') throw fail(405, 'Method not allowed.');
    if (req.headers.origin !== cfg.origin || req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Request origin is not allowed.');
    const b = await jsonBody(req);
    if (action === 'connect') return await connectStart(req, res, agency, cfg);
    const row = await connection(agency, cfg);
    const connected = row.stripe_account_id;
    if (action === 'disconnect') {
      await stripeRequest(cfg, 'deauthorize', { oauth: true, body: { client_id: cfg.clientId, stripe_user_id: connected } });
      await connectDb(`${connectionPath(agency, cfg)}&stripe_account_id=eq.${eq(connected)}`, 'PATCH', { status: 'disconnected', updated_at: stamp() });
      return json(res, 200, { connection: { connected: false, configured: true } });
    }
    if (action === 'customers' || action === 'invoices') {
      const cursor = clean(b.cursor);
      if (cursor && !new RegExp(`^${action === 'customers' ? 'cus' : 'in'}_[A-Za-z0-9]+$`).test(cursor)) throw fail(422, 'Invalid page cursor.');
      const result = await stripeRequest(cfg, `${action}?limit=25${cursor ? `&starting_after=${eq(cursor)}` : ''}`, { connected });
      return json(res, 200, { records: result.data.map(action === 'customers' ? customerView : invoiceView), hasMore: result.has_more, connection: publicConnection(row, cfg) });
    }
    if (action === 'save_customer') {
      const input = customerInput(b), id = clean(b.id);
      if (id && !/^cus_[A-Za-z0-9]+$/.test(id)) throw fail(422, 'Invalid customer.');
      if (id) { const current = await stripeRequest(cfg, `customers/${id}`, { connected }); if (current.deleted) throw fail(409, 'Customer was deleted.'); }
      const result = await operation(agency, cfg, row, b.requestId, 'customer', { ...input, id }, async key => ({ customer: customerView(await stripeRequest(cfg, id ? `customers/${id}` : 'customers', { connected, body: input, key })) }));
      return json(res, 200, result);
    }
    if (action === 'create_invoice') {
      const input = invoiceInput(b);
      const customer = await stripeRequest(cfg, `customers/${input.customer}`, { connected });
      if (customer.deleted || !customer.email) throw fail(422, 'Customer needs an email address before invoicing.');
      const result = await operation(agency, cfg, row, b.requestId, 'invoice', input, async key => {
        const inv = await stripeRequest(cfg, 'invoices', { connected, key: `${key}-draft`, body: { customer: input.customer, currency: input.currency, collection_method: 'send_invoice', days_until_due: String(input.days), auto_advance: 'false', pending_invoice_items_behavior: 'exclude', description: input.description, 'metadata[cc_source]': 'agency_billing', 'metadata[cc_agency_id]': agency, 'metadata[cc_request_id]': b.requestId } });
        await stripeRequest(cfg, 'invoiceitems', { connected, key: `${key}-line`, body: { customer: input.customer, invoice: inv.id, amount: String(input.cents), currency: input.currency, description: input.description } });
        const ready = await stripeRequest(cfg, `invoices/${inv.id}`, { connected, key: `${key}-ready`, body: { 'metadata[cc_ready]': 'true' } });
        return { invoice: invoiceView(ready) };
      });
      return json(res, 200, result);
    }
    if (action === 'send_invoice') {
      const id = clean(b.id);
      if (!/^in_[A-Za-z0-9]+$/.test(id) || b.confirm !== true) throw fail(422, 'Confirm the invoice before sending.');
      let inv = await stripeRequest(cfg, `invoices/${id}`, { connected });
      if (inv.metadata?.cc_source !== 'agency_billing' || inv.metadata?.cc_agency_id !== agency || inv.metadata?.cc_ready !== 'true' || inv.collection_method !== 'send_invoice') throw fail(403, 'Only complete invoices created here can be sent here.');
      const snapshot = { id, total: inv.total, currency: inv.currency, email: inv.customer_email };
      if (b.total !== snapshot.total || b.currency !== snapshot.currency || b.email !== snapshot.email) throw fail(409, 'Invoice changed. Refresh and review the latest total and recipient.');
      if (!['draft', 'open'].includes(inv.status) || inv.total <= 0) throw fail(409, 'Only unpaid, non-empty invoices can be sent.');
      // One durable send operation per invoice avoids duplicate email when clicking twice.
      const sendId = digest(`${connected}:${id}:send`).slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
      const result = await operation(agency, cfg, row, sendId, 'send', { id }, async key => {
        if (inv.status === 'draft') inv = await stripeRequest(cfg, `invoices/${id}/finalize`, { connected, key: `${key}-finalize`, body: { auto_advance: 'false' } });
        if (inv.total !== snapshot.total || inv.currency !== snapshot.currency || inv.customer_email !== snapshot.email) throw fail(409, 'Final invoice changed. Refresh and review it before sending.');
        const sent = await stripeRequest(cfg, `invoices/${id}/send`, { connected, key: `${key}-send`, body: {} });
        return { invoice: invoiceView(sent), sent: true };
      });
      return json(res, 200, result);
    }
    throw fail(400, 'Unknown agency billing action.');
  } catch (error) {
    return json(res, error.status || 500, { error: error.status ? error.message : 'Agency billing is unavailable. Try again or contact support.' });
  }
}
