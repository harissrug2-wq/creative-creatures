// Automated quarterly score snapshot generator
// Can be triggered by Vercel Cron or scheduled jobs at the end of each calendar quarter.

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
};

function getSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const secret = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!url || !secret) return null;
  return { url, secret };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.secret,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }

  if (!response.ok) {
    const error = new Error(payload?.message || 'Database request failed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function getQuarterDetails(dateInput = new Date()) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return {
    year,
    quarter,
    label: `Q${quarter} ${year}`
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const config = getSupabaseConfig();
  if (!config) return json(res, 533, { error: 'Database credentials not configured.', ok: false });

  try {
    const currentQ = getQuarterDetails();

    // Fetch active accounts with generated scorecards
    const accounts = await supabaseRequest(config, 'accounts?select=id,name,agency_name,report_data,diagnostic_state');
    if (!Array.isArray(accounts) || !accounts.length) {
      return json(res, 200, { ok: true, snapshotsCreated: 0, message: 'No accounts found.' });
    }

    let createdCount = 0;

    for (const account of accounts) {
      try {
        const runs = await supabaseRequest(config, `diagnostic_runs?select=id&account_id=eq.${account.id}&is_current=eq.true&limit=1`);
        const run = Array.isArray(runs) ? runs[0] : null;
        if (!run) continue;

        const cards = await supabaseRequest(config, `scorecards?select=*&diagnostic_run_id=eq.${run.id}&limit=1`);
        const card = Array.isArray(cards) ? cards[0] : null;
        if (!card || !card.aofi_score) continue;

        const report = card.report_data && typeof card.report_data === 'object' ? card.report_data : {};
        const snapshotRecord = {
          account_id: account.id,
          diagnostic_run_id: run.id,
          scorecard_id: card.id,
          quarter_label: currentQ.label,
          calendar_year: currentQ.year,
          calendar_quarter: currentQ.quarter,
          aofi_score: Number(card.aofi_score),
          performance_score: Number(card.performance_score || 0),
          strength_score: Number(card.strength_score || 0),
          independence_score: Number(card.independence_score || 0),
          confidence: Number(card.confidence || 0),
          validation_status: card.validation_status || 'needs_validation',
          enterprise_value: report.valuation?.available ? Number(report.valuation.enterpriseValue) : null,
          snapshot_data: report,
          updated_at: new Date().toISOString()
        };

        await supabaseRequest(config, 'scorecard_snapshots?on_conflict=account_id,calendar_year,calendar_quarter', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(snapshotRecord)
        });

        createdCount++;
      } catch (err) {
        console.warn(`Snapshot failed for account ${account.id}:`, err.message);
      }
    }

    return json(res, 200, {
      ok: true,
      quarter: currentQ.label,
      snapshotsProcessed: createdCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron snapshot error:', error);
    return json(res, 500, { error: error.message || 'Quarterly snapshot task failed.' });
  }
}
