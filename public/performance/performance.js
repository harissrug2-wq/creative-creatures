(() => {
  const sections = [
    {id:'pnl',title:'Profit & Loss',short:'Profit & Loss',type:'upload',copy:'Upload your (pdf) report that includes Trailing Twelve Months + Year To Date by Month.',requirements:['PDF report','Trailing Twelve Months','Year To Date by Month']},
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
  const saved=read('agencyPerformanceDraft',{sectionIndex:0,documents:{},addbacks:{},sdeReviewed:false,ownershipPercent:''});
  const state={...saved,sectionIndex:Number(saved.sectionIndex)||0,documents:saved.documents||{},addbacks:saved.addbacks||{}};
  const app=document.querySelector('#performanceApp');
  if(!app)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fileMeta=file=>({name:file.name,size:file.size,type:file.type||'application/pdf',receivedAt:new Date().toISOString()});
  const formatSize=n=>`${Math.max(1,Math.round((n||0)/1024))} KB`;
  const isComplete=section=>section.type==='sde'?Boolean(state.sdeReviewed):Boolean(state.documents[section.id]);
  const completeCount=()=>sections.filter(isComplete).length;
  const allComplete=()=>completeCount()===sections.length;
  const currentIsReview=()=>state.sectionIndex>=sections.length;

  const checkIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`;
  const arrowIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;

  const persist=()=>{
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(state));
    if(window.CCDiagnostic?.setProgress&&!window.CCDiagnostic.getState().performance){
      window.CCDiagnostic.setProgress('performance',Math.min(99,Math.round(completeCount()/sections.length*100)));
    }
  };

  app.innerHTML=`
    <div class="app-wrapper performance-strength-ui">
      <header class="top-header performance-top-header">
        <div class="main-container">
          <button type="button" class="btn-back back-to-diagnostic" id="backDiagnostic">← Back to diagnostic hub</button>
        </div>
      </header>
      <div class="main-container">
        <div class="diagnostic-shell">
          <aside class="sidebar-container">
            <div class="performance-sidebar-intro">
              <span class="sidebar-kicker">PERFORMANCE</span>
              <div class="sidebar-brand-title">Agency Performance Index</div>
              <p>Financial evidence used to understand the agency's economic performance.</p>
            </div>
            <nav class="sidebar-nav-list" id="sectionNav" aria-label="Performance evidence sections"></nav>
          </aside>
          <main class="performance-main">
            <div class="question-progress-row">
              <span class="question-progress-label" id="sectionLabel">Financial Evidence</span>
              <div class="question-progress-track" aria-hidden="true"><span id="progressFill"></span></div>
              <span class="question-progress-count" id="progressText">0 / 6 complete</span>
            </div>
            <section id="sectionHost"></section>
          </main>
        </div>
      </div>
    </div>`;

  const host=document.querySelector('#sectionHost');
  document.querySelector('#backDiagnostic').addEventListener('click',()=>{persist();location.href='/diagnostic/';});

  function renderNav(){
    const nav=document.querySelector('#sectionNav');
    nav.innerHTML=[...sections,{id:'review',short:'Review'}].map((section,index)=>{
      const done=index<sections.length?isComplete(section):allComplete();
      const active=state.sectionIndex===index || (index===sections.length&&currentIsReview());
      return `<button type="button" class="sidebar-nav-button ${active?'active':''}" data-section="${index}">
        <span class="sidebar-nav-name">${esc(section.short)}</span>
        <span class="sidebar-nav-status ${done?'done':''}">${done?checkIcon:String(index+1).padStart(2,'0')}</span>
      </button>`;
    }).join('');
    nav.querySelectorAll('[data-section]').forEach(btn=>btn.addEventListener('click',()=>{
      state.sectionIndex=Number(btn.dataset.section);
      persist();
      render();
    }));
  }

  function updateProgress(){
    const count=completeCount();
    document.querySelector('#progressText').textContent=`${count} / ${sections.length} complete`;
    document.querySelector('#progressFill').style.width=`${Math.round(count/sections.length*100)}%`;
    document.querySelector('#sectionLabel').textContent=currentIsReview()?'Review':'Financial Evidence';
  }

  function uploadBody(section){
    const meta=state.documents[section.id];
    return `<div class="evidence-upload ${meta?'received':''}">
      <div class="upload-mark">${meta?checkIcon:'<span>↑</span>'}</div>
      <div class="upload-copy">
        <h3>${meta?'Report received':'Upload PDF report'}</h3>
        <p>${esc(section.copy)}</p>
        ${meta?`<div class="uploaded-file"><strong>${esc(meta.name)}</strong><span>${formatSize(meta.size)}</span></div>`:''}
        <label class="upload-button">${meta?'Replace PDF':'Choose PDF'}<input type="file" data-file="${section.id}" accept="application/pdf,.pdf"></label>
      </div>
    </div>
    <div class="evidence-requirements">
      ${section.requirements.map(item=>`<div>${checkIcon}<span>${esc(item)}</span></div>`).join('')}
    </div>`;
  }

  function sdeBody(){
    return `<div class="sde-panel">
      <h3>Owner benefits</h3>
      <p>${esc(sections.find(x=>x.id==='sde').copy)}</p>
      <div class="sde-options">
        ${benefits.map(([id,label])=>`<label class="radio-option-card sde-option ${state.addbacks[id]?'selected':''}">
          <span class="option-copy">${esc(label)}</span>
          <input type="checkbox" data-addback="${id}" ${state.addbacks[id]?'checked':''}>
          <span class="checkbox-ui">${state.addbacks[id]?checkIcon:''}</span>
        </label>`).join('')}
      </div>
      <label class="ownership-field ${state.addbacks.distributions?'show':''}" id="ownershipField">
        <span>Ownership percentage</span>
        <div><input id="ownershipPercent" type="number" min="0" max="100" value="${esc(state.ownershipPercent)}" placeholder="100"><b>%</b></div>
      </label>
      <p class="sde-note">Select all that apply. If none apply, you can still continue.</p>
    </div>`;
  }

  function sectionCard(section){
    const done=isComplete(section);
    return `<article class="q-card fade-in">
      <header class="q-card-header">
        <div>
          <div class="question-kicker">SECTION ${state.sectionIndex+1} OF ${sections.length}</div>
          <h1>${esc(section.title)}</h1>
          <p>${esc(section.copy)}</p>
        </div>
        <span class="evidence-status ${done?'complete':''}">${done?`${checkIcon} Complete`:'Required'}</span>
      </header>
      <div class="q-card-body">${section.type==='sde'?sdeBody():uploadBody(section)}</div>
      <footer class="q-card-footer">
        <button type="button" class="btn-back" id="previous" ${state.sectionIndex===0?'disabled':''}>← Back</button>
        <span class="saved-note">Saved automatically</span>
        <button type="button" class="btn-next active" id="next">${state.sectionIndex===sections.length-1?'Review':'Continue'} ${arrowIcon}</button>
      </footer>
    </article>`;
  }

  function reviewCard(){
    return `<article class="q-card fade-in">
      <header class="q-card-header review-header">
        <div><div class="question-kicker">REVIEW</div><h1>Financial Performance Analysis</h1><p>Review the six evidence sections below. When every section is complete, return to your Agency Diagnostic.</p></div>
        <span class="evidence-status ${allComplete()?'complete':''}">${allComplete()?`${checkIcon} Ready`:'Incomplete'}</span>
      </header>
      <div class="q-card-body">
        <div class="performance-review-list">
          ${sections.map((section,index)=>`<button type="button" class="performance-review-row" data-review-section="${index}"><span>${esc(section.title)}</span><strong class="${isComplete(section)?'done':''}">${isComplete(section)?`${checkIcon} Complete`:'Missing'}</strong></button>`).join('')}
        </div>
        <div class="review-error" id="reviewError">Complete every section before finishing Financial Performance.</div>
      </div>
      <footer class="q-card-footer">
        <button type="button" class="btn-back" id="previous">← Back</button>
        <span class="saved-note">Saved automatically</span>
        <button type="button" class="btn-next ${allComplete()?'active':'disabled'}" id="completePerformance">Complete Financial Performance ${arrowIcon}</button>
      </footer>
    </article>`;
  }

  function bindSection(section){
    document.querySelector('#previous')?.addEventListener('click',()=>{state.sectionIndex=Math.max(0,state.sectionIndex-1);persist();render();});
    document.querySelector('#next')?.addEventListener('click',()=>{
      if(section.type==='sde')state.sdeReviewed=true;
      state.sectionIndex=Math.min(sections.length,state.sectionIndex+1);
      persist();
      render();
    });
    document.querySelectorAll('[data-file]').forEach(input=>input.addEventListener('change',()=>{
      const file=input.files?.[0];
      if(!file)return;
      if(file.type && file.type!=='application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))return;
      state.documents[input.dataset.file]=fileMeta(file);
      persist();
      render();
    }));
    if(section.type==='sde'){
      document.querySelectorAll('[data-addback]').forEach(input=>input.addEventListener('change',()=>{
        state.addbacks[input.dataset.addback]=input.checked;
        if(input.dataset.addback==='distributions')document.querySelector('#ownershipField')?.classList.toggle('show',input.checked);
        persist();
        render();
      }));
      document.querySelector('#ownershipPercent')?.addEventListener('input',event=>{state.ownershipPercent=event.target.value;persist();});
    }
  }

  function bindReview(){
    document.querySelector('#previous')?.addEventListener('click',()=>{state.sectionIndex=sections.length-1;persist();render();});
    document.querySelectorAll('[data-review-section]').forEach(btn=>btn.addEventListener('click',()=>{state.sectionIndex=Number(btn.dataset.reviewSection);persist();render();}));
    document.querySelector('#completePerformance')?.addEventListener('click',finish);
  }

  function renderSection(){
    if(currentIsReview()){
      host.innerHTML=reviewCard();
      bindReview();
      return;
    }
    const section=sections[state.sectionIndex];
    host.innerHTML=sectionCard(section);
    bindSection(section);
  }

  function finish(){
    if(!allComplete()){
      document.querySelector('#reviewError')?.classList.add('show');
      return;
    }
    const existing=Number(localStorage.getItem('agencyPerformanceScore'));
    const score=Number.isFinite(existing)&&existing>=0?existing:88;
    const details={score,confidence:40,confidenceLabel:'Uploaded evidence pending analysis',validation:'yellow',provisional:true,completed:true,documents:state.documents,addbacks:state.addbacks,ownershipPercent:state.ownershipPercent,completedAt:new Date().toISOString()};
    localStorage.setItem('agencyPerformanceDetails',JSON.stringify(details));
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(state));
    if(window.CCDiagnostic?.mark)window.CCDiagnostic.mark('performance',score,details);
    else{
      localStorage.setItem('agencyPerformanceScore',String(score));
      localStorage.setItem('ccIndexPerformanceComplete','true');
    }
    location.href='/diagnostic/';
  }

  function render(){renderNav();updateProgress();renderSection();persist();}
  if(window.CCDiagnostic?.getState?.().performance)state.sectionIndex=sections.length;
  render();
})();
