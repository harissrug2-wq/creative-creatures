(async () => {
  const root = document.getElementById('reportRoot');
  const index = document.documentElement.dataset.reportIndex;
  const state = window.CCDiagnostic?.getState?.();
  let model = null;

  try { model = await window.CCScorecard?.load?.({ fresh: true }); }
  catch {
    if (state?.allComplete && state?.reportReady) {
      try { model = await window.CCScorecard?.generate?.(); } catch { model = null; }
    }
  }

  if (model) window.CCReports.setScorecardModel?.(model);
  if (!model && !state?.reportReady) {
    root.innerHTML = '<section class="report-locked"><h1>This report is not available yet</h1><p>Complete the Diagnostic and generate your AOFI™ Score first.</p><a class="cc-btn cc-btn-primary" href="/diagnostic/">Return to Diagnostic</a></section>';
    return;
  }

  const report = window.CCReports.reports()[index];
  if (!report) { location.replace('/agency-scorecard/'); return; }

  const esc = window.CCReports.esc;
  const money = value => value === null || value === undefined ? 'Not available' : '$' + Math.round(Number(value)).toLocaleString();
  const icon = (name) => ({
    gauge:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a8 8 0 1 1 16 0"/><path d="m12 14 3-3"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6l-7-3Z"/><path d="m9.5 12 1.7 1.7 3.5-3.7"/></svg>',
    file:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></svg>'
  }[name]||'');

  const categoryRows = report.categories.map(category => `
    <div class="rp-capability-row">
      <div class="rp-capability-label"><strong>${esc(category.name)}</strong><small>${category.weight}%</small></div>
      <div class="rp-capability-track"><span style="width:${Math.max(0,Math.min(100,Number(category.score)||0))}%"></span></div>
      <b>${Math.round(Number(category.score)||0)}</b>
    </div>`).join('');

  const verifiedEvidence = (report.evidence?.length ? report.evidence : ['Questionnaire responses']).map(value => `
    <div class="rp-evidence verified"><i>✓</i><span>${esc(value)}</span></div>`).join('');
  const missingEvidence = (report.missingEvidence?.length ? report.missingEvidence : ['No missing evidence recorded']).map(value => `
    <div class="rp-evidence missing"><i>○</i><span>${esc(value)}</span></div>`).join('');

  const extraStats = index === 'performance'
    ? `<div class="rp-stat"><span>Adjusted SDE</span><strong>${money(report.adjustedSDE)}</strong></div><div class="rp-stat"><span>ROIC-Lite</span><strong>${report.roicLite==null?'Not available':Number(report.roicLite).toFixed(1)+'%'}</strong></div>`
    : `<div class="rp-stat"><span>Capabilities</span><strong>${report.categories.length}</strong></div><div class="rp-stat"><span>Confidence</span><strong>${Math.round(Number(report.confidence)||0)}%</strong></div>`;

  document.title = report.title + ' · Creative Creatures';
  root.innerHTML = `
    <a class="rp-back" href="/agency-scorecard/"><span>←</span> Back to Agency Scorecard</a>

    <header class="rp-hero">
      <div>
        <span class="rp-pill">Generated index report</span>
        <h1>${esc(report.title)}</h1>
        <p>${esc(report.executiveQuestion)}</p>
      </div>
      <div class="rp-score-ring" style="--score:${Math.max(0,Math.min(100,Number(report.score)||0))}">
        <div><strong>${Math.round(Number(report.score)||0)}</strong><span>out of 100</span></div>
      </div>
    </header>

    <section class="rp-summary-card">
      <div class="rp-summary-copy">
        <h2>Executive narrative</h2>
        <p>${esc(report.narrative)}</p>
        <div class="rp-constraint">
          <small>PRIMARY CONSTRAINT</small>
          <h3>${esc(report.primaryConstraint)}</h3>
          <p>${esc(report.recommendation)}</p>
        </div>
        <div class="rp-stat-grid">${extraStats}</div>
      </div>
      <aside class="rp-metrics">
        <div class="rp-metric">
          <div class="rp-metric-icon blue">${icon('gauge')}</div>
          <div><small>CONFIDENCE</small><strong>${Math.round(Number(report.confidence)||0)}%</strong>
          <div class="rp-confidence-track"><span style="width:${Math.max(0,Math.min(100,Number(report.confidence)||0))}%"></span></div></div>
        </div>
        <div class="rp-metric">
          <div class="rp-metric-icon green">${icon('shield')}</div>
          <div><small>VALIDATION</small><strong>${esc(report.validation||'Pending')}</strong></div>
        </div>
        <div class="rp-metric">
          <div class="rp-metric-icon green">${icon('file')}</div>
          <div><small>EVIDENCE LEVEL</small><strong>${esc(report.evidenceLevel||'Questionnaire hypothesis')}</strong></div>
        </div>
      </aside>
    </section>

    <section class="rp-lower-grid">
      <article class="rp-panel">
        <h2>Capability scores</h2>
        <div class="rp-capabilities">${categoryRows}</div>
        <p class="rp-note">${esc(report.sourceNote||'Capability scores are weighted to produce the index result. Confidence rises as evidence is validated.')}</p>
      </article>
      <article class="rp-panel">
        <div class="rp-panel-title"><h2>Evidence used</h2><span class="rp-count verified-count">${report.evidence?.length||1} verified</span></div>
        <div class="rp-evidence-grid">${verifiedEvidence}</div>
        <div class="rp-divider"></div>
        <div class="rp-panel-title"><h2>Missing or unverified evidence</h2><span class="rp-count missing-count">${report.missingEvidence?.length||0} to verify</span></div>
        <div class="rp-evidence-grid">${missingEvidence}</div>
      </article>
    </section>`;

  document.querySelectorAll('[data-download],[data-email]').forEach(()=>{});
})();