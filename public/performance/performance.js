(() => {
  const sections = [
    {id:'pnl',evidenceType:'profit_loss',title:'Profit & Loss',short:'Profit & Loss',type:'upload',copy:'Upload your (pdf) report that includes Trailing Twelve Months + Year To Date by Month.',requirements:['PDF report','Trailing Twelve Months','Year To Date by Month']},
    {id:'balanceSheet',evidenceType:'balance_sheet',title:'Balance Sheet',short:'Balance Sheet',type:'upload',copy:'Upload your balance sheet (pdf) report that includes Trailing Twelve Months + Year to Date by Month.',requirements:['PDF report','Trailing Twelve Months','Year To Date by Month']},
    {id:'arAgingDoc',evidenceType:'ar_aging',title:'Accounts Receivable Aging Report',short:'A/R Aging',type:'upload',copy:'Upload the most recent Accounts Receivable Aging Report.',requirements:['Most recent Accounts Receivable Aging Report','PDF format']},
    {id:'sde',evidenceType:'sde',title:'SDE (Seller Discretionary Earnings)',short:'SDE',type:'sde',copy:'As the agency owner, provide us with a sense for the benefits you receive from your agency. Select all that apply.'},
    {id:'clientRevenue',evidenceType:'client_revenue',title:'Client Revenue Report',short:'Client Revenue',type:'upload',copy:'Upload a (pdf) report from your accounting software of a complete list of Clients and their revenue per Client over the last 12 months.',requirements:['Complete list of Clients','Revenue per Client','Last 12 months','PDF format']},
    {id:'serviceRevenue',evidenceType:'service_revenue_mix',title:'Service Revenue Mix',short:'Service Mix',type:'upload',copy:'Upload a (pdf) report from your accounting software of a complete list of Revenue by Service.',requirements:['Complete list of Revenue by Service','PDF format']}
  ];
  const benefits = [
    ['income','Income'],['insurance','Insurance'],['vehicle','Vehicle Expenses'],['phone','Phone'],['retirement','Retirement (401k)'],['healthcare','Medical Reimbursement or Healthcare'],['office','Office'],['distributions','Profit Distributions (I am x% owner)']
  ];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const saved=read('agencyPerformanceDraft',{sectionIndex:0,documents:{},addbacks:{},sdeReviewed:false,ownershipPercent:''});
  const state={
    ...saved,
    sectionIndex:Number(saved.sectionIndex)||0,
    documents:saved.documents||{},
    addbacks:saved.addbacks||{},
    uploadState:{},
    remoteLoaded:false,
    remoteError:''
  };
  const app=document.querySelector('#performanceApp');
  if(!app)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fileMeta=file=>({name:file.name,size:file.size,type:file.type||'application/pdf',receivedAt:new Date().toISOString(),extractionStatus:'uploading'});
  const formatSize=n=>n?`${Math.max(1,Math.round(Number(n)/1024))} KB`:'';
  const isComplete=section=>section.type==='sde'?Boolean(state.sdeReviewed):Boolean(state.documents[section.id]);
  const completeCount=()=>sections.filter(isComplete).length;
  const allComplete=()=>completeCount()===sections.length;
  const currentIsReview=()=>state.sectionIndex>=sections.length;
  const sectionByEvidenceType=type=>sections.find(section=>section.evidenceType===type);

  const checkIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`;
  const arrowIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;

  const persist=()=>{
    const persistable={
      sectionIndex:state.sectionIndex,
      documents:state.documents,
      addbacks:state.addbacks,
      sdeReviewed:state.sdeReviewed,
      ownershipPercent:state.ownershipPercent
    };
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(persistable));
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

  function extractionLabel(meta){
    const transient=state.uploadState[meta?.sectionId||''];
    if(transient==='uploading')return {className:'processing',text:'Uploading securely…'};
    if(transient==='extracting')return {className:'processing',text:'Analyzing PDF…'};
    const status=meta?.extractionStatus||meta?.extraction_status||'';
    if(status==='processed')return {className:'complete',text:'Analysis complete'};
    if(status==='processing')return {className:'processing',text:'Analyzing PDF…'};
    if(status==='failed')return {className:'warning',text:'Uploaded · analysis failed'};
    return {className:'pending',text:'Uploaded · analysis pending'};
  }

  function uploadBody(section){
    const meta=state.documents[section.id];
    const status=meta?extractionLabel({...meta,sectionId:section.id}):null;
    const error=meta?.extractionError||meta?.extraction_error||'';
    const canRetry=meta?.evidenceId && ['failed','uploaded'].includes(meta.extractionStatus||meta.extraction_status||'');
    return `<div class="evidence-upload ${meta?'received':''}">
      <div class="upload-mark">${meta?checkIcon:'<span>↑</span>'}</div>
      <div class="upload-copy">
        <h3>${meta?'Report received':'Upload PDF report'}</h3>
        <p>${esc(section.copy)}</p>
        ${meta?`<div class="uploaded-file"><strong>${esc(meta.name)}</strong>${meta.size?`<span>${formatSize(meta.size)}</span>`:''}</div>`:''}
        ${status?`<div class="extraction-status ${status.className}">${esc(status.text)}</div>`:''}
        ${error?`<div class="extraction-error">${esc(error)}</div>`:''}
        <div class="upload-actions">
          <label class="upload-button">${meta?'Replace PDF':'Choose PDF'}<input type="file" data-file="${section.id}" accept="application/pdf,.pdf"></label>
          ${canRetry?`<button type="button" class="retry-analysis" data-retry="${section.id}">Retry analysis</button>`:''}
        </div>
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
      ${state.remoteError?`<div class="extraction-error">${esc(state.remoteError)}</div>`:''}
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
        <span class="saved-note">Saved securely</span>
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
        <div class="performance-analysis-note">Uploaded PDFs are stored in the private diagnostic-evidence bucket. Automated extraction is separate from final Performance scoring; Step 6B will use the extracted values to calculate the index.</div>
      </div>
      <footer class="q-card-footer">
        <button type="button" class="btn-back" id="previous">← Back</button>
        <span class="saved-note">Saved securely</span>
        <button type="button" class="btn-next ${allComplete()?'active':'disabled'}" id="completePerformance">Complete Financial Performance ${arrowIcon}</button>
      </footer>
    </article>`;
  }

  function benefitIds(){return benefits.filter(([id])=>state.addbacks[id]).map(([id])=>id);}

  async function syncSde(){
    if(!window.CCFinancialEvidence?.saveSde)return;
    try{
      const result=await window.CCFinancialEvidence.saveSde({benefits:benefitIds(),ownershipPercent:state.ownershipPercent||null});
      state.remoteError='';
      if(result?.evidence)state.sdeEvidenceId=result.evidence.id;
    }catch(error){
      state.remoteError=error.message||'SDE selections could not be saved to the backend yet.';
    }
  }

  async function handleUpload(section,file){
    if(!window.CCFinancialEvidence?.uploadPdf){
      state.documents[section.id]={...fileMeta(file),extractionStatus:'uploaded',extractionError:'Financial evidence backend is not loaded.'};
      persist();render();return;
    }
    if(file.size>window.CCFinancialEvidence.maxFileBytes){
      state.documents[section.id]={...fileMeta(file),extractionStatus:'failed',extractionError:'PDF must be 4 MB or smaller.'};
      persist();render();return;
    }

    state.documents[section.id]={...fileMeta(file)};
    state.uploadState[section.id]='uploading';
    persist();render();

    try{
      const result=await window.CCFinancialEvidence.uploadPdf(section.evidenceType,file);
      const row=result?.evidence||{};
      state.documents[section.id]={
        name:row.file_name||file.name,
        size:Number(row.file_size_bytes)||file.size,
        type:row.mime_type||file.type||'application/pdf',
        receivedAt:row.updated_at||new Date().toISOString(),
        evidenceId:row.id||null,
        storagePath:row.storage_path||null,
        extractionStatus:row.extraction_status||'uploaded',
        extractionError:result?.extractionError?.message||row.extraction_error||'',
        extractedAt:row.extracted_at||null
      };
    }catch(error){
      state.documents[section.id]={...state.documents[section.id],extractionStatus:'failed',extractionError:error.message||'Upload failed.'};
    }finally{
      delete state.uploadState[section.id];
      persist();render();
    }
  }

  async function retryAnalysis(section){
    const meta=state.documents[section.id];
    if(!meta?.evidenceId||!window.CCFinancialEvidence?.retryExtraction)return;
    state.uploadState[section.id]='extracting';
    meta.extractionError='';
    persist();render();
    try{
      const result=await window.CCFinancialEvidence.retryExtraction(meta.evidenceId,section.evidenceType);
      const row=result?.evidence||{};
      state.documents[section.id]={...meta,extractionStatus:row.extraction_status||'processed',extractionError:row.extraction_error||'',extractedAt:row.extracted_at||null};
    }catch(error){
      state.documents[section.id]={...meta,extractionStatus:'failed',extractionError:error.message||'Analysis failed.'};
    }finally{
      delete state.uploadState[section.id];persist();render();
    }
  }

  function bindSection(section){
    document.querySelector('#previous')?.addEventListener('click',()=>{state.sectionIndex=Math.max(0,state.sectionIndex-1);persist();render();});
    document.querySelector('#next')?.addEventListener('click',async()=>{
      if(section.type==='sde'){
        state.sdeReviewed=true;
        persist();
        await syncSde();
      }
      state.sectionIndex=Math.min(sections.length,state.sectionIndex+1);
      persist();render();
    });
    document.querySelectorAll('[data-file]').forEach(input=>input.addEventListener('change',()=>{
      const file=input.files?.[0];
      if(!file)return;
      const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
      if(!isPdf){state.documents[section.id]={...fileMeta(file),extractionStatus:'failed',extractionError:'Only PDF reports can be uploaded.'};persist();render();return;}
      handleUpload(section,file);
    }));
    document.querySelectorAll('[data-retry]').forEach(btn=>btn.addEventListener('click',()=>retryAnalysis(section)));
    if(section.type==='sde'){
      document.querySelectorAll('[data-addback]').forEach(input=>input.addEventListener('change',()=>{
        state.addbacks[input.dataset.addback]=input.checked;
        if(input.dataset.addback==='distributions')document.querySelector('#ownershipField')?.classList.toggle('show',input.checked);
        persist();render();
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
      host.innerHTML=reviewCard();bindReview();return;
    }
    const section=sections[state.sectionIndex];
    host.innerHTML=sectionCard(section);bindSection(section);
  }

  function finish(){
    if(!allComplete()){
      document.querySelector('#reviewError')?.classList.add('show');return;
    }
    // Step 6A stores and extracts evidence only. Keep the current provisional
    // Performance score behavior until Step 6B replaces it with evidence-based scoring.
    const existing=Number(localStorage.getItem('agencyPerformanceScore'));
    const score=Number.isFinite(existing)&&existing>=0?existing:88;
    const details={score,confidence:40,confidenceLabel:'Financial evidence uploaded; evidence-based scoring will run in Step 6B',validation:'yellow',provisional:true,completed:true,documents:state.documents,addbacks:state.addbacks,ownershipPercent:state.ownershipPercent,completedAt:new Date().toISOString()};
    localStorage.setItem('agencyPerformanceDetails',JSON.stringify(details));
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify({sectionIndex:state.sectionIndex,documents:state.documents,addbacks:state.addbacks,sdeReviewed:state.sdeReviewed,ownershipPercent:state.ownershipPercent}));
    if(window.CCDiagnostic?.mark)window.CCDiagnostic.mark('performance',score,details);
    else{
      localStorage.setItem('agencyPerformanceScore',String(score));
      localStorage.setItem('ccIndexPerformanceComplete','true');
    }
    location.href='/diagnostic/';
  }

  function render(){renderNav();updateProgress();renderSection();persist();}

  function hydrateEvidenceRow(row){
    const section=sectionByEvidenceType(row.evidence_type);
    if(!section)return;
    if(section.type==='sde'){
      const data=row.extracted_data||{};
      const selected=new Set(Array.isArray(data.benefits)?data.benefits:[]);
      benefits.forEach(([id])=>{state.addbacks[id]=selected.has(id);});
      state.ownershipPercent=data.ownershipPercent??state.ownershipPercent??'';
      state.sdeReviewed=true;
      state.sdeEvidenceId=row.id;
      return;
    }
    if(!row.storage_path&&!row.file_name)return;
    state.documents[section.id]={
      name:row.file_name||'Financial evidence.pdf',
      size:Number(row.file_size_bytes)||0,
      type:row.mime_type||'application/pdf',
      receivedAt:row.updated_at||row.created_at||'',
      evidenceId:row.id,
      storagePath:row.storage_path,
      extractionStatus:row.extraction_status||'uploaded',
      extractionError:row.extraction_error||'',
      extractedAt:row.extracted_at||null
    };
  }

  async function hydrateRemoteEvidence(){
    if(!window.CCFinancialEvidence?.list){state.remoteLoaded=true;return;}
    try{
      const result=await window.CCFinancialEvidence.list();
      (result.evidence||[]).forEach(hydrateEvidenceRow);
      state.remoteError='';
    }catch(error){
      state.remoteError=error.message||'Saved financial evidence could not be loaded.';
    }finally{
      state.remoteLoaded=true;persist();render();
    }
  }

  if(window.CCDiagnostic?.getState?.().performance)state.sectionIndex=sections.length;
  render();
  hydrateRemoteEvidence();
})();
