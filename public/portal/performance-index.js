(() => {
  const CATEGORIES = [
    {
      id:'profitability', title:'Profitability', weight:25,
      capability:'Can management consistently produce healthy, predictable earnings?',
      questions:[
        ['grossMargin','Gross Margin','How efficiently the agency delivers services before overhead.',20,['Less than 30%','30–39.9%','40–49.9%','50–59.9%','60%+']],
        ['netMargin','Net Margin','How effectively management converts revenue into profit.',25,['Less than 5%','5–9.9%','10–14.9%','15–19.9%','20%+']],
        ['sdeMargin','EBITDA / SDE Margin','The earnings available to an owner or investor.',20,['Less than 10%','10–14.9%','15–19.9%','20–24.9%','25%+']],
        ['marginStability','Margin Stability','Evaluate the last 24 months.',15,['Declining and highly volatile','Flat or volatile','Stable with occasional fluctuations','Consistently stable','Stable and improving over 24 months']],
        ['grossProfitGrowth','TTM Gross Profit Growth','Whether the agency is creating more gross profit.',10,['Negative','0–4.9%','5–9.9%','10–19.9%','20%+']],
        ['profitConversion','Incremental Profit Conversion','New Net Income ÷ New Revenue.',10,['Less than 5%','5–9.9%','10–19.9%','20–29.9%','30%+']]
      ]
    },
    {
      id:'growth', title:'Growth Performance & Trends', weight:20,
      capability:'Can management grow the agency in a healthy, sustainable way?',
      questions:[
        ['revenueGrowth','TTM Revenue Growth','Trailing twelve-month revenue growth.',30,['Negative','0–4.9%','5–9.9%','10–19.9%','20%+']],
        ['netIncomeGrowth','TTM Net Income Growth','Trailing twelve-month net-income growth.',30,['Negative','0–4.9%','5–9.9%','10–19.9%','20%+']],
        ['growthConsistency','Growth Consistency','Evaluate the last 24 months.',20,['Revenue declining','Highly inconsistent','Stable with fluctuations','Consistently growing','Consistently growing with accelerating profit']],
        ['revenuePredictability','Revenue Predictability','Measured from monthly revenue volatility.',20,['Extremely volatile','High variability','Moderate consistency','Predictable','Highly predictable recurring growth']]
      ]
    },
    {
      id:'revenueQuality', title:'Revenue Quality', weight:20,
      capability:"How durable and transferable is the agency's revenue?",
      questions:[
        ['recurringRevenue','Recurring Revenue','Share of revenue that is recurring.',25,['Less than 20%','20–39.9%','40–59.9%','60–79.9%','80%+']],
        ['clientConcentration','Largest Client Concentration','Largest client as a percentage of total revenue.',25,['Greater than 30%','20–29.9%','15–19.9%','10–14.9%','Less than 10%']],
        ['revenueDiversification','Revenue Diversification','Number and balance of meaningful clients.',20,['Very concentrated','Limited diversification','Moderate','Well diversified','Highly diversified']],
        ['averageClientTenure','Average Client Tenure','Average duration of active client relationships.',15,['Less than 12 months','1–2 years','2–3 years','3–5 years','Greater than 5 years']],
        ['contractDuration','Contract Duration','Typical contractual commitment.',15,['Project only','Month-to-month','6-month average','12-month average','Multi-year relationships']]
      ]
    },
    {
      id:'cash', title:'Cash Performance', weight:20,
      capability:'Can management generate and protect liquidity?',
      questions:[
        ['cashReserve','Cash Reserve','Months of operating expenses held in unrestricted cash.',25,['Less than 1','1–2','2–3','3–6','More than 6']],
        ['operatingCashFlow','Operating Cash Flow','Operating cash-flow trend.',25,['Negative','Break-even','Positive but inconsistent','Positive and stable','Positive and consistently growing']],
        ['currentRatio','Current Ratio','Current Assets ÷ Current Liabilities.',20,['Less than 1.0','1.0–1.24','1.25–1.49','1.5–2.0','Greater than 2.0']],
        ['arCollection','Accounts Receivable Aging','Percentage collected within 30 days.',15,['Less than 50%','50–69.9%','70–84.9%','85–94.9%','95%+']],
        ['debtPosition','Debt Position','Debt-to-EBITDA ratio.',15,['Greater than 4x','3–4x','2–3x','1–2x','Less than 1x']]
      ]
    },
    {
      id:'capital', title:'Capital Allocation', weight:15,
      capability:'Does management deploy capital to increase future enterprise value?',
      questions:[
        ['returnOnCapital','Return on Capital','Incremental Operating Profit ÷ Capital Invested.',30,['Negative','0–9.9%','10–19.9%','20–29.9%','30%+']],
        ['reinvestmentRate','Reinvestment Rate','Percentage of profits intentionally reinvested.',20,['Less than 10%','10–24.9%','25–39.9%','40–59.9%','60%+']],
        ['technologyInvestment','Technology Investment','How intentionally technology investment improves productivity and margin.',15,['Reactive spending only','Occasional purchases','Annual technology plan','Strategic technology investment','Technology consistently improves productivity and margins']],
        ['talentInvestment','Talent Investment','How intentionally talent investment creates capability.',15,['No leadership development','Occasional training','Defined development plans','Leadership development program','Talent investments consistently produce measurable organizational capability']],
        ['retainedEarningsGrowth','Retained Earnings Growth','Whether equity compounds over time.',20,['Declining','Flat','Growing slowly','Growing consistently','Growing rapidly while maintaining profitability']]
      ]
    }
  ];
  const ADD_BACKS=['Owner health insurance','One-time legal expenses','Car insurance','Personal vehicle expenses','Travel and lodging','Education or memberships','Family on payroll','Other owner benefits'];
  const INVESTMENTS=['Sales Team','Marketing (Events, Travel)','AI','New Software or Technology','Leadership Hiring','Training','SOP Documentation & Development','Client Rewards','New Services or Products','Other'];
  const EVIDENCE=[
    ['pnl','P&L statement','Level 1 · measures Profitability and Growth',true],
    ['balanceSheet','Balance Sheet','Level 2 · adds liquidity and capital structure',false],
    ['cashFlow','Cash Flow Statement','Level 2 · adds Cash Performance',false],
    ['clientRevenue','Client Revenue Detail','Level 3 · adds Revenue Quality',false],
    ['arap','AR/AP Aging','Level 3 · validates collections and liabilities',false],
    ['investmentAllocation','Owner Investment Allocation','Level 3 · supports ROIC-Lite',false],
    ['budget','Budget','Level 3 · supports planning and confidence',false],
    ['forecast','Forecast','Level 3 · supports growth predictability',false],
    ['ownerAddbacks','Owner Add-Backs Schedule','Level 3 · defines Adjusted SDE',false]
  ];
  const STEPS=[...CATEGORIES.map(c=>({id:c.id,title:c.title,type:'category'})),{id:'sde',title:'SDE & investments',type:'manual'},{id:'evidence',title:'Evidence',type:'evidence'}];
  const safeJson=(v,f)=>{try{return JSON.parse(v)}catch{return f}};
  const stored=safeJson(localStorage.getItem('ccPerformanceState'),{})||{};
  const model={step:Number.isFinite(Number(stored.step))?Math.max(0,Math.min(STEPS.length-1,Number(stored.step))):0,answers:stored.answers||{},manual:stored.manual||{addbacks:{},investments:{},investmentTiming:''},evidence:stored.evidence||{files:[]}};
  const root=document.getElementById('performanceStep'),nav=document.getElementById('performanceStepNav'),back=document.getElementById('performanceBack'),next=document.getElementById('performanceNext'),bar=document.getElementById('answeredBar'),count=document.getElementById('answeredCount'),stepCounter=document.getElementById('stepCounter');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:0});

  function persist(){localStorage.setItem('ccPerformanceState',JSON.stringify(model));localStorage.setItem('ccPerformanceAnswers',JSON.stringify(model.answers));const progress=progressPercent();localStorage.setItem('ccIndexPerformanceProgress',String(Math.min(99,progress)));window.CCDiagnostic?.setProgress?.('performance',Math.min(99,progress));}
  function questionCount(){return CATEGORIES.reduce((sum,c)=>sum+c.questions.length,0)}
  function answeredCount(){return Object.keys(model.answers).filter(key=>model.answers[key]!==undefined&&model.answers[key]!==null).length}
  function progressPercent(){const metricPart=answeredCount()/questionCount()*82;const manualPart=manualComplete()?8:0;const evidencePart=model.evidence.files?.length?10:0;return Math.round(metricPart+manualPart+evidencePart)}
  function manualComplete(){const m=model.manual;return ['currentNetIncome','ownerCompensation','priorAdjustedSDE'].every(key=>String(m[key]??'').trim()!=='')&&Boolean(m.investmentTiming)}
  function categoryComplete(category){return category.questions.every(q=>model.answers[q[0]]!==undefined)}
  function renderNav(){nav.innerHTML=STEPS.map((step,index)=>{const complete=step.type==='category'?categoryComplete(CATEGORIES[index]):step.type==='manual'?manualComplete():Boolean(model.evidence.files?.length);return `<button type="button" data-step="${index}" class="${index===model.step?'active':''} ${complete?'complete':''}">${index+1}. ${esc(step.title)}</button>`}).join('');nav.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const target=Number(button.dataset.step);if(target<=model.step||canAdvance(model.step)){model.step=target;persist();render()}}));}
  function renderCategory(category){root.innerHTML=`<div class="performance-step-head"><div><span>${esc(category.title)} · ${category.weight}%</span><h2>${esc(category.title)}</h2><p>${esc(category.capability)}</p></div></div><div class="metric-list">${category.questions.map((q,index)=>`<article class="metric-card"><div class="metric-title"><div><h3>${index+1}. ${esc(q[1])}</h3><p>${esc(q[2])}</p></div><span>${q[3]}% of category</span></div><div class="metric-options">${q[4].map((label,value)=>`<label><input type="radio" name="${esc(q[0])}" value="${value}" ${String(model.answers[q[0]])===String(value)?'checked':''}><b>${esc(label)}</b></label>`).join('')}</div></article>`).join('')}</div><p class="performance-error" id="performanceError">Answer every metric in this section before continuing.</p>`;root.querySelectorAll('input[type=radio]').forEach(input=>input.addEventListener('change',()=>{model.answers[input.name]=Number(input.value);persist();updateHeader();renderNav()}));}
  function amountRows(items,key){return items.map((label,index)=>{const id=`${key}-${index}`;const item=model.manual[key]?.[label]||{selected:false,amount:''};return `<div class="amount-item"><label><input type="checkbox" data-kind="${key}" data-label="${esc(label)}" ${item.selected?'checked':''}>${esc(label)}</label><input type="number" min="0" step="0.01" data-amount-kind="${key}" data-amount-label="${esc(label)}" value="${esc(item.amount)}" placeholder="$ amount" ${item.selected?'':'disabled'}></div>`}).join('')}
  function manualNumbers(){const addbacks=Object.values(model.manual.addbacks||{}).reduce((s,item)=>s+(item.selected?Number(item.amount||0):0),0);const investments=Object.values(model.manual.investments||{}).reduce((s,item)=>s+(item.selected?Number(item.amount||0):0),0);const adjusted=Number(model.manual.currentNetIncome||0)+Number(model.manual.ownerCompensation||0)+addbacks;const prior=Number(model.manual.priorAdjustedSDE||0);const roic=investments>0?(adjusted-prior)/investments*100:null;return{addbacks,investments,adjusted,prior,roic}}
  function renderManual(){const n=manualNumbers();root.innerHTML=`<div class="performance-step-head"><div><span>Manual inputs required by the scoring specification</span><h2>SDE & Capital Allocation Review</h2><p>Adjusted SDE and intentional capital investments connect the Performance Index to agency value and ROIC-Lite.</p></div></div><div class="sde-grid"><section class="form-block"><h3>Seller Discretionary Earnings Review</h3><p>Enter the last 12 months. Add back owner compensation and qualifying owner benefits or one-time expenses.</p><div class="field-row"><div class="field"><label>TTM net income</label><input type="number" min="0" step="0.01" data-manual="currentNetIncome" value="${esc(model.manual.currentNetIncome)}" placeholder="0"></div><div class="field"><label>Owner compensation</label><input type="number" min="0" step="0.01" data-manual="ownerCompensation" value="${esc(model.manual.ownerCompensation)}" placeholder="0"></div></div><div class="field"><label>Prior-year Adjusted SDE</label><input type="number" min="0" step="0.01" data-manual="priorAdjustedSDE" value="${esc(model.manual.priorAdjustedSDE)}" placeholder="0"></div><div class="amount-list">${amountRows(ADD_BACKS,'addbacks')}</div></section><section class="form-block"><h3>Capital Allocation Review</h3><p>Select intentional investments made during the last fiscal year and enter the incremental amount.</p><div class="amount-list">${amountRows(INVESTMENTS,'investments')}</div><div class="field" style="margin-top:13px"><label>When did these investments primarily occur?</label><select data-manual="investmentTiming"><option value="">Select timing</option>${['Beginning of Year','Middle of Year','End of Year'].map(v=>`<option ${model.manual.investmentTiming===v?'selected':''}>${v}</option>`).join('')}</select></div></section></div><div class="calculation-card"><div><span>Adjusted SDE</span><strong>$${money(n.adjusted)}</strong></div><div><span>Capital invested</span><strong>$${money(n.investments)}</strong></div><div><span>ROIC-Lite</span><strong>${n.roic===null?'Not available':`${n.roic.toFixed(1)}%`}</strong></div></div><p class="completion-note">The PDF defines these as manual inputs. The questionnaire can still score the category, while uploaded evidence raises confidence and validates the narrative.</p><p class="performance-error" id="performanceError">Complete the three required SDE fields and investment timing before continuing.</p>`;
    root.querySelectorAll('[data-manual]').forEach(input=>input.addEventListener('input',()=>{model.manual[input.dataset.manual]=input.value;persist();renderManual()}));
    root.querySelectorAll('[data-kind]').forEach(box=>box.addEventListener('change',()=>{const kind=box.dataset.kind,label=box.dataset.label;model.manual[kind]=model.manual[kind]||{};model.manual[kind][label]=model.manual[kind][label]||{amount:''};model.manual[kind][label].selected=box.checked;persist();renderManual()}));
    root.querySelectorAll('[data-amount-kind]').forEach(input=>input.addEventListener('input',()=>{const kind=input.dataset.amountKind,label=input.dataset.amountLabel;model.manual[kind]=model.manual[kind]||{};model.manual[kind][label]=model.manual[kind][label]||{selected:true};model.manual[kind][label].amount=input.value;persist();const n2=manualNumbers();const strongs=root.querySelectorAll('.calculation-card strong');if(strongs[0])strongs[0].textContent=`$${money(n2.adjusted)}`;if(strongs[1])strongs[1].textContent=`$${money(n2.investments)}`;if(strongs[2])strongs[2].textContent=n2.roic===null?'Not available':`${n2.roic.toFixed(1)}%`}));
  }
  function evidenceLevel(){const types=new Set((model.evidence.files||[]).map(file=>file.type));const level1=types.has('pnl');const level2=level1&&types.has('balanceSheet')&&types.has('cashFlow');const level3Count=['clientRevenue','arap','investmentAllocation','budget','forecast','ownerAddbacks'].filter(type=>types.has(type)).length;if(level2&&level3Count===6)return{label:'Very High',score:95,validation:'Verified'};if(level2)return{label:'High',score:82,validation:'Needs Validation'};if(level1)return{label:'Medium',score:65,validation:'Needs Validation'};return{label:'Low',score:45,validation:'Needs Validation'}}
  function renderEvidence(){const level=evidenceLevel();root.innerHTML=`<div class="performance-step-head"><div><span>Financial evidence</span><h2>Upload supporting documents</h2><p>The Performance Index can be completed from questionnaire inputs, but the scoring specification makes confidence evidence-dependent.</p></div></div><div class="evidence-grid">${EVIDENCE.map(([type,label,help,required])=>{const file=(model.evidence.files||[]).find(item=>item.type===type);return `<article class="evidence-card ${required?'required':''}"><h3>${esc(label)}${required?' · foundation':''}</h3><p>${esc(help)}</p><input type="file" data-evidence="${type}" accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,image/*"><div class="evidence-status ${file?'saved':''}" data-status="${type}">${file?`Saved: ${esc(file.name)}`:'No file selected'}</div></article>`}).join('')}</div><div class="confidence-preview"><div><h3>Current evidence confidence</h3><p>${level.label} confidence · ${level.validation}. Questionnaire-only completion remains usable, but it is not treated as fully verified.</p></div><strong>${level.score}%</strong></div><p class="completion-note">Files are saved to the private Supabase <code>diagnostic-evidence</code> bucket when the backend is configured. Files up to 4 MB are accepted by the included Vercel upload endpoint.</p>`;root.querySelectorAll('[data-evidence]').forEach(input=>input.addEventListener('change',()=>handleEvidence(input)))}
  async function handleEvidence(input){const file=input.files?.[0];if(!file)return;const type=input.dataset.evidence,status=root.querySelector(`[data-status="${type}"]`);if(file.size>4*1024*1024){status.textContent='File exceeds the 4 MB upload limit.';return}status.textContent='Saving...';let record={type,label:EVIDENCE.find(row=>row[0]===type)?.[1],name:file.name,size:file.size,mimeType:file.type,stored:false,selectedAt:new Date().toISOString()};try{const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});const acct=window.CCAccount?.getAccount?.()||{};const response=await fetch('/api/evidence-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accountId:acct.id,evidenceType:type,fileName:file.name,mimeType:file.type||'application/octet-stream',base64})});const payload=await response.json().catch(()=>({}));if(response.ok)record={...record,...payload.file,stored:true};else throw new Error(payload.error||'Backend upload unavailable')}catch(error){record.localOnly=true;record.uploadError=error.message}model.evidence.files=(model.evidence.files||[]).filter(item=>item.type!==type);model.evidence.files.push(record);persist();renderEvidence();updateHeader();renderNav()}
  function render(){renderNav();const step=STEPS[model.step];if(step.type==='category')renderCategory(CATEGORIES[model.step]);else if(step.type==='manual')renderManual();else renderEvidence();back.disabled=model.step===0;next.textContent=model.step===STEPS.length-1?'Complete index →':'Continue →';updateHeader();window.scrollTo({top:0,behavior:'smooth'})}
  function canAdvance(stepIndex){const step=STEPS[stepIndex];if(step.type==='category')return categoryComplete(CATEGORIES[stepIndex]);if(step.type==='manual')return manualComplete();return true}
  function showError(){const error=document.getElementById('performanceError');if(error)error.classList.add('show')}
  function categoryScore(category){return Math.round(category.questions.reduce((sum,q)=>sum+((Number(model.answers[q[0]])||0)/4*q[3]),0))}
  function finish(){const categoryScores=Object.fromEntries(CATEGORIES.map(category=>[category.id,categoryScore(category)]));const overallScore=Math.round(CATEGORIES.reduce((sum,category)=>sum+categoryScores[category.id]*category.weight/100,0));const level=evidenceLevel(),numbers=manualNumbers();const evidenceTypes=new Set((model.evidence.files||[]).map(file=>file.type));const missingEvidence=EVIDENCE.filter(row=>!evidenceTypes.has(row[0])).map(row=>row[1]);const details={answers:model.answers,categoryScores,overallScore,manual:model.manual,adjustedSDE:numbers.adjusted,capitalInvested:numbers.investments,roicLite:numbers.roic,evidence:model.evidence,evidenceLevel:level.label,confidenceScore:level.score,validationStatus:level.validation,missingEvidence,completedAt:new Date().toISOString()};window.CCDiagnostic?.mark?.('performance',overallScore,details);if(!window.CCDiagnostic){localStorage.setItem('agencyPerformanceScore',String(overallScore));localStorage.setItem('ccIndexPerformanceComplete','true');localStorage.setItem('ccIndexPerformanceResult',JSON.stringify(details))}location.href='/diagnostic/'}
  next.addEventListener('click',()=>{if(!canAdvance(model.step)){showError();return}if(model.step<STEPS.length-1){model.step++;persist();render()}else finish()});back.addEventListener('click',()=>{if(model.step>0){model.step--;persist();render()}});
  function updateHeader(){const progress=progressPercent();bar.style.width=`${progress}%`;count.textContent=`${progress}%`;stepCounter.textContent=`Step ${model.step+1} of ${STEPS.length}`}
  render();persist();
})();
