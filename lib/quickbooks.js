import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean = value => String(value ?? '').trim();
const finite = value => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'string' ? value.replace(/[$,%()\s,]/g, m => m === '(' ? '-' : '').replace(/\)/g, '') : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};
const round2 = value => Math.round(Number(value) * 100) / 100;
const percent = (numerator, denominator) => {
  const n = finite(numerator), d = finite(denominator);
  return n === null || d === null || d === 0 ? null : round2((n / d) * 100);
};

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const ACCOUNTING_SCOPE = 'com.intuit.quickbooks.accounting';

export function quickBooksConfig() {
  const clientId = clean(process.env.QUICKBOOKS_CLIENT_ID);
  const clientSecret = clean(process.env.QUICKBOOKS_CLIENT_SECRET);
  const redirectUri = clean(process.env.QUICKBOOKS_REDIRECT_URI);
  const environment = clean(process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const encryptionSecret = clean(process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY) || accountSessionSecret();
  if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) return null;
  return { clientId, clientSecret, redirectUri, environment, encryptionSecret };
}

function cipherKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encryptQuickBooksToken(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', cipherKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptQuickBooksToken(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Stored QuickBooks token is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', cipherKey(secret), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function createQuickBooksAuthorizationUrl(accountId) {
  const config = quickBooksConfig();
  if (!config) throw new Error('QuickBooks is not configured.');
  const secret = accountSessionSecret();
  const state = signSession({ purpose: 'quickbooks-oauth', accountId }, secret, 10 * 60);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: ACCOUNTING_SCOPE,
    redirect_uri: config.redirectUri,
    state
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export function verifyQuickBooksOAuthState(state, accountId) {
  const payload = verifySession(state, accountSessionSecret());
  return Boolean(payload?.purpose === 'quickbooks-oauth' && payload?.accountId === accountId);
}

async function tokenRequest(body) {
  const config = quickBooksConfig();
  if (!config) throw new Error('QuickBooks is not configured.');
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body).toString()
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error = new Error(payload?.error_description || payload?.error || 'QuickBooks token request failed.');
    error.status = response.status;
    error.code = payload?.error || 'QUICKBOOKS_TOKEN_ERROR';
    throw error;
  }
  return payload;
}

export function exchangeQuickBooksCode(code) {
  const config = quickBooksConfig();
  return tokenRequest({
    grant_type: 'authorization_code',
    code: clean(code),
    redirect_uri: config.redirectUri
  });
}

export function refreshQuickBooksTokens(refreshToken) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function revokeQuickBooksToken(token) {
  const config = quickBooksConfig();
  if (!config || !token) return false;
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const response = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  }).catch(() => null);
  return Boolean(response?.ok);
}

export function quickBooksApiBase() {
  const config = quickBooksConfig();
  return config?.environment === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company';
}

export async function quickBooksApiRequest({ realmId, accessToken, path, query }) {
  const params = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetch(`${quickBooksApiBase()}/${encodeURIComponent(realmId)}/${path}${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.Fault?.Error?.[0]?.Detail || payload?.Fault?.Error?.[0]?.Message || 'QuickBooks API request failed.';
    const error = new Error(detail);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function getQuickBooksCompanyInfo({ realmId, accessToken }) {
  const payload = await quickBooksApiRequest({ realmId, accessToken, path: `companyinfo/${encodeURIComponent(realmId)}` });
  return payload?.CompanyInfo || null;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
function startOfMonthUtc(year, month) { return new Date(Date.UTC(year, month, 1)); }
function endOfMonthUtc(year, month) { return new Date(Date.UTC(year, month + 1, 0)); }
function addMonthsUtc(date, months) { return startOfMonthUtc(date.getUTCFullYear(), date.getUTCMonth() + months); }

export function completeMonthWindow(monthCount = 24, now = new Date()) {
  const latestComplete = endOfMonthUtc(now.getUTCFullYear(), now.getUTCMonth() - 1);
  const start = addMonthsUtc(startOfMonthUtc(latestComplete.getUTCFullYear(), latestComplete.getUTCMonth()), -(monthCount - 1));
  return { start, end: latestComplete };
}

function reportColumns(report) {
  return Array.isArray(report?.Columns?.Column) ? report.Columns.Column : [];
}
function rowData(row) {
  if (Array.isArray(row?.Summary?.ColData)) return row.Summary.ColData;
  if (Array.isArray(row?.ColData)) return row.ColData;
  return null;
}
function flattenRows(container, out = []) {
  const rows = Array.isArray(container?.Row) ? container.Row : Array.isArray(container) ? container : [];
  for (const row of rows) {
    const data = rowData(row);
    if (data) {
      const label = clean(data[0]?.value || row?.group);
      out.push({ label, data, group: clean(row?.group), type: clean(row?.type) });
    }
    if (row?.Rows) flattenRows(row.Rows, out);
  }
  return out;
}
function normLabel(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function findRow(report, tests) {
  const rows = flattenRows(report?.Rows);
  for (const test of tests) {
    const match = rows.find(row => test(normLabel(row.label), normLabel(row.group)));
    if (match) return match;
  }
  return null;
}
function parseMonthTitle(value) {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = new Date(`${raw} 1`);
  if (!Number.isNaN(parsed.getTime())) return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`;
  const match = raw.match(/(20\d{2}|19\d{2})[-/](0?[1-9]|1[0-2])/);
  return match ? `${match[1]}-${String(Number(match[2])).padStart(2, '0')}` : null;
}
function rowValuesByMonth(report, row) {
  if (!row) return {};
  const columns = reportColumns(report);
  const result = {};
  for (let index = 1; index < Math.min(columns.length, row.data.length); index += 1) {
    const key = parseMonthTitle(columns[index]?.ColTitle);
    const value = finite(row.data[index]?.value);
    if (key && value !== null) result[key] = value;
  }
  return result;
}
function mergeMonthlyMaps(target, source) {
  for (const [key, value] of Object.entries(source || {})) if (finite(value) !== null) target[key] = finite(value);
}
function sum(values) { return round2(values.reduce((total, value) => total + (finite(value) ?? 0), 0)); }

async function runReport({ realmId, accessToken, reportName, startDate, endDate, extra = {} }) {
  const query = { ...extra };
  if (startDate) query.start_date = isoDate(startDate);
  if (endDate) query.end_date = isoDate(endDate);
  return quickBooksApiRequest({ realmId, accessToken, path: `reports/${reportName}`, query });
}

async function runChunkedMonthlyReport({ realmId, accessToken, reportName, start, end }) {
  const reports = [];
  let cursor = startOfMonthUtc(start.getUTCFullYear(), start.getUTCMonth());
  while (cursor <= end) {
    const chunkEndCandidate = endOfMonthUtc(cursor.getUTCFullYear(), cursor.getUTCMonth() + 5);
    const chunkEnd = chunkEndCandidate > end ? end : chunkEndCandidate;
    reports.push(await runReport({
      realmId, accessToken, reportName,
      startDate: cursor, endDate: chunkEnd,
      extra: { summarize_column_by: 'Month', accounting_method: 'Accrual' }
    }));
    cursor = addMonthsUtc(cursor, 6);
  }
  return reports;
}

export async function fetchProfitLossEvidence({ realmId, accessToken }) {
  const { start, end } = completeMonthWindow(24);
  const reports = await runChunkedMonthlyReport({ realmId, accessToken, reportName: 'ProfitAndLoss', start, end });
  const maps = { revenue: {}, cogs: {}, grossProfit: {}, netIncome: {}, expenses: {} };
  for (const report of reports) {
    const revenue = findRow(report, [
      label => label === 'total income',
      label => label === 'income',
      (label, group) => group === 'income' && label.startsWith('total ')
    ]);
    const cogs = findRow(report, [
      label => label === 'total cost of goods sold',
      label => label === 'cost of goods sold',
      label => label === 'total cost of sales'
    ]);
    const gross = findRow(report, [label => label === 'gross profit']);
    const net = findRow(report, [label => label === 'net income', label => label === 'net operating income']);
    const expenses = findRow(report, [label => label === 'total expenses', label => label === 'expenses']);
    mergeMonthlyMaps(maps.revenue, rowValuesByMonth(report, revenue));
    mergeMonthlyMaps(maps.cogs, rowValuesByMonth(report, cogs));
    mergeMonthlyMaps(maps.grossProfit, rowValuesByMonth(report, gross));
    mergeMonthlyMaps(maps.netIncome, rowValuesByMonth(report, net));
    mergeMonthlyMaps(maps.expenses, rowValuesByMonth(report, expenses));
  }

  const keys = [...new Set(Object.keys(maps.revenue).concat(Object.keys(maps.netIncome)))].sort();
  if (keys.length < 24) throw new Error(`QuickBooks returned ${keys.length} complete monthly P&L periods; 24 are required for verified TTM comparisons.`);
  const selected = keys.slice(-24);
  const priorKeys = selected.slice(0, 12), currentKeys = selected.slice(12);
  const values = (map, monthKeys) => monthKeys.map(key => finite(map[key]) ?? 0);
  const currentRevenue = sum(values(maps.revenue, currentKeys));
  const priorRevenue = sum(values(maps.revenue, priorKeys));
  const currentCogs = sum(values(maps.cogs, currentKeys));
  const priorCogs = sum(values(maps.cogs, priorKeys));
  const currentGross = Object.keys(maps.grossProfit).length ? sum(values(maps.grossProfit, currentKeys)) : round2(currentRevenue - currentCogs);
  const priorGross = Object.keys(maps.grossProfit).length ? sum(values(maps.grossProfit, priorKeys)) : round2(priorRevenue - priorCogs);
  const currentNet = sum(values(maps.netIncome, currentKeys));
  const priorNet = sum(values(maps.netIncome, priorKeys));
  const currentExpenses = sum(values(maps.expenses, currentKeys));
  const monthlyPeriods = selected.map(key => ({
    period: key,
    isPartial: false,
    revenue: finite(maps.revenue[key]),
    cogs: finite(maps.cogs[key]),
    grossProfit: finite(maps.grossProfit[key]) ?? ((finite(maps.revenue[key]) !== null && finite(maps.cogs[key]) !== null) ? round2(finite(maps.revenue[key]) - finite(maps.cogs[key])) : null),
    netIncome: finite(maps.netIncome[key])
  }));
  return {
    currency: reports.at(-1)?.Header?.Currency || null,
    confidence: 1,
    warnings: [],
    source: 'quickbooks',
    sourcePeriod: `${currentKeys[0]} through ${currentKeys.at(-1)}`,
    priorPeriod: `${priorKeys[0]} through ${priorKeys.at(-1)}`,
    monthlyPeriods,
    revenueTTM: currentRevenue,
    cogsTTM: currentCogs,
    grossProfitTTM: currentGross,
    netIncomeTTM: currentNet,
    priorRevenueTTM: priorRevenue,
    priorCogsTTM: priorCogs,
    priorGrossProfitTTM: priorGross,
    priorNetIncomeTTM: priorNet,
    revenueGrowthPercent: percent(currentRevenue - priorRevenue, priorRevenue),
    netIncomeGrowthPercent: percent(currentNet - priorNet, Math.abs(priorNet)),
    grossProfitGrowthPercent: percent(currentGross - priorGross, priorGross),
    profitConversionPercent: percent(currentNet - priorNet, currentRevenue - priorRevenue),
    grossMarginPercent: percent(currentGross, currentRevenue),
    netMarginPercent: percent(currentNet, currentRevenue),
    monthlyOperatingExpenses: currentExpenses ? round2(currentExpenses / 12) : null
  };
}

function reportScalar(report, tests) {
  const row = findRow(report, tests);
  if (!row) return null;
  for (let index = row.data.length - 1; index >= 1; index -= 1) {
    const value = finite(row.data[index]?.value);
    if (value !== null) return value;
  }
  return null;
}

export async function fetchBalanceSheetEvidence({ realmId, accessToken }) {
  const { end } = completeMonthWindow(1);
  const report = await runReport({ realmId, accessToken, reportName: 'BalanceSheet', endDate: end, extra: { accounting_method: 'Accrual' } });
  const totalAssets = reportScalar(report, [label => label === 'total assets']);
  const totalLiabilities = reportScalar(report, [label => label === 'total liabilities']);
  const currentAssets = reportScalar(report, [label => label === 'total current assets', label => label === 'current assets']);
  const currentLiabilities = reportScalar(report, [label => label === 'total current liabilities', label => label === 'current liabilities']);
  const cash = reportScalar(report, [
    label => label === 'cash and cash equivalents',
    label => label === 'total cash and cash equivalents',
    label => label === 'total bank accounts',
    label => label === 'bank accounts'
  ]);
  const longTermDebt = reportScalar(report, [
    label => label === 'total long term liabilities',
    label => label === 'total long term debt',
    label => label === 'long term liabilities'
  ]);
  const creditCards = reportScalar(report, [label => label === 'total credit cards', label => label === 'credit cards']);
  const totalDebt = (finite(longTermDebt) !== null || finite(creditCards) !== null) ? round2((finite(longTermDebt) || 0) + (finite(creditCards) || 0)) : null;
  return {
    currency: report?.Header?.Currency || null,
    confidence: 1,
    warnings: totalDebt === null ? ['QuickBooks did not expose a clearly identifiable interest-bearing debt total; confirm Total Debt manually if applicable.'] : [],
    source: 'quickbooks',
    asOfDate: isoDate(end),
    cash,
    currentAssets,
    currentLiabilities,
    totalAssets,
    totalLiabilities,
    totalDebt
  };
}

function numericColumns(report) {
  return reportColumns(report).map((column, index) => ({ index, title: clean(column?.ColTitle) })).filter(item => item.index > 0);
}
function lastNumeric(row) {
  if (!row) return null;
  for (let index = row.data.length - 1; index >= 1; index -= 1) {
    const value = finite(row.data[index]?.value);
    if (value !== null) return value;
  }
  return null;
}

export async function fetchArAgingEvidence({ realmId, accessToken }) {
  const end = new Date();
  const report = await runReport({ realmId, accessToken, reportName: 'AgedReceivables', endDate: end });
  const totalAR = reportScalar(report, [label => label === 'total']);
  const totals = findRow(report, [label => label === 'total']);
  const columns = numericColumns(report);
  const buckets = {
    currentAR: null,
    days1to30: null,
    days31to60: null,
    days61to90: null,
    days90Plus: null
  };
  const bucketForTitle = title => {
    const label = normLabel(title);
    if (/^current(?: due)?$/.test(label)) return 'currentAR';
    if (/^(?:0|1) 30(?: days?)?$/.test(label)) return 'days1to30';
    if (/^31 60(?: days?)?$/.test(label)) return 'days31to60';
    if (/^61 90(?: days?)?$/.test(label)) return 'days61to90';
    if (/^(?:90|91) (?:and )?(?:over|plus)$/.test(label) || /^over 90$/.test(label)) return 'days90Plus';
    return null;
  };
  if (totals) {
    columns.forEach(({ index, title }) => {
      const bucket = bucketForTitle(title);
      if (!bucket) return;
      buckets[bucket] = finite(totals.data[index]?.value) ?? 0;
    });
  }
  const within30Values = [buckets.currentAR, buckets.days1to30].filter(value => value !== null);
  const within30 = within30Values.length ? sum(within30Values) : null;
  const missingBuckets = Object.values(buckets).filter(value => value === null).length;
  return {
    currency: report?.Header?.Currency || null,
    confidence: 1,
    warnings: missingBuckets ? ['QuickBooks did not expose every standard A/R aging bucket; confirm the missing values manually.'] : [],
    source: 'quickbooks',
    asOfDate: isoDate(end),
    totalAR,
    ...buckets,
    collectionRatePercent: within30 !== null && finite(totalAR) ? percent(within30, totalAR) : null
  };
}

function aggregateNamedReportRows(reports) {
  const totals = new Map();
  for (const report of reports) {
    const rows = flattenRows(report?.Rows);
    for (const row of rows) {
      const name = clean(row.label);
      if (!name || /^total\b/i.test(name) || /^(income|sales)$/i.test(name)) continue;
      const value = lastNumeric(row);
      if (value === null) continue;
      totals.set(name, round2((totals.get(name) || 0) + value));
    }
  }
  return [...totals.entries()].map(([name, revenue]) => ({ name, revenue })).filter(item => item.revenue !== 0).sort((a, b) => b.revenue - a.revenue);
}

async function runTwoHalfYearReports({ realmId, accessToken, reportName }) {
  const { start, end } = completeMonthWindow(12);
  const firstEnd = endOfMonthUtc(start.getUTCFullYear(), start.getUTCMonth() + 5);
  const secondStart = addMonthsUtc(start, 6);
  return Promise.all([
    runReport({ realmId, accessToken, reportName, startDate: start, endDate: firstEnd, extra: { accounting_method: 'Accrual' } }),
    runReport({ realmId, accessToken, reportName, startDate: secondStart, endDate: end, extra: { accounting_method: 'Accrual' } })
  ]);
}

export async function fetchClientRevenueEvidence({ realmId, accessToken }) {
  const reports = await runTwoHalfYearReports({ realmId, accessToken, reportName: 'CustomerSales' });
  const clients = aggregateNamedReportRows(reports);
  const totalRevenue = sum(clients.map(client => client.revenue));
  return {
    currency: reports.at(-1)?.Header?.Currency || null,
    confidence: 1,
    warnings: [],
    source: 'quickbooks',
    periodLabel: 'Latest 12 complete months',
    totalRevenue,
    topClientPercent: clients.length && totalRevenue ? percent(clients[0].revenue, totalRevenue) : null,
    averageClientTenureMonths: null,
    revenueDiversificationLevel: null,
    contractDurationLevel: null,
    clients
  };
}

export async function fetchServiceRevenueEvidence({ realmId, accessToken }) {
  const reports = await runTwoHalfYearReports({ realmId, accessToken, reportName: 'ItemSales' });
  const services = aggregateNamedReportRows(reports).map(item => ({ ...item, percent: null }));
  const totalRevenue = sum(services.map(service => service.revenue));
  services.forEach(service => { service.percent = totalRevenue ? percent(service.revenue, totalRevenue) : null; });
  return {
    currency: reports.at(-1)?.Header?.Currency || null,
    confidence: 1,
    warnings: ['QuickBooks item sales do not reliably identify recurring versus project revenue. Confirm Recurring Revenue % manually unless your item structure explicitly captures it.'],
    source: 'quickbooks',
    periodLabel: 'Latest 12 complete months',
    totalRevenue,
    recurringRevenue: null,
    projectRevenue: null,
    recurringRevenuePercent: null,
    projectRevenuePercent: null,
    services
  };
}
