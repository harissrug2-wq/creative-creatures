(async () => {
  const root = document.getElementById('scorecardRoot');
  const state = window.CCDiagnostic?.getState?.();
  const esc = window.CCReports.esc;
  let model = null;
  let databaseError = null;

  try {
    model = await window.CCScorecard?.load?.({ fresh: true });
  } catch (error) {
    databaseError = error;
    // Existing completed users may have generated the Scorecard before the
    // normalized scorecards table was introduced. Backfill it once from the
    // persisted index_results rows, then use that database snapshot.
    if (state?.allComplete && state?.reportReady) {
      try {
        model = await window.CCScorecard?.generate?.();
        databaseError = null;
      } catch (generationError) {
        databaseError = generationError;
      }
    }
  }

  if (model) window.CCReports.setScorecardModel?.(model);

  if (!model && state?.reportReady) {
    // Temporary migration fallback only. New generations are always stored
    // and read from Supabase through /api/scorecard.
    model = window.CCReports.scorecard();
  }

  if (!model) {
    root.innerHTML = `<section class="scorecard-empty"><h1>Your Agency Scorecard is still locked</h1><p>Complete all three indexes and generate the diagnostic before opening any report.</p>${databaseError ? `<p>${esc(databaseError.message || 'The saved scorecard is not available yet.')}</p>` : ''}<a class="cc-btn cc-btn-primary" href="/diagnostic/">Return to Diagnostic</a></section>`;
    return;
  }
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
  const rockCandidates = {};
  const issueSource = Array.isArray(model.issues) && model.issues.length
    ? model.issues
    : model.weakest.map(row => ({ capability: row.name, index: row.index, indexTitle: row.indexTitle, score: row.score, description: `${row.indexTitle} is below the other measured capabilities and should be validated before the next planning cycle.` }));
  const opportunitySource = Array.isArray(model.opportunities) && model.opportunities.length
    ? model.opportunities
    : model.weakest.map(row => ({ capability: row.name, index: row.index, indexTitle: row.indexTitle, score: row.score, recommendation: model.reports[row.index]?.recommendation, estimatedLift: Math.max(1, Math.round((100-row.score)*.18)) }));
  const issueRows = issueSource.map((row,index) => {
    const id=`issue-${index}`;
    rockCandidates[id]={title:row.capability,description:row.description};
    return `<label class="insight-row selectable-insight"><input type="checkbox" data-rock-candidate="${id}"><span><b>${esc(row.capability)} · ${row.score}/100</b><p>${esc(row.description)}</p></span></label>`;
  }).join('');
  const opportunityRows = opportunitySource.map((row,index) => {
    const id=`opportunity-${index}`;
    rockCandidates[id]={title:row.capability,description:row.recommendation};
    return `<label class="insight-row opportunity-row selectable-insight"><input type="checkbox" data-rock-candidate="${id}"><i>${index+1}</i><div><b>${esc(row.capability)}</b><p>${esc(row.recommendation)}</p></div><em>+${row.estimatedLift} pts</em></label>`;
  }).join('');
  const perf = model.reports.performance;
  root.innerHTML = `
    <header class="scorecard-header"><div><span class="eyebrow">✣ Owner briefing</span><h1>Agency Scorecard</h1><p>Executive view of the Agency Owner Freedom Index, three index reports, confidence, validation, and the highest-return next moves.</p></div><div class="scorecard-meta">Archetype · <strong>${esc(model.archetype)}</strong><br>Generated · <strong>${model.generatedAt ? new Date(model.generatedAt).toLocaleDateString() : 'Today'}</strong></div></header>
    <div class="section-title"><div><div class="section-kicker">Section 01</div><h2>Executive Summary</h2></div><p>The headline index uses the supplied 40 / 40 / 20 scoring formula.</p></div>
    <section class="aofi-card">
      <div class="aofi-main"><div class="aofi-label">Agency Owner Freedom Index™</div><div class="aofi-score-row"><strong class="aofi-score">${model.score}</strong><span class="band-pill">${esc(model.band.label)}</span></div><p class="aofi-copy">${esc(model.band.meaning)} The score combines Performance, Strength, and Owner Independence. Confidence is weighted using the same formula, and validation inherits the weakest index status.</p><div class="aofi-stats"><div class="aofi-stat"><span>Overall confidence</span><strong>${model.confidence}%</strong></div><div class="aofi-stat"><span>Validation</span><strong>${esc(model.validation)}</strong></div><div class="aofi-stat"><span>Momentum</span><strong>Baseline</strong></div></div></div>
      <aside class="aofi-side"><div><div class="formula">AOFI formula<strong>Performance × 40% + Strength × 40% + Independence × 20%</strong></div><div class="priority-box"><span>Highest-return next move</span><h3>${esc(model.weakest[0]?.name || 'Validate the evidence')}</h3><p>${esc(model.reports[model.weakest[0]?.index || 'strength'].recommendation)}</p><button class="create-single-rock" id="createSingleRock" type="button">Create 90 Day Rock</button></div></div><div class="report-actions"><button class="report-action primary" data-download="scorecard">${actionIcon('download')} Download scorecard</button><button class="report-action" data-email="scorecard">${actionIcon('email')} Email scorecard</button></div></aside>
    </section>
    <div class="section-title"><div><div class="section-kicker">Section 02</div><h2>Three Index Reports</h2></div><p>Reports appear here only after all three indexes are complete and generated.</p></div>
    <section class="index-grid">${cards}</section>
    <div class="section-title"><div><div class="section-kicker">Section 03</div><h2>Issues &amp; Opportunities</h2></div><p>Prioritized from the lowest-scoring capabilities across all three indices.</p></div>
    <section class="insight-grid"><article class="insight-card"><h3>Key issues</h3><div class="insight-list">${issueRows}</div></article><article class="insight-card"><h3>Biggest opportunities</h3><div class="insight-list">${opportunityRows}</div></article></section><div class="rock-actions"><span id="rockSelectionNote">Select one or more issues or opportunities.</span><button class="create-rocks-btn" id="createSelectedRocks" type="button">Create 90 Day Rock(s)</button></div>
    <div class="section-title"><div><div class="section-kicker">Section 04</div><h2>Agency Valuation</h2></div><p>Only source-supported values are displayed.</p></div>
    <section class="valuation-note"><div><h3>Adjusted Seller Discretionary Earnings</h3><p>The Performance assessment calculates Adjusted SDE from the submitted net income, owner compensation, and eligible add-backs. The supplied scoring documents do not define a complete enterprise-value multiple formula, so the platform does not fabricate a valuation.</p></div><strong>${money(perf.adjustedSDE)}<small>${perf.roicLite === null ? 'ROIC-Lite unavailable' : `ROIC-Lite ${Number(perf.roicLite).toFixed(1)}%`}</small></strong></section><div class="define-goals-wrap"><a class="define-goals-cta" href="/agency-goals/">Define Agency Goals →</a></div>`;
  const saveRocks = candidates => {
    if(!candidates.length) return 0;
    let rocks=[];try{rocks=JSON.parse(localStorage.getItem('agencyRocks')||'[]')}catch{}
    let added=0;
    candidates.forEach(candidate=>{if(!candidate||rocks.some(rock=>String(rock.title).toLowerCase()===String(candidate.title).toLowerCase()))return;rocks.push({title:candidate.title,description:candidate.description,owner:'Agency Owner',due:'This quarter',status:'Not started',createdAt:new Date().toISOString(),source:'agency-scorecard'});added+=1;});
    localStorage.setItem('agencyRocks',JSON.stringify(rocks));return added;
  };
  root.querySelectorAll('[data-rock-candidate]').forEach(input=>input.addEventListener('change',()=>input.closest('.selectable-insight')?.classList.toggle('selected',input.checked)));
  root.querySelector('#createSelectedRocks')?.addEventListener('click',event=>{const chosen=[...root.querySelectorAll('[data-rock-candidate]:checked')].map(input=>rockCandidates[input.dataset.rockCandidate]);const note=root.querySelector('#rockSelectionNote');if(!chosen.length){note.textContent='Select at least one issue or opportunity first.';return;}const added=saveRocks(chosen);note.textContent=added?`${added} 90 Day Rock${added===1?'':'s'} added to Agency Goals.`:'Those items are already in Agency Goals.';event.currentTarget.textContent='Created ✓';setTimeout(()=>event.currentTarget.textContent='Create 90 Day Rock(s)',1500);});
  root.querySelector('#createSingleRock')?.addEventListener('click',event=>{const first=model.weakest[0],report=model.reports[first?.index||'strength'];const added=saveRocks([{title:first?.name||'Validate the evidence',description:report.recommendation}]);event.currentTarget.textContent=added?'90 Day Rock Created ✓':'Already Added';});

  root.querySelectorAll('[data-download]').forEach(button => button.addEventListener('click', () => window.CCReports.downloadReport(button.dataset.download)));
  root.querySelectorAll('[data-email]').forEach(button => button.addEventListener('click', () => window.CCReports.openEmailDialog(button.dataset.email)));
})();
