(async () => {
  const releasePageLoader = window.CCPageLoader?.hold?.('Loading Agency Scorecard…') || (()=>{});
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
    releasePageLoader();
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
  let existingRockKeys = new Set();
  try {
    const goalsModel = await window.CCGoals?.load?.({ fresh: true });
    existingRockKeys = new Set((goalsModel?.rocks || []).map(rock => rock.sourceKey).filter(Boolean));
  } catch (_) {
    // Scorecard remains usable if Goals cannot be loaded; create_rocks still
    // enforces account_id + source_key uniqueness server-side.
  }
  const issueSource = Array.isArray(model.issues) && model.issues.length
    ? model.issues
    : model.weakest.map(row => ({ capability: row.name, index: row.index, indexTitle: row.indexTitle, score: row.score, description: `${row.indexTitle} is below the other measured capabilities and should be validated before the next planning cycle.` }));
  const opportunitySource = Array.isArray(model.opportunities) && model.opportunities.length
    ? model.opportunities
    : model.weakest.map(row => ({ capability: row.name, index: row.index, indexTitle: row.indexTitle, score: row.score, recommendation: model.reports[row.index]?.recommendation, estimatedLift: Math.max(1, Math.round((100-row.score)*.18)) }));
  const issueRows = issueSource.map((row,index) => {
    const id=`issue-${index}`;
    rockCandidates[id]={title:row.capability,description:row.description,sourceType:'issue',sourceKey:`issue:${row.index||'index'}:${String(row.capability||'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`};
    const exists=existingRockKeys.has(rockCandidates[id].sourceKey);
    return `<label class="insight-row selectable-insight${exists?' selected':''}"><input type="checkbox" data-rock-candidate="${id}" ${exists?'disabled':''}><span><b>${esc(row.capability)} · ${row.score}/100</b><p>${esc(row.description)}</p>${exists?'<small>Already a 90-Day Rock</small>':''}</span></label>`;
  }).join('');
  const opportunityRows = opportunitySource.map((row,index) => {
    const id=`opportunity-${index}`;
    rockCandidates[id]={title:row.capability,description:row.recommendation,sourceType:'opportunity',sourceKey:`opportunity:${row.index||'index'}:${String(row.capability||'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`};
    const exists=existingRockKeys.has(rockCandidates[id].sourceKey);
    return `<label class="insight-row opportunity-row selectable-insight${exists?' selected':''}"><input type="checkbox" data-rock-candidate="${id}" ${exists?'disabled':''}><i>${index+1}</i><div><b>${esc(row.capability)}</b><p>${esc(row.recommendation)}</p>${exists?'<small>Already a 90-Day Rock</small>':''}</div><em>+${row.estimatedLift} pts</em></label>`;
  }).join('');
  const perf = model.reports.performance;
  const valuation = model.valuation && typeof model.valuation === 'object' ? model.valuation : null;
  const valuationGapCopy = Array.isArray(valuation?.evidenceGaps) && valuation.evidenceGaps.length
    ? `<small style="display:block;margin-top:8px;color:#7a8493">Provisional adjustment: ${esc(valuation.evidenceGaps.join(', '))} not yet measured, so those missing adjustments are held at 0.00× rather than blocking the estimate.</small>`
    : '';
  const valuationHtml = valuation?.available
    ? `<section class="valuation-note"><div><h3>Estimated Enterprise Value</h3><p>Adjusted SDE ${money(valuation.adjustedSDE)} × ${Number(valuation.finalMultiple).toFixed(2)}×. Multiple: ${Number(valuation.baseMultiple).toFixed(2)}× base, ${Number(valuation.adjustments?.strength || 0) >= 0 ? '+' : ''}${Number(valuation.adjustments?.strength || 0).toFixed(2)} Strength, ${Number(valuation.adjustments?.ownerIndependence || 0) >= 0 ? '+' : ''}${Number(valuation.adjustments?.ownerIndependence || 0).toFixed(2)} Owner Independence, ${Number(valuation.adjustments?.roicLite || 0) >= 0 ? '+' : ''}${Number(valuation.adjustments?.roicLite || 0).toFixed(2)} ROIC-Lite, ${Number(valuation.adjustments?.revenueQuality || 0) >= 0 ? '+' : ''}${Number(valuation.adjustments?.revenueQuality || 0).toFixed(2)} Revenue Quality.</p>${valuationGapCopy}</div><strong>${money(valuation.enterpriseValue)}<small>${Number(valuation.finalMultiple).toFixed(2)}× Adjusted SDE</small></strong></section>`
    : `<section class="valuation-note"><div><h3>Enterprise Valuation needs more evidence</h3><p>${esc((valuation?.missingInputs || ['Approved valuation inputs']).join(', '))}. The platform leaves valuation blank until the approved methodology can be applied end to end.</p></div><strong>Not available<small>${perf.adjustedSDE === null ? 'Adjusted SDE unavailable' : `Adjusted SDE ${money(perf.adjustedSDE)}`}</small></strong></section>`;
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
    <div class="section-title"><div><div class="section-kicker">Section 04</div><h2>Agency Valuation</h2></div><p>Calculated from the approved Agency Valuation™ methodology and current diagnostic evidence.</p></div>
    ${valuationHtml}<div class="define-goals-wrap"><a class="define-goals-cta" href="/agency-goals/">Define Agency Goals →</a></div>`;
  const saveRocks = async candidates => {
    if (!candidates.length) return { added: 0 };
    const dueDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!window.CCGoals?.createRocks) throw new Error('Agency Goals persistence is unavailable.');
    return window.CCGoals.createRocks(candidates.map(candidate => ({
      ...candidate,
      owner: 'Agency Owner',
      due: 'This quarter',
      dueDate,
      status: 'Not started'
    })));
  };
  root.querySelectorAll('[data-rock-candidate]').forEach(input=>input.addEventListener('change',()=>input.closest('.selectable-insight')?.classList.toggle('selected',input.checked)));
  root.querySelector('#createSelectedRocks')?.addEventListener('click',async event=>{
    const chosen=[...root.querySelectorAll('[data-rock-candidate]:checked')].map(input=>rockCandidates[input.dataset.rockCandidate]);
    const note=root.querySelector('#rockSelectionNote');
    if(!chosen.length){note.textContent='Select at least one issue or opportunity first.';return;}
    const button=event.currentTarget;
    button.disabled=true;
    try {
      const result=await saveRocks(chosen);
      const added=Number(result?.added||0);
      note.textContent=added?`${added} 90 Day Rock${added===1?'':'s'} added to Agency Goals.`:'Those items are already in Agency Goals.';
      button.textContent='Created ✓';
      root.querySelectorAll('[data-rock-candidate]:checked').forEach(input=>{
        const candidate=rockCandidates[input.dataset.rockCandidate];
        if(candidate?.sourceKey) existingRockKeys.add(candidate.sourceKey);
        input.checked=false;
        input.disabled=true;
        const row=input.closest('.selectable-insight');
        row?.classList.add('selected');
        const holder=row?.querySelector('span,div');
        if(holder && !holder.querySelector('small')) holder.insertAdjacentHTML('beforeend','<small>Already a 90-Day Rock</small>');
      });
    } catch(error) {
      note.textContent=error.message||'The 90 Day Rocks could not be saved.';
    } finally {
      setTimeout(()=>{button.textContent='Create 90 Day Rock(s)';button.disabled=false;},1500);
    }
  });
  root.querySelector('#createSingleRock')?.addEventListener('click',async event=>{
    const first=model.weakest[0],report=model.reports[first?.index||'strength'];
    const button=event.currentTarget;
    button.disabled=true;
    try {
      const key=String(first?.name||'validate-evidence').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      const result=await saveRocks([{title:first?.name||'Validate the evidence',description:report.recommendation,sourceType:'priority',sourceKey:`priority:${first?.index||'strength'}:${key}`}]);
      button.textContent=Number(result?.added||0)?'90 Day Rock Created ✓':'Already Added';
    } catch(error) {
      button.textContent='Could not save';
    } finally {
      setTimeout(()=>{button.textContent='Create 90 Day Rock';button.disabled=false;},1600);
    }
  });

  root.querySelectorAll('[data-download]').forEach(button => button.addEventListener('click', () => window.CCReports.downloadReport(button.dataset.download)));
  root.querySelectorAll('[data-email]').forEach(button => button.addEventListener('click', () => window.CCReports.openEmailDialog(button.dataset.email)));
  requestAnimationFrame(()=>requestAnimationFrame(releasePageLoader));
})();
