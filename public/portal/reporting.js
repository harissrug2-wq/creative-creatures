(() => {
  const safeJson = (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } };
  const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const account = () => window.CCAccount?.getAccount?.() || safeJson(localStorage.getItem('cc_account'), {}) || {};
  const ownerReport = () => safeJson(localStorage.getItem('ownerArchetypeReportData'), {}) || {};
  const state = () => window.CCDiagnostic?.getState?.() || { indexes:{} };
  const validationRank = { 'Verified': 0, 'Needs Validation': 1, 'Significant Contradiction': 2 };

  const AOFI_BANDS = [
    [90, 'Freedom Optimized', 'Highly valuable, scalable, founder-independent.'],
    [80, 'High Performing', 'Strong agency with targeted opportunities.'],
    [70, 'Growth Ready', 'Healthy business with clear capability gaps.'],
    [60, 'Developing', 'Operational improvements required before scaling.'],
    [50, 'Founder Dependent', 'Business relies heavily on founder and inconsistent systems.'],
    [0, 'At Risk', 'Significant operational and financial constraints.']
  ];
  const aofiBand = score => {
    const row = AOFI_BANDS.find(([min]) => score >= min) || AOFI_BANDS[AOFI_BANDS.length - 1];
    return { label: row[1], meaning: row[2] };
  };

  const strengthCategoryNames = {
    leadership: 'Leadership System', operating: 'Operating System', financial: 'Financial Infrastructure',
    revenue: 'Revenue Infrastructure', people: 'People Infrastructure'
  };
  const strengthRecommendations = {
    leadership: 'Clarify the accountability chart, install a weekly leadership cadence, and move KPI ownership to leaders.',
    operating: 'Document core delivery, install QA ownership, and test whether SOPs survive employee turnover.',
    financial: 'Tighten monthly close, budget-versus-actual review, forecasting, and departmental KPI ownership.',
    revenue: 'Standardize CRM use, sales process, lead response, marketing cadence, and RevOps ownership.',
    people: 'Formalize hiring, onboarding, reviews, career paths, incentives, and succession coverage.'
  };
  const independenceCategoryNames = {
    decision: 'Decision Independence', revenue: 'Revenue Independence', delivery: 'Delivery Independence',
    leadership: 'Leadership Independence', strategic: 'Strategic Independence'
  };
  const independenceRecommendations = {
    decision: 'Transfer recurring approvals into documented decision rights owned by the leadership team.',
    revenue: 'Move pipeline, referrals, and marketing ownership away from the founder and into a measurable revenue system.',
    delivery: 'Detach the owner from project delivery, client communication, approvals, and fulfillment quality.',
    leadership: 'Make leaders responsible for meetings, planning, departmental accountability, and problem solving.',
    strategic: 'Shift owner time from operations and firefighting toward vision, strategy, coaching, and capital allocation.'
  };
  const performanceCategoryNames = {
    profitability: 'Profitability', growth: 'Growth Performance', revenueQuality: 'Revenue Quality',
    cash: 'Cash Performance', capital: 'Capital Allocation'
  };
  const performanceRecommendations = {
    profitability: 'Improve gross margin, net margin, SDE margin, margin stability, gross profit growth, and profit conversion.',
    growth: 'Build consistent, predictable revenue and net-income growth rather than relying on volatile spikes.',
    revenueQuality: 'Increase recurring revenue, reduce client concentration, diversify revenue, and extend client tenure and contracts.',
    cash: 'Build cash reserves, improve operating cash flow, strengthen the current ratio, accelerate collections, and reduce leverage.',
    capital: 'Track reinvestment, ROIC-Lite, technology and talent returns, and retained earnings growth.'
  };

  const normalizeValidation = value => ['Verified','Needs Validation','Significant Contradiction'].includes(value) ? value : 'Needs Validation';
  const pickWorstValidation = reports => reports.reduce((worst, report) => validationRank[normalizeValidation(report.validation)] > validationRank[worst] ? normalizeValidation(report.validation) : worst, 'Verified');
  const sortedCategories = categories => Object.entries(categories || {}).map(([key, value]) => ({ key, score: clamp(value?.categoryScore ?? value?.score ?? value), name: value?.name || key })).sort((a,b)=>a.score-b.score);

  function strengthReport() {
    const item = state().indexes?.strength || {};
    const details = item.details || safeJson(localStorage.getItem('ccIndexStrengthResult'), {}) || {};
    const result = details.results || details || {};
    const categories = result.categoryScores || {};
    const ordered = sortedCategories(Object.fromEntries(Object.entries(categories).map(([key,score])=>[key,{score,name:strengthCategoryNames[key]}])));
    const weakest = ordered[0] || { key:'operating', name:'Operating System', score:0 };
    const confidence = clamp(result.confidenceScore ?? 60);
    const validation = normalizeValidation(result.validationStatus);
    return {
      id:'strength', title:'Agency Strength Index', score: clamp(item.score ?? result.overallScore),
      executiveQuestion:'Can this business continue performing if it doubled in size over the next 24 months?',
      confidence, validation,
      narrative:`The agency scored ${clamp(item.score ?? result.overallScore)} across five equally weighted infrastructure systems. ${weakest.name} is the lowest-scoring capability at ${weakest.score}. The questionnaire is an initial operating hypothesis; connected evidence is still required to verify that the systems work under stress.`,
      categories: ordered.map(row=>({name:row.name,score:row.score,weight:20})),
      primaryConstraint:`${weakest.name} is the current structural constraint.`,
      recommendation:strengthRecommendations[weakest.key],
      evidence:['31-step questionnaire','Five category scores','Agency Scale Test'],
      missingEvidence:['SOP library and usage','Leadership meeting cadence','KPI review history','Project-management telemetry','HR and training records'],
      sourceNote:'Scoring: five category scores, each calculated from 6 questions x 4 points and averaged equally.'
    };
  }

  function independenceReport() {
    const item = state().indexes?.independence || {};
    const details = item.details || safeJson(localStorage.getItem('ccIndexIndependenceResult'), {}) || {};
    const result = details.scores || details || {};
    const categoryDetails = result.categoryDetails || {};
    const ordered = sortedCategories(Object.fromEntries(Object.entries(categoryDetails).map(([key,value])=>[key,{...value,name:independenceCategoryNames[key]}])));
    const weakest = ordered[0] || { key:'decision', name:'Decision Independence', score:0 };
    return {
      id:'independence', title:'Owner Independence Index', score:clamp(item.score ?? result.overallIndexScore),
      executiveQuestion:'Can this business succeed without its founder?',
      confidence:clamp(result.confidenceScore ?? details.confidenceScore ?? 60),
      validation:normalizeValidation(result.validationStatus || details.validationStatus),
      narrative:`The index measures whether decisions, revenue, delivery, leadership, and strategic activity continue without the owner. ${weakest.name} is the lowest-scoring category at ${weakest.score}. Questionnaire responses establish the hypothesis; calendar, CRM, email, Slack, and financial evidence should validate actual behavior.`,
      categories:ordered.map(row=>({name:row.name,score:row.score,weight:20})),
      primaryConstraint:`${weakest.name} creates the strongest founder-dependence signal.`,
      recommendation:independenceRecommendations[weakest.key],
      evidence:['Owner Independence questionnaire','Five category scores','90-day absence validation question'],
      missingEvidence:['Calendar and meeting ownership','CRM and pipeline activity','Client communication ownership','Email and Slack decision patterns'],
      sourceNote:'Scoring: five category scores averaged equally. The final 90-day absence question validates consistency and confidence.'
    };
  }

  function performanceReport() {
    const item = state().indexes?.performance || {};
    const details = item.details || safeJson(localStorage.getItem('ccIndexPerformanceResult'), {}) || {};
    const categories = details.categoryScores || {};
    const ordered = sortedCategories(Object.fromEntries(Object.entries(categories).map(([key,value])=>[key,{score:value,name:performanceCategoryNames[key]}])));
    const weakest = ordered[0] || {key:'profitability',name:'Profitability',score:0};
    const evidence = details.evidence || {};
    const uploaded = Array.isArray(evidence.files) ? evidence.files : [];
    const evidenceNames = uploaded.map(file=>file.label || file.type || file.name).filter(Boolean);
    const adjustedSDE = Number(details.adjustedSDE);
    const roic = Number(details.roicLite);
    return {
      id:'performance', title:'Agency Performance Index', score:clamp(item.score ?? details.overallScore),
      executiveQuestion:'How effectively does agency management convert revenue into long-term financial value?',
      confidence:clamp(details.confidenceScore ?? 45),
      validation:normalizeValidation(details.validationStatus),
      narrative:`The performance score combines Profitability (25%), Growth (20%), Revenue Quality (20%), Cash Performance (20%), and Capital Allocation (15%). ${weakest.name} is the lowest-scoring capability at ${weakest.score}. Confidence rises only as financial evidence is supplied.`,
      categories:ordered.map(row=>({name:row.name,score:row.score,weight:{profitability:25,growth:20,revenueQuality:20,cash:20,capital:15}[row.key]})),
      primaryConstraint:`${weakest.name} is the largest financial-value constraint.`,
      recommendation:performanceRecommendations[weakest.key],
      evidence:evidenceNames.length ? evidenceNames : ['Questionnaire inputs only'],
      missingEvidence:details.missingEvidence || ['P&L','Balance Sheet','Cash Flow','Client revenue detail','AR/AP','Budget and forecast','Owner add-backs','Investment history'],
      adjustedSDE:Number.isFinite(adjustedSDE) ? adjustedSDE : null,
      roicLite:Number.isFinite(roic) ? roic : null,
      evidenceLevel:details.evidenceLevel || 'Questionnaire only',
      sourceNote:'Scoring: five capabilities weighted 25/20/20/20/15. Confidence is driven by financial evidence level.'
    };
  }

  const reports = () => ({performance:performanceReport(),strength:strengthReport(),independence:independenceReport()});
  function scorecard() {
    const r = reports();
    const score = Math.round(r.performance.score*.40 + r.strength.score*.40 + r.independence.score*.20);
    const confidence = Math.round(r.performance.confidence*.40 + r.strength.confidence*.40 + r.independence.confidence*.20);
    const band = aofiBand(score);
    const validation = pickWorstValidation(Object.values(r));
    const categoryRows = Object.values(r).flatMap(report=>report.categories.map(category=>({...category,index:report.id,indexTitle:report.title}))).sort((a,b)=>a.score-b.score);
    const weakest = categoryRows.slice(0,5);
    const archetype = ownerReport().archetypeTitle || ownerReport().title || account()?.archetype_result?.title || 'Owner Archetype';
    return {score,confidence,band,validation,reports:r,weakest,archetype,generatedAt:state().generatedAt};
  }

  function reportLines(report) {
    const lines = [
      'CREATIVE CREATURES', report.title, '', `Executive question: ${report.executiveQuestion}`, '',
      `Index score: ${report.score}/100`, `Confidence: ${report.confidence}%`, `Validation: ${report.validation}`, '',
      'Narrative', report.narrative, '', 'Category scores'
    ];
    report.categories.forEach(category=>lines.push(`${category.name} (${category.weight}%): ${category.score}/100`));
    lines.push('', 'Primary constraint', report.primaryConstraint, '', 'Recommended next move', report.recommendation, '', 'Evidence used');
    report.evidence.forEach(value=>lines.push(`- ${value}`));
    lines.push('', 'Missing or unverified evidence');
    report.missingEvidence.forEach(value=>lines.push(`- ${value}`));
    if (report.adjustedSDE !== null) lines.push('', `Adjusted SDE: $${Math.round(report.adjustedSDE).toLocaleString()}`);
    if (report.roicLite !== null) lines.push(`ROIC-Lite: ${report.roicLite.toFixed(1)}%`);
    lines.push('', report.sourceNote, '', `Generated: ${new Date().toLocaleString()}`);
    return lines;
  }

  function scorecardLines(model) {
    const lines=['CREATIVE CREATURES','Agency Owner Freedom Index Report','',`AOFI: ${model.score}/100 - ${model.band.label}`,model.band.meaning,`Confidence: ${model.confidence}%`,`Validation: ${model.validation}`,`Owner archetype: ${model.archetype}`,'','Formula','Performance x 40% + Strength x 40% + Owner Independence x 20%',''];
    Object.values(model.reports).forEach(report=>lines.push(`${report.title}: ${report.score}/100 | Confidence ${report.confidence}% | ${report.validation}`));
    lines.push('','Highest-priority capability gaps');
    model.weakest.forEach((row,index)=>lines.push(`${index+1}. ${row.name} (${row.indexTitle}): ${row.score}/100`));
    lines.push('','Valuation note','The supplied scoring documents do not define a complete valuation multiple formula. This report does not fabricate an enterprise value.','',`Generated: ${new Date().toLocaleString()}`);
    return lines;
  }

  function wrapLine(text, max=88) {
    const words=String(text).replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7E]/g,'').split(/\s+/).filter(Boolean);
    const out=[]; let line='';
    words.forEach(word=>{const next=line?`${line} ${word}`:word;if(next.length>max&&line){out.push(line);line=word}else line=next});
    if(line) out.push(line); return out.length?out:[''];
  }
  function makePdfBytes(title, rawLines) {
    const lines=rawLines.flatMap(line=>wrapLine(line));
    const pages=[]; for(let i=0;i<lines.length;i+=47) pages.push(lines.slice(i,i+47));
    const objects=[]; const add=body=>{objects.push(body);return objects.length};
    const catalogId=add(''); const pagesId=add(''); const fontId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageIds=[];
    pages.forEach((pageLines,pageIndex)=>{
      const content=['BT','/F1 11 Tf','50 760 Td'];
      pageLines.forEach((line,index)=>{
        const safe=line.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
        if(index===0) content.push(`(${safe}) Tj`); else content.push(`0 -15 Td (${safe}) Tj`);
      });
      content.push('ET');
      const stream=content.join('\n');
      const contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });
    objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId-1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
    let pdf='%PDF-1.4\n'; const offsets=[0];
    objects.forEach((body,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${body}\nendobj\n`});
    const xref=pdf.length; pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset=>{pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`});
    pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R /Info << /Title (${String(title).replace(/[()]/g,'')}) >> >>\nstartxref\n${xref}\n%%EOF`;
    return new TextEncoder().encode(pdf);
  }
  function downloadBytes(bytes, filename) { const blob=new Blob([bytes],{type:'application/pdf'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500); }
  function downloadReport(index) {
    const model=index==='scorecard'?scorecard():reports()[index]; if(!model) return;
    const lines=index==='scorecard'?scorecardLines(model):reportLines(model);
    downloadBytes(makePdfBytes(model.title || 'Agency Scorecard',lines),`creative-creatures-${index}-report.pdf`);
  }
  function pdfBase64(index) {
    const model=index==='scorecard'?scorecard():reports()[index]; const lines=index==='scorecard'?scorecardLines(model):reportLines(model); const bytes=makePdfBytes(model.title || 'Agency Scorecard',lines);
    let binary=''; bytes.forEach(byte=>binary+=String.fromCharCode(byte)); return btoa(binary);
  }
  function textSummary(index) {
    const model=index==='scorecard'?scorecard():reports()[index]; return (index==='scorecard'?scorecardLines(model):reportLines(model)).join('\n');
  }
  async function emailReport(index, recipient) {
    const model=index==='scorecard'?scorecard():reports()[index];
    const email=String(recipient || account()?.email || localStorage.getItem('ccOwnerEmail') || '').trim();
    if(!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    try {
      const response=await fetch('/api/email-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:email,index,title:model.title || 'Agency Scorecard',summary:textSummary(index),pdfBase64:pdfBase64(index),filename:`creative-creatures-${index}-report.pdf`})});
      const payload=await response.json().catch(()=>({})); if(!response.ok) throw new Error(payload.error || 'Email delivery is not configured.'); return payload;
    } catch(error) {
      const subject=encodeURIComponent(`Creative Creatures - ${model.title || 'Agency Scorecard'}`);
      const body=encodeURIComponent(textSummary(index).slice(0,7000));
      window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
      return {fallback:true};
    }
  }

  function openEmailDialog(index) {
    let dialog=document.getElementById('ccEmailReportDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='ccEmailReportDialog';dialog.className='cc-report-dialog';dialog.innerHTML=`<form method="dialog"><button class="dialog-close" value="cancel" aria-label="Close">×</button><h2>Email report</h2><p>Send a PDF copy of this report.</p><label>Email address<input type="email" id="ccReportEmail" required></label><div class="dialog-status" id="ccReportStatus"></div><div class="dialog-actions"><button value="cancel" class="cc-btn cc-btn-light">Cancel</button><button type="button" class="cc-btn cc-btn-primary" id="ccSendReport">Send report</button></div></form>`;document.body.appendChild(dialog);}
    dialog.dataset.index=index;dialog.querySelector('#ccReportEmail').value=account()?.email || localStorage.getItem('ccOwnerEmail') || '';dialog.querySelector('#ccReportStatus').textContent='';
    dialog.querySelector('#ccSendReport').onclick=async()=>{const button=dialog.querySelector('#ccSendReport');const status=dialog.querySelector('#ccReportStatus');button.disabled=true;status.textContent='Sending...';try{const result=await emailReport(dialog.dataset.index,dialog.querySelector('#ccReportEmail').value);status.textContent=result.fallback?'Your email app has been opened.':'Report emailed.';if(!result.fallback)setTimeout(()=>dialog.close(),900)}catch(error){status.textContent=error.message}finally{button.disabled=false}};
    dialog.showModal();
  }

  window.CCReports={reports,scorecard,downloadReport,emailReport,openEmailDialog,reportLines,scorecardLines,esc,aofiBand};
})();
