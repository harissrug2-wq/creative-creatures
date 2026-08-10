(() => {
  const sections = [
    {id:'pnl',title:'Profit & Loss',short:'P&L',type:'upload',copy:'Upload your (pdf) report that includes Trailing Twelve Months + Year To Date by Month.',requirements:['PDF report','Trailing Twelve Months','Year To Date by Month']},
    {id:'balanceSheet',title:'Balance Sheet',short:'Balance Sheet',type:'upload',copy:'Upload your balance sheet (pdf) report that includes Trailing Twelve Months + Year to Date by Month.',requirements:['PDF report','Trailing Twelve Months','Year To Date by Month']},
    {id:'arAgingDoc',title:'Accounts Receivable Aging Report',short:'A/R Aging',type:'upload',copy:'Upload the most recent Accounts Receivable Aging Report.',requirements:['Most recent Accounts Receivable Aging Report','PDF format']},
    {id:'sde',title:'SDE (Seller Discretionary Earnings)',short:'SDE',type:'sde',copy:'As the agency owner, provide us with a sense for the benefits you receive from your agency. Select all that apply.'},
    {id:'clientRevenue',title:'Client Revenue Report',short:'Client Revenue',type:'upload',copy:'Upload a (pdf) report from your accounting software of a complete list of Clients and their revenue per Client over the last 12 months.',requirements:['Complete list of Clients','Revenue per Client','Last 12 months','PDF format']},
    {id:'serviceRevenue',title:'Service Revenue Mix',short:'Service Mix',type:'upload',copy:'Upload a (pdf) report from your accounting software of a complete list of Revenue by Service.',requirements:['Complete list of Revenue by Service','PDF format']}
  ];
  const benefits = [
    ['income','Income'],['insurance','Insurance'],['vehicle','Vehicle Expenses'],['phone','Phone'],['retirement','Retirement (401k)'],['healthcare','Medical Reimbursement or Healthcare'],['office','Office'],['distributions','Profit Distributions (I am x% owner)']
  ];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const draft=read('agencyPerformanceDraft',{sectionIndex:0,documents:{},addbacks:{},sdeReviewed:false,ownershipPercent:''});
  const state={...draft,documents:draft.documents||{},addbacks:draft.addbacks||{}};
  const app=document.querySelector('#performanceApp');
  const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fileMeta=file=>({name:file.name,size:file.size,type:file.type||'application/pdf',receivedAt:new Date().toISOString()});
  const formatSize=n=>`${Math.max(1,Math.round((n||0)/1024))} KB`;
  const complete=section=>section.type==='sde'?Boolean(state.sdeReviewed):Boolean(state.documents[section.id]);
  const completeCount=()=>sections.filter(complete).length;
  const allComplete=()=>completeCount()===sections.length;
  const persist=()=>{
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(state));
    if(window.CCDiagnostic?.setProgress&&!window.CCDiagnostic.getState().performance){window.CCDiagnostic.setProgress('performance',Math.min(99,Math.round(completeCount()/sections.length*100)));}
  };
  app.innerHTML=`<div class="performance-shell"><header class="performance-head"><div><span class="eyebrow">Agency Performance Index</span><h1>Upload your financial data.</h1><p>Prior to us being able to pull data from your financial software, upload the reports below so we can analyze your agency’s financial performance.</p></div><aside class="progress-card"><div class="progress-row"><span>Financial evidence</span><strong id="progressText">0 / 6</strong></div><div class="progress-track"><span id="progressFill"></span></div><p class="progress-caption" id="progressCaption">Complete every section, then return to your Diagnostic.</p></aside></header><div class="performance-layout"><nav class="section-nav" id="sectionNav"></nav><section id="sectionHost"></section></div></div>`;
  const host=document.querySelector('#sectionHost');

  function renderNav(){
    document.querySelector('#sectionNav').innerHTML=sections.map((section,index)=>`<button class="section-tab ${state.sectionIndex===index?'active':''} ${complete(section)?'complete':''}" data-section="${index}"><span class="tab-number">${complete(section)?'✓':index+1}</span><span><strong>${section.short}</strong><small>${complete(section)?'Complete':'Required'}</small></span></button>`).join('');
    document.querySelectorAll('[data-section]').forEach(btn=>btn.onclick=()=>{state.sectionIndex=Number(btn.dataset.section);persist();render()});
  }
  function updateProgress(){const count=completeCount();document.querySelector('#progressText').textContent=`${count} / 6`;document.querySelector('#progressFill').style.width=`${count/6*100}%`;document.querySelector('#progressCaption').textContent=allComplete()?'Financial Performance analysis is ready to complete.':'Complete every section, then return to your Diagnostic.';}
  function uploadBody(section){
    const meta=state.documents[section.id];
    return `<div class="upload-zone ${meta?'received':''}"><div><div class="upload-icon">${meta?'✓':'⇧'}</div><h3>${meta?'Report received':'Upload PDF report'}</h3><p>${section.copy}</p><label class="file-button">${meta?'Replace PDF':'Choose PDF'}<input type="file" data-file="${section.id}" accept="application/pdf,.pdf"></label>${meta?`<div class="file-meta">${esc(meta.name)} · ${formatSize(meta.size)}</div>`:''}</div></div><div class="requirements">${section.requirements.map(x=>`<div class="requirement"><i>✓</i><span>${x}</span></div>`).join('')}</div>`;
  }
  function sdeBody(){
    return `<div class="sde-grid sde-single"><section class="sde-block"><h3>Owner benefits</h3><p>${sections.find(x=>x.id==='sde').copy}</p><div class="check-grid">${benefits.map(([id,label])=>`<label class="check-option"><input type="checkbox" data-addback="${id}" ${state.addbacks[id]?'checked':''}><span>${label}</span></label>`).join('')}</div><div class="field ownership-percent ${state.addbacks.distributions?'show':''}" id="ownershipField"><label>Ownership percentage</label><input id="ownershipPercent" type="number" min="0" max="100" value="${esc(state.ownershipPercent)}" placeholder="100"></div><p class="sde-review-note">Select all that apply, then click Continue. If none apply, you can still continue.</p></section></div>`;
  }
  function reviewBody(){return `<section class="review-card"><h2>Financial Performance Analysis</h2><p>Review the six data sections below. Completing this step will return you to the Agency Diagnostic where all four analyses are tracked together.</p><div class="review-list">${sections.map(section=>`<div class="review-row"><span>${section.title}</span><strong>${complete(section)?'Complete':'Missing'}</strong></div>`).join('')}</div><div class="error" id="reviewError">Complete every section before finishing Financial Performance.</div></section>`;}
  function renderSection(){
    const isReview=state.sectionIndex===sections.length;
    if(isReview){
      host.innerHTML=`${reviewBody()}<div class="wizard-actions"><button class="button" id="previous">Back</button><span class="save-note">Saved automatically</span><button class="button primary" id="completePerformance">Complete Financial Performance →</button></div>`;
      document.querySelector('#previous').onclick=()=>{state.sectionIndex=5;persist();render()};
      document.querySelector('#completePerformance').onclick=finish;
      return;
    }
    const section=sections[state.sectionIndex];
    host.innerHTML=`<section class="section-card"><header class="section-card-head"><div><span class="section-kicker">Section ${state.sectionIndex+1} of 6</span><h2>${section.title}</h2><p>${section.copy}</p></div><span class="status-pill ${complete(section)?'complete':''}">${complete(section)?'Complete':'Required'}</span></header><div class="section-body">${section.type==='sde'?sdeBody():uploadBody(section)}</div></section><div class="wizard-actions"><button class="button" id="previous" ${state.sectionIndex===0?'disabled':''}>Back</button><span class="save-note">Saved automatically</span><button class="button primary" id="next">${state.sectionIndex===5?'Review':'Continue →'}</button></div>`;
    document.querySelector('#previous').onclick=()=>{state.sectionIndex=Math.max(0,state.sectionIndex-1);persist();render()};
    document.querySelector('#next').onclick=()=>{if(section.type==='sde')state.sdeReviewed=true;state.sectionIndex=state.sectionIndex===5?6:state.sectionIndex+1;persist();render()};
    document.querySelectorAll('[data-file]').forEach(input=>input.onchange=()=>{const file=input.files?.[0];if(!file)return;state.documents[input.dataset.file]=fileMeta(file);persist();render()});
    if(section.type==='sde'){
      document.querySelectorAll('[data-addback]').forEach(input=>input.onchange=()=>{state.addbacks[input.dataset.addback]=input.checked;if(input.dataset.addback==='distributions')document.querySelector('#ownershipField')?.classList.toggle('show',input.checked);persist();});
      document.querySelector('#ownershipPercent').oninput=e=>{state.ownershipPercent=e.target.value;persist();};
    }
  }
  function finish(){
    if(!allComplete()){document.querySelector('#reviewError').classList.add('show');return;}
    const existing=Number(localStorage.getItem('agencyPerformanceScore'));
    const score=Number.isFinite(existing)&&existing>=0?existing:88;
    const details={score,confidence:40,confidenceLabel:'Uploaded evidence pending analysis',validation:'yellow',provisional:true,completed:true,documents:state.documents,addbacks:state.addbacks,ownershipPercent:state.ownershipPercent,completedAt:new Date().toISOString()};
    localStorage.setItem('agencyPerformanceDetails',JSON.stringify(details));
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(state));
    if(window.CCDiagnostic?.mark)window.CCDiagnostic.mark('performance',score,details);else{localStorage.setItem('agencyPerformanceScore',String(score));localStorage.setItem('ccIndexPerformanceComplete','true');}
    location.href='/diagnostic/';
  }
  function render(){renderNav();updateProgress();renderSection();persist();}
  if(window.CCDiagnostic?.getState?.().performance){state.sectionIndex=sections.length;}
  render();
})();
