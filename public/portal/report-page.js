(() => {
  const root = document.getElementById('reportRoot');
  const index = document.documentElement.dataset.reportIndex;
  const state = window.CCDiagnostic?.getState?.();
  if (!state?.reportReady) {
    root.innerHTML = `<section class="report-locked"><h1>This report is not available yet</h1><p>All three index assessments must be completed and the diagnostic must be generated first.</p><a class="cc-btn cc-btn-primary" href="/diagnostic/">Return to Diagnostic</a></section>`;
    return;
  }
  const report = window.CCReports.reports()[index];
  if (!report) { location.replace('/agency-scorecard/'); return; }
  const esc = window.CCReports.esc;
  const money = value => value === null ? 'Not available' : `$${Math.round(Number(value)).toLocaleString()}`;
  const categories = report.categories.map(category => `<div class="category-row"><span>${esc(category.name)} <small>· ${category.weight}%</small></span><div class="category-bar"><i style="--value:${category.score}%"></i></div><strong>${category.score}</strong></div>`).join('');
  const evidence = report.evidence.map(value => `<div>✓ ${esc(value)}</div>`).join('');
  const missing = report.missingEvidence.map(value => `<div>○ ${esc(value)}</div>`).join('');
  document.title = `${report.title} · Creative Creatures`;
  root.innerHTML = `<a class="report-back" href="/agency-scorecard/">← Back to Agency Scorecard</a>
    <header class="report-hero"><div><span class="report-eyebrow">Generated index report</span><h1>${esc(report.title)}</h1><p>${esc(report.executiveQuestion)}</p></div><div class="report-score" style="--score:${report.score}"><div><strong>${report.score}</strong><span>out of 100</span></div></div></header>
    <div class="report-toolbar"><button class="primary" id="downloadReport">Download report</button><button id="emailReport">Email report</button></div>
    <section class="report-summary"><div><h2>Executive narrative</h2><p>${esc(report.narrative)}</p><div class="report-callout"><small>Primary constraint</small><h3>${esc(report.primaryConstraint)}</h3><p>${esc(report.recommendation)}</p></div>${index === 'performance' ? `<div class="report-financial"><div><span>Adjusted SDE</span><strong>${money(report.adjustedSDE)}</strong></div><div><span>ROIC-Lite</span><strong>${report.roicLite === null ? 'Not available' : `${Number(report.roicLite).toFixed(1)}%`}</strong></div></div>` : ''}</div><div class="report-metrics"><div class="report-metric"><span>Score</span><strong>${report.score}/100</strong></div><div class="report-metric"><span>Confidence</span><strong>${report.confidence}%</strong></div><div class="report-metric"><span>Validation</span><strong>${esc(report.validation)}</strong></div><div class="report-metric"><span>Evidence level</span><strong>${esc(report.evidenceLevel || 'Questionnaire hypothesis')}</strong></div></div></section>
    <div class="report-grid"><section class="report-section"><h2>Capability scores</h2><div class="category-list">${categories}</div><p class="source-note">${esc(report.sourceNote)}</p></section><section class="report-section"><h2>Evidence used</h2><div class="evidence-list">${evidence || '<div>Questionnaire responses</div>'}</div><h2 style="margin-top:18px">Missing or unverified evidence</h2><div class="evidence-list missing">${missing || '<div>No missing evidence recorded</div>'}</div></section></div>`;
  document.getElementById('downloadReport').addEventListener('click', () => window.CCReports.downloadReport(index));
  document.getElementById('emailReport').addEventListener('click', () => window.CCReports.openEmailDialog(index));
})();
