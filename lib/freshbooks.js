import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(typeof value === 'string' ? value.replace(/[$,%\s,]/g, '') : value);
  return Number.isFinite(number) ? number : null;
};
const round2 = value => Math.round(Number(value) * 100) / 100;
const percent = (numerator, denominator) => {
  const n = finite(numerator), d = finite(denominator);
  return n === null || d === null || d === 0 ? null : round2((n / d) * 100);
};
const money = value => finite(value?.amount ?? value);

const AUTHORIZE_URL = 'https://auth.freshbooks.com/oauth/authorize/';
const TOKEN_URL = 'https://api.freshbooks.com/auth/oauth/token';
const REVOKE_URL = 'https://api.freshbooks.com/auth/oauth/revoke';
const API_URL = 'https://api.freshbooks.com';
export const FRESHBOOKS_REQUIRED_SCOPES = [
  'user:profile:read',
  'user:clients:read',
  'user:clients:write',
  'user:invoices:read',
  'user:payments:read',
  'user:expenses:read',
  'user:reports:read'
];

export function freshBooksConfig() {
  const clientId = clean(process.env.FRESHBOOKS_CLIENT_ID);
  const clientSecret = clean(process.env.FRESHBOOKS_CLIENT_SECRET);
  const redirectUri = clean(process.env.FRESHBOOKS_REDIRECT_URI);
  const encryptionSecret = clean(process.env.FRESHBOOKS_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, encryptionSecret, requiredScopes: FRESHBOOKS_REQUIRED_SCOPES };
}

function cipherKey(secret) { return crypto.createHash('sha256').update(String(secret)).digest(); }

export function encryptFreshBooksToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptFreshBooksToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored FreshBooks token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createFreshBooksAuthorizationUrl(accountId) {
  const config = freshBooksConfig();
  if (!config) throw new Error('FreshBooks is not configured.');
  const state = signSession({ purpose: 'freshbooks-oauth', accountId }, accountSessionSecret(), 10 * 60);
  return `${AUTHORIZE_URL}?${new URLSearchParams({
    response_type: 'code', redirect_uri: config.redirectUri, client_id: config.clientId, state
  }).toString()}`;
}

export function verifyFreshBooksOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'freshbooks-oauth' && payload?.accountId === accountId);
}

async function tokenRequest(values) {
  const config = freshBooksConfig();
  if (!config) throw new Error('FreshBooks is not configured.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...values, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    const error = new Error(payload?.error_description || payload?.message || payload?.error || 'FreshBooks OAuth request failed.');
    error.status = response.status || 502;
    error.code = payload?.error || 'FRESHBOOKS_OAUTH_ERROR';
    throw error;
  }
  return payload;
}

export function exchangeFreshBooksCode(code) {
  return tokenRequest({ grant_type: 'authorization_code', code: clean(code) });
}

export function refreshFreshBooksTokens(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: clean(refreshToken) });
}

export async function revokeFreshBooksToken(token) {
  const config = freshBooksConfig();
  if (!config || !clean(token)) return false;
  const response = await fetch(REVOKE_URL, {
    method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, token: clean(token) })
  }).catch(() => null);
  return Boolean(response?.ok);
}

function queryString(query) {
  if (!query) return '';
  const params = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function freshBooksApiRequest({ accessToken, path, query, method = 'GET', body, alpha = false }) {
  if (!String(path || '').startsWith('/')) throw Object.assign(new Error('FreshBooks API path is invalid.'), { status: 422 });
  const response = await fetch(`${API_URL}${path}${queryString(query)}`, {
    method,
    headers: {
      Accept: 'application/json', Authorization: `Bearer ${accessToken}`,
      ...(alpha ? { 'Api-Version': 'alpha' } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok || payload?.response?.errors?.length) {
    const apiError = payload?.response?.errors?.[0] || payload?.error || {};
    const error = new Error(apiError?.message || apiError?.error_description || payload?.message || 'FreshBooks API request failed.');
    error.status = response.status || 502;
    error.code = apiError?.errno || apiError?.code || payload?.error || 'FRESHBOOKS_API_ERROR';
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function getFreshBooksIdentity(accessToken) {
  const payload = await freshBooksApiRequest({ accessToken, path: '/auth/api/v1/users/me', alpha: true });
  const identity = payload?.response || {};
  const businesses = (identity?.business_memberships || []).map(membership => {
    const business = membership?.business || {};
    return {
      membershipId: clean(membership?.id), role: clean(membership?.role),
      id: clean(business?.id), uuid: clean(business?.business_uuid || business?.uuid),
      accountId: clean(business?.account_id), name: clean(business?.name) || 'FreshBooks business',
      active: business?.active !== false, dateFormat: clean(business?.date_format)
    };
  }).filter(business => business.accountId && business.active);
  return {
    id: clean(identity?.id), email: clean(identity?.email),
    firstName: clean(identity?.first_name || identity?.profile?.first_name),
    lastName: clean(identity?.last_name || identity?.profile?.last_name), businesses
  };
}

const resultOf = payload => payload?.response?.result || {};
const boundedId = value => {
  const id = clean(value);
  if (!/^\d+$/.test(id)) throw Object.assign(new Error('FreshBooks record ID is invalid.'), { status: 422 });
  return id;
};
const accountPath = (accountId, suffix) => `/accounting/account/${encodeURIComponent(clean(accountId))}${suffix}`;

function normalizeClient(item) {
  return {
    id: clean(item?.id || item?.userid), firstName: clean(item?.fname), lastName: clean(item?.lname),
    email: clean(item?.email), organization: clean(item?.organization), phone: clean(item?.bus_phone || item?.mob_phone || item?.home_phone),
    currency: clean(item?.currency_code), note: clean(item?.note), street: clean(item?.p_street), street2: clean(item?.p_street2),
    city: clean(item?.p_city), province: clean(item?.p_province), postalCode: clean(item?.p_code), country: clean(item?.p_country),
    outstandingBalance: money(item?.outstanding_balance), overdueBalance: money(item?.overdue_balance),
    grandTotalBalance: money(item?.grand_total_balance), updatedAt: clean(item?.updated) || null, archived: Number(item?.vis_state) !== 0
  };
}

function normalizeInvoice(item) {
  return {
    id: clean(item?.id || item?.invoiceid), invoiceNumber: clean(item?.invoice_number), clientId: clean(item?.customerid),
    clientName: clean(item?.organization || item?.current_organization || `${clean(item?.fname)} ${clean(item?.lname)}`),
    status: clean(item?.v3_status || item?.display_status || item?.payment_status), date: clean(item?.create_date) || null,
    dueDate: clean(item?.due_date) || null, amount: money(item?.amount), paid: money(item?.paid), outstanding: money(item?.outstanding),
    currency: clean(item?.currency_code || item?.amount?.code), updatedAt: clean(item?.updated) || null,
    lines: (item?.lines || []).map(line => ({ name: clean(line?.name || line?.description) || 'Service', amount: money(line?.amount), quantity: finite(line?.qty) }))
  };
}

function normalizePayment(item) {
  return {
    id: clean(item?.id || item?.logid), invoiceId: clean(item?.invoiceid), clientId: clean(item?.clientid),
    date: clean(item?.date) || null, amount: money(item?.amount), currency: clean(item?.amount?.code),
    type: clean(item?.type), note: clean(item?.note), updatedAt: clean(item?.updated) || null
  };
}

function normalizeExpense(item) {
  return {
    id: clean(item?.id || item?.expenseid), date: clean(item?.date) || null, vendor: clean(item?.vendor),
    amount: money(item?.amount), currency: clean(item?.amount?.code), category: clean(item?.category?.category || item?.category?.name || item?.account_name),
    status: finite(item?.status), notes: clean(item?.notes), updatedAt: clean(item?.updated) || null
  };
}

async function listPages({ accessToken, path, query, key, mapper, max = 500 }) {
  const base = query instanceof URLSearchParams ? new URLSearchParams(query) : new URLSearchParams(query || {});
  const rows = [];
  let page = 1, total = null, pages = 1;
  do {
    const params = new URLSearchParams(base);params.set('page', String(page));params.set('per_page', '100');
    const result = resultOf(await freshBooksApiRequest({ accessToken, path, query: params }));
    const batch = Array.isArray(result?.[key]) ? result[key] : [];
    rows.push(...batch.map(mapper).filter(item => item.id));
    total = finite(result?.total);pages = Math.max(1, finite(result?.pages) || 1);page += 1;
  } while (page <= pages && rows.length < max);
  return { records: rows.slice(0, max), total: total ?? rows.length, truncated: (total ?? rows.length) > rows.length };
}

export function listFreshBooksClients({ accessToken, accountId }) {
  const query = new URLSearchParams();
  ['outstanding_balance','overdue_balance','grand_total_balance'].forEach(value => query.append('include[]', value));
  return listPages({ accessToken, path: accountPath(accountId, '/users/clients'), query, key: 'clients', mapper: normalizeClient });
}

export function listFreshBooksInvoices({ accessToken, accountId, startDate, endDate }) {
  const query = new URLSearchParams();query.append('include[]', 'lines');
  if (startDate) query.set('search[date_min]', startDate);if (endDate) query.set('search[date_max]', endDate);
  return listPages({ accessToken, path: accountPath(accountId, '/invoices/invoices'), query, key: 'invoices', mapper: normalizeInvoice });
}

export function listFreshBooksPayments({ accessToken, accountId }) {
  return listPages({ accessToken, path: accountPath(accountId, '/payments/payments'), key: 'payments', mapper: normalizePayment });
}

export function listFreshBooksExpenses({ accessToken, accountId }) {
  const query = new URLSearchParams();query.append('include[]', 'category');
  return listPages({ accessToken, path: accountPath(accountId, '/expenses/expenses'), query, key: 'expenses', mapper: normalizeExpense });
}

export async function saveFreshBooksClient({ accessToken, accountId, id, client }) {
  const currentId = clean(id);
  const payload = await freshBooksApiRequest({
    accessToken, path: accountPath(accountId, `/users/clients${currentId ? `/${boundedId(currentId)}` : ''}`),
    method: currentId ? 'PUT' : 'POST', body: { client }
  });
  const saved = resultOf(payload)?.client;
  if (!saved) throw Object.assign(new Error('FreshBooks did not return the saved client.'), { status: 502 });
  return normalizeClient(saved);
}

export async function archiveFreshBooksClient({ accessToken, accountId, id }) {
  await freshBooksApiRequest({ accessToken, path: accountPath(accountId, `/users/clients/${boundedId(id)}`), method: 'PUT', body: { client: { vis_state: 1 } } });
  return true;
}

function completeMonthWindow(months) {
  const now = new Date(), end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 1));
  const iso = date => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function series(node, size) {
  const data = Array.isArray(node?.data) ? node.data : [];
  return Array.from({ length: size }, (_, index) => money(data[index]));
}
function sumKnown(values) {
  const usable = values.map(finite).filter(value => value !== null);
  return usable.length ? round2(usable.reduce((sum, value) => sum + value, 0)) : null;
}
function sumSeries(nodes, size) {
  return Array.from({ length: size }, (_, index) => sumKnown((nodes || []).map(node => money(node?.data?.[index]))));
}

export async function fetchFreshBooksProfitLossEvidence({ accessToken, businessUuid }) {
  if (!clean(businessUuid)) throw Object.assign(new Error('FreshBooks did not return a business UUID required for financial reports.'), { status: 409 });
  const { start, end } = completeMonthWindow(24);
  const query = new URLSearchParams({ start_date:start, end_date:end, use_ledger_entries:'true', resolution:'m', cash_based:'false', fiscal_year_view:'false', locale:'en' });
  const payload = await freshBooksApiRequest({ accessToken, path:`/accounting/businesses/${encodeURIComponent(clean(businessUuid))}/reports/profit_and_loss`, query });
  const report = resultOf(payload)?.profit_and_loss || {};
  const labels = Array.isArray(report.labels) ? report.labels.map(value => clean(value).slice(0, 7)).filter(Boolean) : [];
  const size = labels.length;
  const revenueSeries = sumSeries(report.income, size), grossSeries = series(report.total_income, size);
  const expenseSeries = series(report.total_expenses || report.total_expense, size), netSeries = series(report.net_profit, size);
  const periods = labels.map((period, index) => ({
    period, isPartial:false, revenue:revenueSeries[index],
    cogs: revenueSeries[index] !== null && grossSeries[index] !== null ? round2(revenueSeries[index] - grossSeries[index]) : null,
    grossProfit:grossSeries[index], netIncome:netSeries[index]
  }));
  const current = periods.slice(-12), prior = periods.slice(-24, -12), total = (rows, key) => sumKnown(rows.map(row => row[key]));
  const currentRevenue=total(current,'revenue'),currentGross=total(current,'grossProfit'),currentNet=total(current,'netIncome'),currentExpenses=sumKnown(expenseSeries.slice(-12));
  const priorRevenue=total(prior,'revenue'),priorGross=total(prior,'grossProfit'),priorNet=total(prior,'netIncome');
  return {
    currency: clean(report.currency_code), confidence:1, source:'freshbooks',
    warnings: labels.length < 24 ? ['FreshBooks returned fewer than 24 monthly report periods; prior-year comparisons remain unavailable where incomplete.'] : [],
    sourcePeriod: current.length ? `${current[0].period} through ${current.at(-1).period}` : `${start} through ${end}`,
    priorPeriod: prior.length ? `${prior[0].period} through ${prior.at(-1).period}` : null, monthlyPeriods:periods,
    revenueTTM:currentRevenue, cogsTTM:currentRevenue !== null && currentGross !== null ? round2(currentRevenue-currentGross) : null,
    grossProfitTTM:currentGross, operatingExpensesTTM:currentExpenses, netIncomeTTM:currentNet,
    priorRevenueTTM:prior.length===12?priorRevenue:null, priorGrossProfitTTM:prior.length===12?priorGross:null, priorNetIncomeTTM:prior.length===12?priorNet:null,
    revenueGrowthPercent:prior.length===12?percent(currentRevenue-priorRevenue,priorRevenue):null,
    netIncomeGrowthPercent:prior.length===12?percent(currentNet-priorNet,Math.abs(priorNet)):null,
    grossProfitGrowthPercent:prior.length===12?percent(currentGross-priorGross,priorGross):null,
    grossMarginPercent:percent(currentGross,currentRevenue), netMarginPercent:percent(currentNet,currentRevenue),
    monthlyOperatingExpenses:currentExpenses!==null?round2(currentExpenses/12):null
  };
}

const latestBalance = values => money(Array.isArray(values) ? values.at(-1)?.balance : null);
function balanceSubtypes(report, test) {
  return (report?.data || []).flatMap(group => group?.sub_types || []).filter(subtype => test(clean(subtype?.account_sub_type).toLowerCase()));
}
function sumSubtypeBalances(report, test) { return sumKnown(balanceSubtypes(report, test).map(subtype => latestBalance(subtype?.balances))); }
function allAccounts(report) { return (report?.data || []).flatMap(group => (group?.sub_types || []).flatMap(subtype => subtype?.accounts || [])); }

export async function fetchFreshBooksBalanceSheetEvidence({ accessToken, businessUuid }) {
  if (!clean(businessUuid)) throw Object.assign(new Error('FreshBooks did not return a business UUID required for financial reports.'), { status: 409 });
  const { end } = completeMonthWindow(1);
  const query = new URLSearchParams({ use_ledger_entries:'true', date1:end, cash_based:'false', locale:'en' });
  const payload = await freshBooksApiRequest({ accessToken, path:`/accounting/businesses/${encodeURIComponent(clean(businessUuid))}/reports/balance_sheet`, query });
  const report = resultOf(payload)?.balance_sheet || {}, accounts = allAccounts(report);
  const exactAccount = pattern => sumKnown(accounts.filter(account => pattern.test(clean(account?.account_name).toLowerCase())).map(account => latestBalance(account?.balances)));
  const totalLiabilities = sumKnown((report?.data || []).filter(group => /liabilit/.test(clean(group?.account_type).toLowerCase())).map(group => latestBalance(group?.balances)));
  const totalDebt = exactAccount(/loan|debt|line of credit|credit card/);
  return {
    currency:clean(report.currency_code),confidence:1,source:'freshbooks',asOfDate:end,
    warnings:totalDebt===null?['FreshBooks did not expose a clearly identifiable interest-bearing debt total; confirm Total Debt manually if applicable.']:[],
    cash:sumSubtypeBalances(report,label=>/cash|bank/.test(label)),
    accountsReceivable:exactAccount(/accounts? receivable|a\/r/),
    currentAssets:sumSubtypeBalances(report,label=>/cash|bank|current asset/.test(label)),
    currentLiabilities:sumSubtypeBalances(report,label=>/current liabilit|accounts payable|credit card/.test(label)),
    totalAssets:money(report?.assets_total?.at?.(-1)?.balance),totalLiabilities,totalDebt
  };
}

export async function fetchFreshBooksArAgingEvidence({ accessToken, accountId }) {
  const { end } = completeMonthWindow(1);
  const query = new URLSearchParams({ end_date:end });
  const payload = await freshBooksApiRequest({ accessToken, path:accountPath(accountId, '/reports/accounting/accounts_aging'), query, alpha:true });
  const report = resultOf(payload)?.accounts_aging || {}, totals = report?.totals || {};
  const days1to30=money(totals['0-30']),days31to60=money(totals['31-60']),days61to90=money(totals['61-90']),days90Plus=money(totals['91+']),totalAR=money(totals.total);
  return { currency:clean(report.currency_code||totals?.total?.code),confidence:1,warnings:[],source:'freshbooks',asOfDate:clean(report.end_date)||end,totalAR,currentAR:null,days1to30,days31to60,days61to90,days90Plus,collectionRatePercent:null };
}

export async function fetchFreshBooksClientRevenueEvidence({ accessToken, accountId }) {
  const { start, end } = completeMonthWindow(12);
  const result = await listFreshBooksInvoices({ accessToken, accountId, startDate:start, endDate:end });
  const recognized = result.records.filter(invoice => !/^(created|draft)$/i.test(invoice.status));
  const clients = new Map(), services = new Map();
  recognized.forEach(invoice => {
    const revenue = finite(invoice.amount);if(revenue===null)return;
    const key = invoice.clientId || invoice.clientName || invoice.id, current = clients.get(key) || { name:invoice.clientName||`Client ${key}`, revenue:0 };
    current.revenue=round2(current.revenue+revenue);clients.set(key,current);
    (invoice.lines||[]).forEach(line=>{const amount=finite(line.amount);if(amount===null)return;const name=line.name||'Service';services.set(name,round2((services.get(name)||0)+amount))});
  });
  const rows=[...clients.values()].sort((a,b)=>b.revenue-a.revenue),totalRevenue=sumKnown(rows.map(client=>client.revenue));
  const serviceRows=[...services.entries()].map(([name,revenue])=>({name,revenue,percent:percent(revenue,totalRevenue)})).sort((a,b)=>b.revenue-a.revenue);
  const warning=result.truncated?'FreshBooks invoice data exceeded the 500-record Phase 1 sync cap; client revenue evidence is incomplete.':null;
  return {
    clientRevenue:{currency:recognized.find(invoice=>invoice.currency)?.currency||null,confidence:result.truncated?.75:1,warnings:warning?[warning]:[],source:'freshbooks',periodLabel:'Latest 12 complete months',totalRevenue,clientCount:rows.length,averageClientRevenue:rows.length&&totalRevenue!==null?round2(totalRevenue/rows.length):null,topClientPercent:rows.length&&totalRevenue?percent(rows[0].revenue,totalRevenue):null,averageClientTenureMonths:null,revenueDiversificationLevel:null,contractDurationLevel:null,clients:rows},
    serviceRevenue:{currency:recognized.find(invoice=>invoice.currency)?.currency||null,confidence:result.truncated?.75:1,warnings:[...(warning?[warning]:[]),'FreshBooks invoice lines do not identify recurring versus project revenue. Confirm that mix manually.'],source:'freshbooks',periodLabel:'Latest 12 complete months',totalRevenue,recurringRevenue:null,projectRevenue:null,recurringRevenuePercent:null,projectRevenuePercent:null,services:serviceRows}
  };
}
