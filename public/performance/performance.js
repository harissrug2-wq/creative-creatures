(() => {
  const sections = [
    {id:'pnl',title:'Profit & Loss',short:'P&L',type:'upload',copy:'Upload your PDF report that includes Trailing Twelve Months and Year To Date by month.',requirements:['PDF from your accounting software','Trailing Twelve Months','Year To Date shown by month']},
    {id:'balanceSheet',title:'Balance Sheet',short:'Balance Sheet',type:'upload',copy:'Upload your balance sheet PDF report that includes Trailing Twelve Months and Year To Date by month.',requirements:['PDF from your accounting software','Trailing Twelve Months','Year To Date shown by month']},
    {id:'arAgingDoc',title:'Accounts Receivable Aging Report',short:'A/R Aging',type:'upload',copy:'Upload the most recent Accounts Receivable Aging Report.',requirements:['Most recent available report','Customer balances and aging buckets','PDF format']},
    {id:'sde',title:'SDE (Seller Discretionary Earnings)',short:'SDE',type:'sde',copy:'As the agency owner, provide us with a sense of the benefits you receive from your agency. Select all that apply.'},
    {id:'clientRevenue',title:'Client Revenue Report',short:'Client Revenue',type:'upload',copy:'Upload a PDF report from your accounting software with a complete list of clients and their revenue per client over the last 12 months.',requirements:['Complete client list','Revenue per client','Latest 12 months']},
    {id:'serviceRevenue',title:'Service Revenue Mix',short:'Service Mix',type:'upload',copy:'Upload a PDF report from your accounting software with a complete list of revenue by service.',requirements:['Revenue grouped by service','Latest reporting period','PDF format']}
  ];
  const addbacks = [
    ['income','Income'],['insurance','Insurance'],['vehicle','Vehicle Expenses'],['phone','Phone'],['retirement','Retirement (401k)'],['healthcare','Medical Reimbursement or Healthcare'],['office','Office'],['distributions','Profit Distributions'],['other','Other owner benefit or one-time expense']
  ];
  const read = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
  const savedResult = read('agencyPerformanceDetails',null);
  const draft = read('agencyPerformanceDraft',{sectionIndex:0,documents:{},addbacks:{},currentSde:0,priorSde:0,ownershipPercent:'',otherText:''});
  const state = {...draft,documents:draft.documents||{},addbacks:draft.addbacks||{}};
  const app = document.querySelector('#performanceApp');
  app.innerHTML = `<div class="performance-shell"><section class="assessment-view" id="assessmentView"><header class="performance-head"><div><span class="eyebrow">Agency Performance Index</span><h1>Upload the evidence behind financial performance.</h1><p>Before financial integrations are connected, we collect the reports needed to analyze profitability, growth, revenue quality, cash performance, SDE, and agency valuation.</p></div><aside class="progress-card"><div class="progress-row"><span>Financial evidence</span><strong id="progressText">0 / 6</strong></div><div class="progress-track"><span id="progressFill"></span></div><p class="progress-caption" id="progressCaption">Complete every section to generate your Agency Scorecard.</p></aside></header><div class="performance-layout"><nav class="section-nav" id="sectionNav"></nav><section id="sectionHost"></section></div></section><section class="result-view" id="resultView"></section></div><section class="generating" id="generating"><div class="generating-card"><div class="spinner"></div><h2>Generating Your Agency Scorecard</h2><p>Our agents are analyzing your data. This usually takes under a minute. Do not navigate away from this page. We’ll take you to your Agency Scorecard in just a moment.</p></div></section>`;
  const assessment = document.querySelector('#assessmentView');
  const resultView = document.querySelector('#resultView');
  const host = document.querySelector('#sectionHost');
  const persist = () => localStorage.setItem('agencyPerformanceDraft',JSON.stringify(state));
  const fileMeta = file => ({name:file.name,size:file.size,type:file.type||'application/pdf',receivedAt:new Date().toISOString()});
  const sdeComplete = () => Boolean(state.sdeConfirmed && Number(state.currentSde) > 0);
  const complete = section => section.type === 'sde' ? sdeComplete() : Boolean(state.documents[section.id]);
  const completeCount = () => sections.filter(complete).length;
  const allComplete = () => completeCount() === sections.length;
  const escapeHtml = value => String(value||'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const formatSize = n => `${Math.max(1,Math.round((n||0)/1024))} KB`;

  function renderNav(){
    document.querySelector('#sectionNav').innerHTML = sections.map((section,index) => `<button class="section-tab ${state.sectionIndex===index?'active':''} ${complete(section)?'complete':''}" data-section="${index}"><span class="tab-number">${complete(section)?'✓':index+1}</span><span><strong>${section.short}</strong><small>${complete(section)?'Complete':'Required'}</small></span></button>`).join('');
    document.querySelectorAll('[data-section]').forEach(btn=>btn.onclick=()=>{state.sectionIndex=Number(btn.dataset.section);persist();render()});
  }
  function updateProgress(){const count=completeCount();document.querySelector('#progressText').textContent=`${count} / 6`;document.querySelector('#progressFill').style.width=`${count/6*100}%`;document.querySelector('#progressCaption').textContent=allComplete()?'All evidence sections are complete.':'Complete every section to generate your Agency Scorecard.'}
  function uploadBody(section){
    const meta=state.documents[section.id];
    return `<div class="upload-zone ${meta?'received':''}"><div><div class="upload-icon">${meta?'✓':'⇧'}</div><h3>${meta?'Report received':'Upload PDF report'}</h3><p>${section.copy}</p><label class="file-button">${meta?'Replace PDF':'Choose PDF'}<input type="file" data-file="${section.id}" accept="application/pdf,.pdf"></label>${meta?`<div class="file-meta">${escapeHtml(meta.name)} · ${formatSize(meta.size)}</div>`:''}</div></div><div class="requirements">${section.requirements.map(x=>`<div class="requirement"><i>✓</i><span>${x}</span></div>`).join('')}</div>`;
  }
  function sdeBody(){
    return `<div class="sde-grid"><section class="sde-block"><h3>Owner benefits and add-backs</h3><p>Select every benefit or discretionary item received through the agency during the last 12 months.</p><div class="check-grid">${addbacks.map(([id,label])=>`<label class="check-option"><input type="checkbox" data-addback="${id}" ${state.addbacks[id]?'checked':''}><span>${label}</span></label>`).join('')}</div><div class="field"><label>Describe any other financial benefit</label><textarea id="otherText" placeholder="Describe another owner benefit or one-time add-back">${escapeHtml(state.otherText)}</textarea></div></section><section class="sde-block"><h3>Adjusted SDE review</h3><p>Enter the adjusted SDE values that should be used for the prototype valuation calculation.</p><div class="two-fields"><div class="field"><label>Current Adjusted SDE ($)</label><input id="currentSde" type="number" min="0" step="1000" value="${state.currentSde||''}" placeholder="250000"></div><div class="field"><label>Prior-year Adjusted SDE ($)</label><input id="priorSde" type="number" min="0" step="1000" value="${state.priorSde||''}" placeholder="200000"></div></div><div class="ownership-row"><div class="field"><label>Profit distributions received</label><select id="distributionStatus"><option value="">Select one</option><option ${state.distributionStatus==='Yes'?'selected':''}>Yes</option><option ${state.distributionStatus==='No'?'selected':''}>No</option></select></div><div class="field"><label>Ownership %</label><input id="ownershipPercent" type="number" min="0" max="100" value="${state.ownershipPercent||''}" placeholder="100"></div></div><label class="check-option" style="margin-top:15px"><input type="checkbox" id="sdeConfirm" ${state.sdeConfirmed?'checked':''}><span>I confirm this SDE information is complete to the best of my knowledge.</span></label><div class="error" id="sdeError">Enter Current Adjusted SDE and confirm the information before continuing.</div></section></div>`;
  }
  function reviewBody(){
    return `<section class="review-card"><h2>Review Financial Evidence</h2><p>All six sections must be complete before the prototype can generate the Agency Scorecard.</p><div class="review-list">${sections.map(section=>`<div class="review-row"><span>${section.title}</span><strong>${complete(section)?'Complete':'Missing'}</strong></div>`).join('')}</div><div class="prototype-note"><strong>Prototype limitation:</strong> the current front end records uploads and demonstrates the workflow. Production scoring requires secure document extraction and financial analysis. The prototype uses a clearly marked sample Performance score so the complete Scorecard and Goals flow can be reviewed.</div><div class="error" id="reviewError">Complete every evidence section before generating the scorecard.</div></section>`;
  }
  function renderSection(){
    const section=sections[state.sectionIndex];
    const isReview=state.sectionIndex===sections.length;
    if(isReview){host.innerHTML=`${reviewBody()}<div class="wizard-actions"><button class="button" id="previous">Back</button><span class="save-note">Financial files remain local in this prototype</span><button class="button primary" id="generate">Generate My Agency Scorecard →</button></div>`;document.querySelector('#previous').onclick=()=>{state.sectionIndex=5;persist();render()};document.querySelector('#generate').onclick=generate;return}
    host.innerHTML=`<section class="section-card"><header class="section-card-head"><div><span class="section-kicker">Section ${state.sectionIndex+1} of 6</span><h2>${section.title}</h2><p>${section.copy}</p></div><span class="status-pill ${complete(section)?'complete':''}">${complete(section)?'Complete':'Required'}</span></header><div class="section-body">${section.type==='sde'?sdeBody():uploadBody(section)}</div></section><div class="wizard-actions"><button class="button" id="previous" ${state.sectionIndex===0?'disabled':''}>Back</button><span class="save-note">Saved automatically</span><button class="button primary" id="next">${state.sectionIndex===5?'Review & Generate':'Next Section'}</button></div>`;
    document.querySelector('#previous').onclick=()=>{state.sectionIndex=Math.max(0,state.sectionIndex-1);persist();render()};
    document.querySelector('#next').onclick=()=>{if(section.type==='sde'&&!sdeComplete()){document.querySelector('#sdeError').classList.add('show');return}state.sectionIndex=state.sectionIndex===5?6:state.sectionIndex+1;persist();render()};
    document.querySelectorAll('[data-file]').forEach(input=>input.onchange=()=>{const file=input.files?.[0];if(!file)return;state.documents[input.dataset.file]=fileMeta(file);persist();render()});
    if(section.type==='sde'){
      document.querySelectorAll('[data-addback]').forEach(input=>input.onchange=()=>{state.addbacks[input.dataset.addback]=input.checked;persist()});
      document.querySelector('#otherText').oninput=e=>{state.otherText=e.target.value;persist()};
      document.querySelector('#currentSde').oninput=e=>{state.currentSde=Math.max(0,Number(e.target.value)||0);persist();updateProgress()};
      document.querySelector('#priorSde').oninput=e=>{state.priorSde=Math.max(0,Number(e.target.value)||0);persist()};
      document.querySelector('#distributionStatus').onchange=e=>{state.distributionStatus=e.target.value;persist()};
      document.querySelector('#ownershipPercent').oninput=e=>{state.ownershipPercent=e.target.value;persist()};
      document.querySelector('#sdeConfirm').onchange=e=>{state.sdeConfirmed=e.target.checked;persist();updateProgress();renderNav()};
    }
  }
  function render(){renderNav();updateProgress();renderSection()}
  function generate(){
    if(!allComplete()){document.querySelector('#reviewError').classList.add('show');return}
    const result={score:88,confidence:40,confidenceLabel:'Prototype',validation:'yellow',provisional:true,completed:true,currentSde:Number(state.currentSde)||0,priorSde:Number(state.priorSde)||0,documents:state.documents,addbacks:state.addbacks,ownershipPercent:state.ownershipPercent,completedAt:new Date().toISOString()};
    localStorage.setItem('agencyPerformanceScore',String(result.score));
    localStorage.setItem('agencyPerformanceConfidence',String(result.confidence));
    localStorage.setItem('agencyPerformanceDetails',JSON.stringify(result));
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(state));
    document.querySelector('#generating').classList.add('show');
    setTimeout(()=>location.href='/agency-scorecard/',1700);
  }
  function showResult(details){
    details={score:Number(details?.score ?? localStorage.getItem('agencyPerformanceScore') ?? 0),confidence:Number(details?.confidence ?? localStorage.getItem('agencyPerformanceConfidence') ?? 40),confidenceLabel:details?.confidenceLabel || 'Prototype',documents:details?.documents || {},...details};
    assessment.classList.add('hidden');resultView.classList.add('show');
    resultView.innerHTML=`<header class="result-head"><span class="eyebrow">Evidence complete</span><h1>Agency Performance Analysis</h1><p>Your financial evidence is saved. This prototype displays a sample score while secure document extraction is being connected.</p></header><div class="result-grid"><section class="result-card"><div class="score-label">Prototype Agency Performance Index</div><div class="big-score">${details.score}</div><span class="rating">Sample analysis</span><div class="confidence-box">Evidence workflow <strong>Complete</strong><br>Scoring confidence <strong>${details.confidence}% · ${details.confidenceLabel}</strong></div><div class="result-actions"><button class="button primary" id="scorecardButton">View Agency Scorecard</button><button class="button" id="editEvidence">Review evidence</button></div></section><section class="result-card"><h2 style="font-size:18px;margin:0">Evidence received</h2><div class="doc-summary">${sections.map(section=>`<div><strong>${section.title}</strong><br><span>${section.type==='sde'?'Manual SDE review complete':escapeHtml(details.documents?.[section.id]?.name||'Missing')}</span></div>`).join('')}</div></section></div>`;
    document.querySelector('#scorecardButton').onclick=()=>location.href='/agency-scorecard/';
    document.querySelector('#editEvidence').onclick=()=>{resultView.classList.remove('show');assessment.classList.remove('hidden');state.sectionIndex=0;render();scrollTo(0,0)};
  }
  if(savedResult?.completed===true) showResult(savedResult); else render();
})();
