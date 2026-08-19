(() => {
  const IS_RETAKE = new URLSearchParams(window.location.search).get('retake') === '1';
  const sections = [
    {id:'pnl',evidenceType:'profit_loss',title:'Profit & Loss',short:'Profit & Loss',type:'upload',copy:'Sync from QuickBooks on the Integrations page or upload a PDF, then confirm the financial values below.',requirements:['PDF report','Trailing Twelve Months','Year To Date by Month']},
    {id:'balanceSheet',evidenceType:'balance_sheet',title:'Balance Sheet',short:'Balance Sheet',type:'upload',copy:'Sync from QuickBooks or upload your balance sheet PDF, then confirm the balance-sheet and cash values used for scoring.',requirements:['PDF report','Current assets and liabilities','Cash / debt evidence']},
    {id:'arAgingDoc',evidenceType:'ar_aging',title:'Accounts Receivable Aging Report',short:'A/R Aging',type:'upload',copy:'Sync A/R Aging from QuickBooks or upload the most recent report, then confirm the collection-rate value below.',requirements:['Most recent A/R Aging Report','PDF format']},
    {id:'sde',evidenceType:'sde',title:'SDE & Capital Allocation',short:'SDE + Capital',type:'sde',copy:'Confirm owner benefits, Adjusted SDE, and how capital was reinvested during the last year.'},
    {id:'clientRevenue',evidenceType:'client_revenue',title:'Client Revenue Report',short:'Client Revenue',type:'upload',copy:'Sync client sales from QuickBooks or upload a 12-month client revenue report, then confirm concentration values.',requirements:['Complete client list','Revenue per client','Last 12 months','PDF format']},
    {id:'serviceRevenue',evidenceType:'service_revenue_mix',title:'Service Revenue Mix',short:'Service Mix',type:'upload',copy:'Sync service sales from QuickBooks or upload revenue by service, then confirm recurring versus project-based revenue.',requirements:['Revenue by service','Recurring / project mix','PDF format']}
  ];

  const benefits = [
    ['income','Income'],['insurance','Insurance'],['vehicle','Vehicle Expenses'],['phone','Phone'],['retirement','Retirement (401k)'],['healthcare','Medical Reimbursement or Healthcare'],['office','Office'],['distributions','Profit Distributions (I am x% owner)']
  ];

  const levelOptions = {
    marginStabilityLevel: ['Declining and highly volatile','Flat or volatile','Stable with occasional fluctuations','Consistently stable','Stable and improving over 24 months'],
    growthConsistencyLevel: ['Revenue declining','Highly inconsistent','Stable with fluctuations','Consistently growing','Consistently growing with accelerating profit'],
    revenuePredictabilityLevel: ['Extremely volatile','High variability','Moderate consistency','Predictable','Highly predictable recurring growth'],
    operatingCashFlowLevel: ['Negative','Break-even','Positive but inconsistent','Positive and stable','Positive and consistently growing'],
    revenueDiversificationLevel: ['Very concentrated','Limited diversification','Moderate','Well diversified','Highly diversified'],
    contractDurationLevel: ['Project only','Month-to-month','6-month average','12-month average','Multi-year relationships'],
    technologyInvestmentLevel: ['Reactive spending only','Occasional purchases','Annual technology plan','Strategic technology investment','Technology consistently improves productivity and margins'],
    talentInvestmentLevel: ['No leadership development','Occasional training','Defined development plans','Leadership development program','Talent investments produce measurable capability'],
    retainedEarningsGrowthLevel: ['Declining','Flat','Growing slowly','Growing consistently','Growing rapidly while maintaining profitability']
  };

  const fieldGroups = {
    pnl: [
      {key:'revenueTTM',label:'Revenue TTM',type:'money',required:true},
      {key:'cogsTTM',label:'COGS TTM',type:'money',required:true},
      {key:'netIncomeTTM',label:'Net Income TTM',type:'money',required:true},
      {key:'revenueGrowthPercent',label:'Revenue Growth TTM',type:'percent',required:true,help:'Current TTM vs prior TTM.'},
      {key:'netIncomeGrowthPercent',label:'Net Income Growth TTM',type:'percent'},
      {key:'grossProfitGrowthPercent',label:'Gross Profit Growth TTM',type:'percent'},
      {key:'profitConversionPercent',label:'Incremental Profit Conversion',type:'percent',help:'New Net Income ÷ New Revenue.'},
      {key:'marginStabilityLevel',label:'Margin Stability',type:'level'},
      {key:'growthConsistencyLevel',label:'Growth Consistency',type:'level'},
      {key:'revenuePredictabilityLevel',label:'Revenue Predictability',type:'level'}
    ],
    balanceSheet: [
      {key:'cash',label:'Cash Balance',type:'money'},
      {key:'monthlyOperatingExpenses',label:'Average Monthly Operating Expenses',type:'money',help:'Used to calculate months of cash reserve.'},
      {key:'currentAssets',label:'Current Assets',type:'money',required:true},
      {key:'currentLiabilities',label:'Current Liabilities',type:'money',required:true},
      {key:'totalDebt',label:'Total Debt',type:'money'},
      {key:'ebitdaTTM',label:'EBITDA TTM',type:'money',help:'Used only for Debt-to-EBITDA scoring.'},
      {key:'operatingCashFlowLevel',label:'Operating Cash Flow Trend',type:'level'}
    ],
    arAgingDoc: [
      {key:'totalAR',label:'Total Accounts Receivable',type:'money'},
      {key:'collectionRatePercent',label:'Collected Within 30 Days',type:'percent',required:true,help:'Enter the percentage collected within 30 days.'}
    ],
    sde: [
      {key:'adjustedSDE',label:'Adjusted SDE',type:'money',required:true,help:'Annual owner-operator earning power after approved add-backs.'},
      {key:'capitalInvested',label:'Capital Invested Last Year',type:'money'},
      {key:'incrementalOperatingProfit',label:'Incremental Operating Profit',type:'money',help:'Used with Capital Invested to calculate ROIC-Lite.'},
      {key:'reinvestmentRatePercent',label:'Profit Reinvested',type:'percent',required:true},
      {key:'technologyInvestmentLevel',label:'Technology Investment',type:'level'},
      {key:'talentInvestmentLevel',label:'Talent Investment',type:'level'},
      {key:'retainedEarningsGrowthLevel',label:'Retained Earnings Growth',type:'level'}
    ],
    clientRevenue: [
      {key:'topClientPercent',label:'Largest Client % of Revenue',type:'percent',required:true},
      {key:'revenueDiversificationLevel',label:'Revenue Diversification',type:'level'},
      {key:'averageClientTenureMonths',label:'Average Client Tenure',type:'months'},
      {key:'contractDurationLevel',label:'Average Contract Duration',type:'level'}
    ],
    serviceRevenue: [
      {key:'recurringRevenuePercent',label:'Recurring Revenue',type:'percent',required:true},
      {key:'projectRevenuePercent',label:'Project Revenue',type:'percent',help:'Optional. If omitted, it can be treated as the remaining mix for reference only.'}
    ]
  };

  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const saved=read('agencyPerformanceDraft',{sectionIndex:0,documents:{},addbacks:{},sdeReviewed:false,ownershipPercent:'',manual:{}});
  const state={
    ...saved,
    sectionIndex:Number(saved.sectionIndex)||0,
    documents:saved.documents||{},
    addbacks:saved.addbacks||{},
    ownershipPercent:saved.ownershipPercent||'',
    manual:saved.manual||{},
    sdeReviewed:Boolean(saved.sdeReviewed),
    uploadState:{},
    saveState:{},
    remoteLoaded:false,
    remoteError:'',
    finishError:''
  };

  const app=document.querySelector('#performanceApp');
  if(!app)return;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fileMeta=file=>({name:file.name,size:file.size,type:file.type||'application/pdf',receivedAt:new Date().toISOString(),extractionStatus:'uploading'});
  const formatSize=n=>n?`${Math.max(1,Math.round(Number(n)/1024))} KB`:'';
  const hasNumber=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  const sectionByEvidenceType=type=>sections.find(section=>section.evidenceType===type);
  const manualFor=section=>state.manual[section.id]||(state.manual[section.id]={});

  function manualComplete(section){
    const fields=fieldGroups[section.id]||[];
    const values=manualFor(section);
    return fields.filter(field=>field.required).every(field=>hasNumber(values[field.key]));
  }

  function isComplete(section){
    if(section.type==='sde')return Boolean(state.sdeReviewed)&&manualComplete(section);
    return Boolean(state.documents[section.id])&&manualComplete(section);
  }

  const completeCount=()=>sections.filter(isComplete).length;
  const allComplete=()=>completeCount()===sections.length;
  const currentIsReview=()=>state.sectionIndex>=sections.length;

  const checkIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>`;
  const arrowIcon=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;

  const persist=()=>{
    const persistable={
      sectionIndex:state.sectionIndex,
      documents:state.documents,
      addbacks:state.addbacks,
      sdeReviewed:state.sdeReviewed,
      ownershipPercent:state.ownershipPercent,
      manual:state.manual
    };
    localStorage.setItem('agencyPerformanceDraft',JSON.stringify(persistable));
    if(window.CCDiagnostic?.setProgress&&!window.CCDiagnostic.getState().performance){
      window.CCDiagnostic.setProgress('performance',Math.min(99,Math.round(completeCount()/sections.length*100)));
    }
  };

  app.innerHTML=`
    <div class="app-wrapper performance-strength-ui">
      <header class="top-header performance-top-header">
        <div class="main-container"><button type="button" class="btn-back back-to-diagnostic" id="backDiagnostic">← Back to diagnostic hub</button></div>
      </header>
      <div class="main-container">
        <div class="diagnostic-shell">
          <aside class="sidebar-container">
            <div class="performance-sidebar-intro"><span class="sidebar-kicker">PERFORMANCE</span><div class="sidebar-brand-title">Agency Performance Index</div><p>Financial evidence and confirmed values used to calculate economic performance.</p></div>
            <nav class="sidebar-nav-list" id="sectionNav" aria-label="Performance evidence sections"></nav>
          </aside>
          <main class="performance-main">
            <div class="question-progress-row"><span class="question-progress-label" id="sectionLabel">Financial Evidence</span><div class="question-progress-track" aria-hidden="true"><span id="progressFill"></span></div><span class="question-progress-count" id="progressText">0 / 6 complete</span></div>
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
      return `<button type="button" class="sidebar-nav-button ${active?'active':''}" data-section="${index}"><span class="sidebar-nav-name">${esc(section.short)}</span><span class="sidebar-nav-status ${done?'done':''}">${done?checkIcon:String(index+1).padStart(2,'0')}</span></button>`;
    }).join('');
    nav.querySelectorAll('[data-section]').forEach(btn=>btn.addEventListener('click',()=>{state.sectionIndex=Number(btn.dataset.section);persist();render();}));
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
    if(transient==='extracting')return {className:'processing',text:'Trying automated extraction…'};
    const status=meta?.extractionStatus||meta?.extraction_status||'';
    const model=meta?.extractionModel||meta?.extraction_model||'';
    if(model==='manual_entry')return {className:'complete',text:'Manual values saved'};
    if(status==='processed')return {className:'complete',text:'Automated values available'};
    if(status==='processing')return {className:'processing',text:'Trying automated extraction…'};
    if(status==='failed')return {className:'warning',text:'Automated extraction unavailable · use manual values'};
    return {className:'pending',text:'PDF stored · confirm values below'};
  }

  function uploadBody(section){
    const meta=state.documents[section.id];
    const status=meta?extractionLabel({...meta,sectionId:section.id}):null;
    const canRetry=meta?.evidenceId && ['failed','uploaded'].includes(meta.extractionStatus||meta.extraction_status||'');
    return `<div class="evidence-upload ${meta?'received':''}">
      <div class="upload-mark">${meta?checkIcon:'<span>↑</span>'}</div>
      <div class="upload-copy">
        <h3>${meta?'Report received':'Upload PDF report'}</h3>
        <p>${esc(section.copy)}</p>
        ${meta?`<div class="uploaded-file"><strong>${esc(meta.name)}</strong>${meta.size?`<span>${formatSize(meta.size)}</span>`:''}</div>`:''}
        ${status?`<div class="extraction-status ${status.className}">${esc(status.text)}</div>`:''}
        <div class="upload-actions">
          <label class="upload-button">${meta?'Replace PDF':'Choose PDF'}<input type="file" data-file="${section.id}" accept="application/pdf,.pdf"></label>
          ${canRetry?`<button type="button" class="retry-analysis" data-retry="${section.id}">Retry automated extraction</button>`:''}
        </div>
      </div>
    </div>
    <div class="evidence-requirements">${section.requirements.map(item=>`<div>${checkIcon}<span>${esc(item)}</span></div>`).join('')}</div>`;
  }

  function inputControl(section,field){
    const values=manualFor(section);
    const value=values[field.key]??'';
    if(field.type==='level'){
      const options=levelOptions[field.key]||[];
      return `<select data-manual-key="${field.key}"><option value="">Select level</option>${options.map((label,index)=>`<option value="${index}" ${String(value)===String(index)?'selected':''}>${index} · ${esc(label)}</option>`).join('')}</select>`;
    }
    const suffix=field.type==='percent'?'%':field.type==='months'?'months':'';
    const prefix=field.type==='money'?'$':'';
    return `<div class="manual-input-wrap">${prefix?`<span class="manual-prefix">${prefix}</span>`:''}<input data-manual-key="${field.key}" type="number" step="any" value="${esc(value)}" placeholder="0">${suffix?`<span class="manual-suffix">${suffix}</span>`:''}</div>`;
  }

  function manualBody(section){
    const fields=fieldGroups[section.id]||[];
    if(!fields.length)return '';
    const saveState=state.saveState[section.id]||'';
    return `<section class="manual-evidence-panel">
      <div class="manual-evidence-head">
        <div><span class="manual-kicker">CONFIRM FINANCIAL VALUES</span><h3>Manual values used for scoring</h3><p>Enter values directly from the uploaded report or your accounting records. Required fields are marked. These values remain <strong>unverified</strong> until evidence is validated.</p></div>
        <button type="button" class="manual-save" data-save-manual="${section.id}">${saveState==='saving'?'Saving…':saveState==='saved'?'Saved ✓':'Save values'}</button>
      </div>
      <div class="manual-grid">${fields.map(field=>`<label class="manual-field"><span>${esc(field.label)}${field.required?'<b>Required</b>':''}</span>${inputControl(section,field)}${field.help?`<small>${esc(field.help)}</small>`:''}</label>`).join('')}</div>
      <div class="manual-section-error" id="manualError-${section.id}"></div>
    </section>`;
  }

  function sdeBody(section){
    return `<div class="sde-panel">
      <h3>Owner benefits</h3><p>${esc(section.copy)}</p>
      <div class="sde-options">${benefits.map(([id,label])=>`<label class="radio-option-card sde-option ${state.addbacks[id]?'selected':''}"><span class="option-copy">${esc(label)}</span><input type="checkbox" data-addback="${id}" ${state.addbacks[id]?'checked':''}><span class="checkbox-ui">${state.addbacks[id]?checkIcon:''}</span></label>`).join('')}</div>
      <label class="ownership-field ${state.addbacks.distributions?'show':''}" id="ownershipField"><span>Ownership percentage</span><div><input id="ownershipPercent" type="number" min="0" max="100" value="${esc(state.ownershipPercent)}" placeholder="100"><b>%</b></div></label>
      <p class="sde-note">The scoring rubric specifically requires owner add-backs and capital allocation inputs. Enter the financial values below.</p>
    </div>${manualBody(section)}`;
  }

  function sectionCard(section){
    const done=isComplete(section);
    return `<article class="q-card fade-in">
      <header class="q-card-header"><div><div class="question-kicker">SECTION ${state.sectionIndex+1} OF ${sections.length}</div><h1>${esc(section.title)}</h1><p>${esc(section.copy)}</p></div><span class="evidence-status ${done?'complete':''}">${done?`${checkIcon} Complete`:'Required'}</span></header>
      <div class="q-card-body">${section.type==='sde'?sdeBody(section):`${uploadBody(section)}${manualBody(section)}`}</div>
      <footer class="q-card-footer"><button type="button" class="btn-back" id="previous" ${state.sectionIndex===0?'disabled':''}>← Back</button><span class="saved-note">Saved securely</span><button type="button" class="btn-next active" id="next">${state.sectionIndex===sections.length-1?'Review':'Continue'} ${arrowIcon}</button></footer>
    </article>`;
  }

  function reviewCard(){
    return `<article class="q-card fade-in">
      <header class="q-card-header review-header"><div><div class="question-kicker">REVIEW</div><h1>Calculate Agency Performance</h1><p>The Performance Index will now be calculated from the confirmed financial values using the five-capability scoring rubric.</p></div><span class="evidence-status ${allComplete()?'complete':''}">${allComplete()?`${checkIcon} Ready`:'Incomplete'}</span></header>
      <div class="q-card-body">
        <div class="performance-review-list">${sections.map((section,index)=>`<button type="button" class="performance-review-row" data-review-section="${index}"><span>${esc(section.title)}</span><strong class="${isComplete(section)?'done':''}">${isComplete(section)?`${checkIcon} Complete`:'Missing required values'}</strong></button>`).join('')}</div>
        <div class="review-error ${state.finishError?'show':''}" id="reviewError">${esc(state.finishError||'Complete every section before calculating Financial Performance.')}</div>
        <div class="performance-analysis-note"><strong>Scoring:</strong> Profitability 25%, Growth 20%, Revenue Quality 20%, Cash Performance 20%, Capital Allocation 15%. Missing optional metrics reduce confidence rather than being silently scored as zero. Manual/unverified evidence is capped below fully verified confidence.</div>
      </div>
      <footer class="q-card-footer"><button type="button" class="btn-back" id="previous">← Back</button><span class="saved-note">Database-backed</span><button type="button" class="btn-next ${allComplete()?'active':'disabled'}" id="completePerformance">${IS_RETAKE?'Recalculate & regenerate report':'Calculate Performance Index'} ${arrowIcon}</button></footer>
    </article>`;
  }

  function benefitIds(){return benefits.filter(([id])=>state.addbacks[id]).map(([id])=>id);}

  function captureManualInputs(section){
    document.querySelectorAll('[data-manual-key]').forEach(input=>{
      manualFor(section)[input.dataset.manualKey]=input.value;
    });
    if(section.type==='sde'){
      const owner=document.querySelector('#ownershipPercent');
      if(owner)state.ownershipPercent=owner.value;
    }
    persist();
  }

  function sectionMissing(section){
    const missing=[];
    if(section.type!=='sde'&&!state.documents[section.id])missing.push('Sync QuickBooks or upload the PDF report');
    const values=manualFor(section);
    (fieldGroups[section.id]||[]).filter(field=>field.required).forEach(field=>{if(!hasNumber(values[field.key]))missing.push(field.label);});
    return missing;
  }

  async function saveManualSection(section,{silent=false}={}){
    captureManualInputs(section);
    if(!window.CCFinancialEvidence)return null;
    state.saveState[section.id]='saving';
    if(!silent)render();
    try{
      let result;
      if(section.type==='sde'){
        state.sdeReviewed=true;
        result=await window.CCFinancialEvidence.saveSde({benefits:benefitIds(),ownershipPercent:state.ownershipPercent||null,values:manualFor(section)});
        if(result?.evidence)state.sdeEvidenceId=result.evidence.id;
      }else{
        result=await window.CCFinancialEvidence.saveManual(section.evidenceType,manualFor(section));
      }
      const row=result?.evidence;
      if(row?.extracted_data)state.manual[section.id]={...manualFor(section),...row.extracted_data};
      if(row&&section.type!=='sde'&&state.documents[section.id]){
        state.documents[section.id]={...state.documents[section.id],extractionStatus:row.extraction_status||'processed',extractionModel:row.extraction_model||'manual_entry',extractionError:row.extraction_error||'',extractedAt:row.extracted_at||null};
      }
      state.saveState[section.id]='saved';
      state.remoteError='';
      persist();
      if(!silent)render();
      return result;
    }catch(error){
      state.saveState[section.id]='';
      state.remoteError=error.message||'Financial values could not be saved.';
      if(!silent){render();const el=document.querySelector(`#manualError-${section.id}`);if(el){el.textContent=state.remoteError;el.classList.add('show');}}
      throw error;
    }
  }

  async function handleUpload(section,file){
    if(!window.CCFinancialEvidence?.uploadPdf){state.documents[section.id]={...fileMeta(file),extractionStatus:'uploaded'};persist();render();return;}
    if(file.size>window.CCFinancialEvidence.maxFileBytes){state.documents[section.id]={...fileMeta(file),extractionStatus:'failed',extractionError:'PDF must be 4 MB or smaller.'};persist();render();return;}

    state.documents[section.id]={...fileMeta(file)};
    state.uploadState[section.id]='uploading';persist();render();
    try{
      const result=await window.CCFinancialEvidence.uploadPdf(section.evidenceType,file);
      const row=result?.evidence||{};
      state.documents[section.id]={name:row.file_name||file.name,size:Number(row.file_size_bytes)||file.size,type:row.mime_type||file.type||'application/pdf',receivedAt:row.updated_at||new Date().toISOString(),evidenceId:row.id||null,storagePath:row.storage_path||null,extractionStatus:row.extraction_status||'uploaded',extractionModel:row.extraction_model||null,extractionError:result?.extractionError?.message||row.extraction_error||'',extractedAt:row.extracted_at||null};
      if(row.extracted_data&&typeof row.extracted_data==='object')state.manual[section.id]={...manualFor(section),...row.extracted_data};
    }catch(error){state.documents[section.id]={...state.documents[section.id],extractionStatus:'failed',extractionError:error.message||'Upload failed.'};}
    finally{delete state.uploadState[section.id];persist();render();}
  }

  async function retryAnalysis(section){
    const meta=state.documents[section.id];
    if(!meta?.evidenceId||!window.CCFinancialEvidence?.retryExtraction)return;
    state.uploadState[section.id]='extracting';persist();render();
    try{
      const result=await window.CCFinancialEvidence.retryExtraction(meta.evidenceId,section.evidenceType);
      const row=result?.evidence||{};
      state.documents[section.id]={...meta,extractionStatus:row.extraction_status||'processed',extractionModel:row.extraction_model||'',extractionError:row.extraction_error||'',extractedAt:row.extracted_at||null};
      if(row.extracted_data&&typeof row.extracted_data==='object')state.manual[section.id]={...manualFor(section),...row.extracted_data};
    }catch(error){state.documents[section.id]={...meta,extractionStatus:'failed',extractionError:error.message||'Automated extraction failed. Manual entry remains available.'};}
    finally{delete state.uploadState[section.id];persist();render();}
  }

  function bindManual(section){
    document.querySelectorAll('[data-manual-key]').forEach(input=>{
      input.addEventListener('input',()=>{manualFor(section)[input.dataset.manualKey]=input.value;state.saveState[section.id]='';persist();});
      input.addEventListener('change',()=>{manualFor(section)[input.dataset.manualKey]=input.value;state.saveState[section.id]='';persist();});
    });
    document.querySelector('[data-save-manual]')?.addEventListener('click',()=>saveManualSection(section).catch(()=>null));
  }

  function bindSection(section){
    document.querySelector('#previous')?.addEventListener('click',()=>{captureManualInputs(section);state.sectionIndex=Math.max(0,state.sectionIndex-1);persist();render();});
    document.querySelector('#next')?.addEventListener('click',async()=>{
      captureManualInputs(section);
      const missing=sectionMissing(section);
      if(missing.length){const el=document.querySelector(`#manualError-${section.id}`);if(el){el.textContent=`Complete: ${missing.join(', ')}.`;el.classList.add('show');}return;}
      try{await saveManualSection(section,{silent:true});}catch(error){const el=document.querySelector(`#manualError-${section.id}`);if(el){el.textContent=error.message||'Financial values could not be saved.';el.classList.add('show');}return;}
      state.sectionIndex=Math.min(sections.length,state.sectionIndex+1);persist();render();
    });
    document.querySelectorAll('[data-file]').forEach(input=>input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');if(!isPdf){state.documents[section.id]={...fileMeta(file),extractionStatus:'failed',extractionError:'Only PDF reports can be uploaded.'};persist();render();return;}handleUpload(section,file);}));
    document.querySelectorAll('[data-retry]').forEach(btn=>btn.addEventListener('click',()=>retryAnalysis(section)));
    if(section.type==='sde'){
      document.querySelectorAll('[data-addback]').forEach(input=>input.addEventListener('change',()=>{state.addbacks[input.dataset.addback]=input.checked;if(input.dataset.addback==='distributions')document.querySelector('#ownershipField')?.classList.toggle('show',input.checked);persist();}));
      document.querySelector('#ownershipPercent')?.addEventListener('input',event=>{state.ownershipPercent=event.target.value;persist();});
    }
    bindManual(section);
  }

  function bindReview(){
    document.querySelector('#previous')?.addEventListener('click',()=>{state.sectionIndex=sections.length-1;persist();render();});
    document.querySelectorAll('[data-review-section]').forEach(btn=>btn.addEventListener('click',()=>{state.sectionIndex=Number(btn.dataset.reviewSection);persist();render();}));
    document.querySelector('#completePerformance')?.addEventListener('click',finish);
  }

  function renderSection(){
    if(currentIsReview()){host.innerHTML=reviewCard();bindReview();return;}
    const section=sections[state.sectionIndex];host.innerHTML=sectionCard(section);bindSection(section);
  }

  async function finish(){
    if(!allComplete()){state.finishError='Complete every section and all required financial values before calculating Performance.';render();return;}
    const button=document.querySelector('#completePerformance');
    if(button){button.disabled=true;button.textContent=IS_RETAKE?'Saving & regenerating…':'Calculating Performance…';}
    state.finishError='';
    try{
      for(const section of sections)await saveManualSection(section,{silent:true});
      if(!window.CCFinancialEvidence?.calculatePerformance)throw new Error('Performance scoring backend is not loaded.');
      const result=await window.CCFinancialEvidence.calculatePerformance();
      const performance=result?.performance;
      if(!performance||!Number.isFinite(Number(performance.score)))throw new Error('The Performance score was not returned by the backend.');
      const score=Number(performance.score);
      const details={...(performance.details||{}),retakenAt:IS_RETAKE?new Date().toISOString():null};
      localStorage.setItem('agencyPerformanceDetails',JSON.stringify(details));
      localStorage.setItem('agencyPerformanceScore',String(score));
      localStorage.setItem('agencyPerformanceDraft',JSON.stringify({sectionIndex:state.sectionIndex,documents:state.documents,addbacks:state.addbacks,sdeReviewed:state.sdeReviewed,ownershipPercent:state.ownershipPercent,manual:state.manual}));
      if(window.CCDiagnostic?.mark)window.CCDiagnostic.mark('performance',score,details);
      else localStorage.setItem('ccIndexPerformanceComplete','true');

      if(window.CCDiagnostic&&window.CCAccount?.syncDiagnosticState){
        await window.CCAccount.syncDiagnosticState(window.CCDiagnostic.serialize(),{throwOnError:true});
      }

      const diagnosticState=window.CCDiagnostic?.getState?.()||{};
      if(diagnosticState.allComplete&&window.CCScorecard?.generate){
        window.CCScorecard.clear?.();
        await window.CCScorecard.generate();
        window.CCDiagnostic?.completeReportGeneration?.();
        if(window.CCAccount?.syncDiagnosticState){
          await window.CCAccount.syncDiagnosticState(window.CCDiagnostic.serialize(),{throwOnError:true});
        }
        location.href=IS_RETAKE?'/agency-scorecard/?updated=performance':'/agency-scorecard/?generated=performance';
        return;
      }

      location.href='/diagnostic/?updated=performance';
    }catch(error){
      console.error('Agency Performance retake could not be saved.',error);
      state.finishError=error.message||'Agency Performance could not be calculated.';
      render();
    }
  }

  function render(){renderNav();updateProgress();renderSection();persist();}

  function hydrateEvidenceRow(row){
    const section=sectionByEvidenceType(row.evidence_type);if(!section)return;
    const data=row.extracted_data&&typeof row.extracted_data==='object'?row.extracted_data:{};
    state.manual[section.id]={...manualFor(section),...data};
    if(section.type==='sde'){
      const selected=new Set(Array.isArray(data.benefits)?data.benefits:[]);benefits.forEach(([id])=>{state.addbacks[id]=selected.has(id);});
      state.ownershipPercent=data.ownershipPercent??state.ownershipPercent??'';state.sdeReviewed=Boolean(row.id);state.sdeEvidenceId=row.id;return;
    }
    if(!row.storage_path&&!row.file_name)return;
    state.documents[section.id]={name:row.file_name||'Financial evidence.pdf',size:Number(row.file_size_bytes)||0,type:row.mime_type||'application/pdf',receivedAt:row.updated_at||row.created_at||'',evidenceId:row.id,storagePath:row.storage_path,extractionStatus:row.extraction_status||'uploaded',extractionModel:row.extraction_model||null,extractionError:row.extraction_error||'',extractedAt:row.extracted_at||null};
  }

  async function hydrateRemoteEvidence(){
    if(!window.CCFinancialEvidence?.list){state.remoteLoaded=true;return;}
    try{const result=await window.CCFinancialEvidence.list();(result.evidence||[]).forEach(hydrateEvidenceRow);state.remoteError='';}
    catch(error){state.remoteError=error.message||'Saved financial evidence could not be loaded.';}
    finally{state.remoteLoaded=true;persist();render();}
  }

  if(IS_RETAKE)state.sectionIndex=0;
  else if(window.CCDiagnostic?.getState?.().performance)state.sectionIndex=sections.length;
  render();hydrateRemoteEvidence();
})();
