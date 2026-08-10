(() => {
  const root = document.getElementById('scorecardRoot');
  const state = window.CCDiagnostic?.getState?.();
  if (!state?.reportReady) {
    root.innerHTML = `<section class="scorecard-empty"><h1>Your Agency Scorecard is still locked</h1><p>Complete all three indexes and generate the diagnostic before opening any report.</p><a class="cc-btn cc-btn-primary" href="/diagnostic/">Return to Diagnostic</a></section>`;
    return;
  }
  const esc = window.CCReports.esc;
  const model = window.CCReports.scorecard();
  const reportOrder = ['performance','strength','independence'];
  const colors = {performance:'#2e35e8',strength:'#e4a20d',independence:'#e35252'};
  const actionIcon = type => type === 'download'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;
  const money = value => Number.isFinite(Number(value)) ? `$${Math.round(Number(value)).toLocaleString()}` : 'Not supplied';
  const cards = reportOrder.map(id => {
    const report = model.reports[id];
    return `<article class="index-report-card">
      <div class="index-top">
        <div class="score-ring" style="--score:${report.score};--ring:${colors[id]}"><strong>${report.score}</strong></div>
        <div class="index-heading"><small>Generated report</small><h3>${esc(report.title)}</h3><p>${esc(report.executiveQuestion)}</p></div>
      </div>
      <div class="index-chips"><span class="index-chip">${report.confidence}% confidence</span><span class="index-chip">${esc(report.validation)}</span><span class="index-chip">${report.categories.length} capabilities</span></div>
      <p class="index-summary">${esc(report.narrative)}</p>
      <div class="constraint"><span>Primary constraint</span><p>${esc(report.primaryConstraint)}</p><a class="card-link" href="/agency-scorecard/${id}/">Open full report →</a></div>
      <div class="card-actions"><button type="button" data-download="${id}">${actionIcon('download')} Download report</button><button type="button" data-email="${id}">${actionIcon('email')} Email report</button></div>
    </article>`;
  }).join('');
  const issueRows = model.weakest.map(row => `<div class="insight-row"><b>${esc(row.name)} · ${row.score}/100</b><p>${esc(row.indexTitle)} is below the other measured capabilities and should be validated before the next planning cycle.</p></div>`).join('');
  const opportunityRows = model.weakest.map((row,index) => {
    const report = model.reports[row.index];
    return `<div class="insight-row opportunity-row"><i>${index+1}</i><div><b>${esc(row.name)}</b><p>${esc(report.recommendation)}</p></div><em>+${Math.max(1,Math.round((100-row.score)*.18))} pts</em></div>`;
  }).join('');
  const perf = model.reports.performance;
  root.innerHTML = `
    <header class="scorecard-header"><div><span class="eyebrow">✣ Owner briefing</span><h1>Agency Scorecard</h1><p>Executive view of the Agency Owner Freedom Index, three index reports, confidence, validation, and the highest-return next moves.</p></div><div class="scorecard-meta">Archetype · <strong>${esc(model.archetype)}</strong><br>Generated · <strong>${model.generatedAt ? new Date(model.generatedAt).toLocaleDateString() : 'Today'}</strong></div></header>
    <div class="section-title"><div><div class="section-kicker">Section 01</div><h2>Executive Summary</h2></div><p>The headline index uses the supplied 40 / 40 / 20 scoring formula.</p></div>
    <section class="aofi-card">
      <div class="aofi-main"><div class="aofi-label">Agency Owner Freedom Index™</div><div class="aofi-score-row"><strong class="aofi-score">${model.score}</strong><span class="band-pill">${esc(model.band.label)}</span></div><p class="aofi-copy">${esc(model.band.meaning)} The score combines Performance, Strength, and Owner Independence. Confidence is weighted using the same formula, and validation inherits the weakest index status.</p><div class="aofi-stats"><div class="aofi-stat"><span>Overall confidence</span><strong>${model.confidence}%</strong></div><div class="aofi-stat"><span>Validation</span><strong>${esc(model.validation)}</strong></div><div class="aofi-stat"><span>Momentum</span><strong>Baseline</strong></div></div></div>
      <aside class="aofi-side"><div><div class="formula">AOFI formula<strong>Performance × 40% + Strength × 40% + Independence × 20%</strong></div><div class="priority-box"><span>Highest-return next move</span><h3>${esc(model.weakest[0]?.name || 'Validate the evidence')}</h3><p>${esc(model.reports[model.weakest[0]?.index || 'strength'].recommendation)}</p></div></div><div class="report-actions"><button class="report-action primary" data-download="scorecard">${actionIcon('download')} Download scorecard</button><button class="report-action" data-email="scorecard">${actionIcon('email')} Email scorecard</button></div></aside>
    </section>
    <div class="section-title"><div><div class="section-kicker">Section 02</div><h2>Three Index Reports</h2></div><p>Reports appear here only after all three indexes are complete and generated.</p></div>
    <section class="index-grid">${cards}</section>
    <div class="section-title"><div><div class="section-kicker">Section 03</div><h2>Issues &amp; Opportunities</h2></div><p>Prioritized from the lowest-scoring capabilities across all three indices.</p></div>
    <section class="insight-grid"><article class="insight-card"><h3>Key issues</h3><div class="insight-list">${issueRows}</div></article><article class="insight-card"><h3>Biggest opportunities</h3><div class="insight-list">${opportunityRows}</div></article></section>
    <div class="section-title"><div><div class="section-kicker">Section 04</div><h2>Financial Evidence &amp; Valuation</h2></div><p>Only source-supported values are displayed.</p></div>
    <section class="valuation-note"><div><h3>Adjusted Seller Discretionary Earnings</h3><p>The Performance assessment calculates Adjusted SDE from the submitted net income, owner compensation, and eligible add-backs. The supplied scoring documents do not define a complete enterprise-value multiple formula, so the platform does not fabricate a valuation.</p></div><strong>${money(perf.adjustedSDE)}<small>${perf.roicLite === null ? 'ROIC-Lite unavailable' : `ROIC-Lite ${Number(perf.roicLite).toFixed(1)}%`}</small></strong></section>`;
  root.querySelectorAll('[data-download]').forEach(button => button.addEventListener('click', () => window.CCReports.downloadReport(button.dataset.download)));
  root.querySelectorAll('[data-email]').forEach(button => button.addEventListener('click', () => window.CCReports.openEmailDialog(button.dataset.email)));
})();
