(() => {
  const EMAIL = 'immad@brandandbrains.co';
  const lower = v => String(v || '').trim().toLowerCase();
  const isDemo = account => lower(account?.email) === EMAIL;

  const diagnosticState = () => ({
    purchasedPlans:['platform'],
    paymentComplete:true,
    integrationsComplete:true,
    goalsComplete:true,
    count:3,
    allComplete:true,
    reportReady:true,
    generatedAt:'2026-09-28T12:00:00.000Z',
    indexes:{
      strength:{complete:true,progress:100,score:82,details:{results:{overallScore:82,confidenceScore:91,validationStatus:'Verified',categoryScores:{leadership:84,operating:76,financial:81,revenue:85,people:84}}}},
      independence:{complete:true,progress:100,score:74,details:{scores:{overallIndexScore:74,confidenceScore:88,validationStatus:'Verified',categoryDetails:{decision:{score:78},revenue:{score:69},delivery:{score:71},leadership:{score:76},strategic:{score:76}},ownerTime:{deliveryPercent:18,salesPercent:22}}}},
      performance:{complete:true,progress:100,score:86,details:{overallScore:86,confidenceScore:94,validationStatus:'Verified',categoryScores:{profitability:88,growth:82,revenueQuality:85,cash:84,capital:91},adjustedSDE:510000,roicLite:34.8,evidenceLevel:'Verified financial evidence',evidence:{files:[{label:'Profit & Loss'},{label:'Balance Sheet'},{label:'A/R Aging'},{label:'Client Revenue'}]}}}
    }
  });

  const goals = () => ({
    account:{name:'Immad Uddin',agencyName:'Brand & Brains'},
    goalsComplete:true,goalsCompletedAt:'2026-09-25T12:00:00.000Z',hasMonitorAccess:true,canManageTeam:true,memberCount:3,
    metrics:[
      {id:'ownerDelivery',group:'Owner Dependency',label:'Owner Time in Delivery (%)',unit:'%',available:true,actualValue:18,actualDisplay:'18%',source:'Owner Independence evidence'},
      {id:'ownerSales',group:'Owner Dependency',label:'Owner Time in Sales (%)',unit:'%',available:true,actualValue:22,actualDisplay:'22%',source:'Owner Independence evidence'},
      {id:'revenue',group:'Financial',label:'Revenue (TTM)',unit:'$',available:true,actualValue:2400000,actualDisplay:'$2,400,000',source:'Financial evidence'},
      {id:'cogs',group:'Financial',label:'COGS % of Revenue',unit:'%',available:true,actualValue:41,actualDisplay:'41%',source:'Financial evidence'},
      {id:'margin',group:'Financial',label:'Net (Profit) Margin',unit:'%',available:true,actualValue:21,actualDisplay:'21%',source:'Financial evidence'},
      {id:'sde',group:'Financial',label:'SDE',unit:'$',available:true,actualValue:510000,actualDisplay:'$510,000',source:'Agency Performance'},
      {id:'leadership',group:'Operational',label:'Leadership Maturity Level',unit:'level',available:true,actualValue:4,actualDisplay:'4 / 5',source:'Agency Strength'},
      {id:'aofi',group:'Operational',label:'Agency Owner Freedom Index (AOFI) Score',unit:'score',available:true,actualValue:82,actualDisplay:'82',source:'Generated Agency Scorecard'},
      {id:'valuation',group:'Agency Value',label:'Enterprise Valuation',unit:'$',available:true,actualValue:3050000,actualDisplay:'$3,050,000',source:'Agency Valuation'}
    ],
    targets:{
      revenue:{type:'number',value:3000000,resolvedValue:3000000,baselineValue:2400000},
      cogs:{type:'number',value:35,resolvedValue:35,baselineValue:41},
      margin:{type:'number',value:25,resolvedValue:25,baselineValue:21},
      aofi:{type:'number',value:90,resolvedValue:90,baselineValue:82},
      valuation:{type:'number',value:3600000,resolvedValue:3600000,baselineValue:3050000},
      ownerDelivery:{type:'number',value:10,resolvedValue:10,baselineValue:18},
      ownerSales:{type:'number',value:12,resolvedValue:12,baselineValue:22},
      leadership:{type:'number',value:5,resolvedValue:5,baselineValue:4}
    },
    progress:{revenue:{percent:46,achieved:false},cogs:{percent:32,achieved:false},margin:{percent:50,achieved:false},aofi:{percent:55,achieved:false},valuation:{percent:42,achieved:false},ownerDelivery:{percent:38,achieved:false},ownerSales:{percent:44,achieved:false},leadership:{percent:70,achieved:false}},
    progressHistory:{revenue:[{actualValue:2150000,capturedAt:'2026-03-31T12:00:00Z'},{actualValue:2280000,capturedAt:'2026-06-30T12:00:00Z'},{actualValue:2400000,capturedAt:'2026-09-25T12:00:00Z'}],margin:[{actualValue:18,capturedAt:'2026-03-31T12:00:00Z'},{actualValue:19.5,capturedAt:'2026-06-30T12:00:00Z'},{actualValue:21,capturedAt:'2026-09-25T12:00:00Z'}]},
    departments:[
      {name:'Leadership',goal:'Move weekly operating review to leadership team',owner:'Immad Uddin',status:'On Track',done:'Leadership team runs weekly review without founder',completionDate:'2026-12-15'},
      {name:'Marketing',goal:'Generate 45 qualified opportunities per month',owner:'Sarah Khan',status:'On Track',done:'45 qualified opportunities for 3 consecutive months',completionDate:'2026-12-31'},
      {name:'Sales',goal:'Increase close rate to 32%',owner:'Ali Raza',status:'Watch',done:'32% rolling 90-day close rate',completionDate:'2026-12-31'},
      {name:'Onboarding',goal:'Reduce onboarding cycle to 7 days',owner:'Operations Lead',status:'On Track',done:'90% of clients live within 7 days',completionDate:'2026-11-30'},
      {name:'Billing',goal:'Keep receivables over 60 days below 5%',owner:'Finance Lead',status:'On Track',done:'Over-60-day AR below 5% for 2 months',completionDate:'2026-12-31'},
      {name:'Service Delivery',goal:'Raise delivery gross margin to 59%',owner:'Delivery Lead',status:'Watch',done:'59% gross margin for 2 consecutive months',completionDate:'2026-12-31'},
      {name:'Client Success',goal:'Maintain NPS above 60',owner:'Client Success Lead',status:'On Track',done:'NPS >= 60 with quarterly survey',completionDate:'2026-12-31'}
    ],
    rocks:[
      {id:'demo-rock-1',title:'Delegate pricing approvals',description:'Move standard discount and pricing decisions to sales leadership.',owner:'Ali Raza',dueDate:'2026-11-15',status:'On track',sourceType:'scorecard'},
      {id:'demo-rock-2',title:'Install weekly KPI operating cadence',description:'Leadership owns a weekly scorecard review with actions and owners.',owner:'Immad Uddin',dueDate:'2026-10-31',status:'On track',sourceType:'scorecard'},
      {id:'demo-rock-3',title:'Improve project margin visibility',description:'Track estimated vs actual hours and gross margin by service line.',owner:'Delivery Lead',dueDate:'2026-12-01',status:'Watch',sourceType:'manual'}
    ],
    members:[{name:'Sarah Khan',email:'sarah@brandandbrains.co',departments:['marketing']},{name:'Ali Raza',email:'ali@brandandbrains.co',departments:['sales']},{name:'Ayesha Malik',email:'ayesha@brandandbrains.co',departments:['client-success']}],
    readiness:{targetCount:8,targetTotal:9,definedDepartmentCount:7,departmentTotal:7,rockCount:3,evidenceGaps:[]}
  });

  const evidence = () => ({evidence:[
    {evidence_type:'profit_loss',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{revenueTTM:2400000,cogsPercent:41,netMargin:21,netIncomeTTM:504000}},
    {evidence_type:'balance_sheet',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{cash:420000,currentAssets:690000,currentLiabilities:230000,currentRatio:3}},
    {evidence_type:'client_revenue',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{totalRevenue:2400000,clients:[{name:'Northstar',revenue:420000},{name:'BluePeak',revenue:310000},{name:'Vertex',revenue:285000},{name:'Nexa',revenue:240000},{name:'Orbit',revenue:220000},{name:'Other clients',revenue:925000}]}},
    {evidence_type:'service_revenue_mix',extraction_status:'processed',validation_status:'verified',updated_at:'2026-09-25T12:00:00Z',extracted_data:{totalRevenue:2400000,recurringRevenue:1680000,projectRevenue:720000,recurringRevenuePercent:70,projectRevenuePercent:30}}
  ]});


  function scorecard() {
    const reports = {
      performance:{
        id:'performance',title:'Agency Performance Index',score:86,confidence:94,validation:'Verified',
        executiveQuestion:'How effectively does agency management convert revenue into long-term financial value?',
        narrative:'The agency has strong profitability and capital allocation with healthy revenue quality. Growth consistency remains the clearest financial opportunity.',
        categories:[
          {name:'Profitability',score:88,weight:25},{name:'Growth Performance',score:82,weight:20},{name:'Revenue Quality',score:85,weight:20},{name:'Cash Performance',score:84,weight:20},{name:'Capital Allocation',score:91,weight:15}
        ],
        primaryConstraint:'Growth Performance is the largest financial-value constraint.',
        recommendation:'Build a more predictable new-business engine while protecting margin and recurring revenue.',
        evidence:['Profit & Loss','Balance Sheet','A/R Aging','Client Revenue','Service Revenue Mix'],
        missingEvidence:[],adjustedSDE:510000,roicLite:34.8,evidenceLevel:'Verified financial evidence'
      },
      strength:{
        id:'strength',title:'Agency Strength Index',score:82,confidence:91,validation:'Verified',
        executiveQuestion:'Can this business continue performing if it doubled in size over the next 24 months?',
        narrative:'The agency has solid leadership, financial and revenue infrastructure. Operating-system consistency is the main scaling constraint.',
        categories:[
          {name:'Leadership System',score:84,weight:20},{name:'Operating System',score:76,weight:20},{name:'Financial Infrastructure',score:81,weight:20},{name:'Revenue Infrastructure',score:85,weight:20},{name:'People Infrastructure',score:84,weight:20}
        ],
        primaryConstraint:'Operating System is the current structural constraint.',
        recommendation:'Document core delivery, install QA ownership, and make operating KPIs visible to department leaders.',
        evidence:['31-step questionnaire','Operating cadence','Department KPI review'],missingEvidence:[]
      },
      independence:{
        id:'independence',title:'Owner Independence Index',score:74,confidence:88,validation:'Verified',
        executiveQuestion:'Can this business succeed without its founder?',
        narrative:'Leadership and strategic activity continue without the owner, but revenue and delivery still require more founder independence.',
        categories:[
          {name:'Decision Independence',score:78,weight:20},{name:'Revenue Independence',score:69,weight:20},{name:'Delivery Independence',score:71,weight:20},{name:'Leadership Independence',score:76,weight:20},{name:'Strategic Independence',score:76,weight:20}
        ],
        primaryConstraint:'Revenue Independence creates the strongest founder-dependence signal.',
        recommendation:'Move pipeline, referrals, and marketing ownership away from the founder and into a measurable revenue system.',
        evidence:['Owner time allocation','Leadership ownership','Revenue ownership'],missingEvidence:[]
      }
    };
    const weakest = [
      {name:'Revenue Independence',capability:'Revenue Independence',index:'independence',indexTitle:'Owner Independence Index',score:69},
      {name:'Delivery Independence',capability:'Delivery Independence',index:'independence',indexTitle:'Owner Independence Index',score:71},
      {name:'Operating System',capability:'Operating System',index:'strength',indexTitle:'Agency Strength Index',score:76},
      {name:'Leadership Independence',capability:'Leadership Independence',index:'independence',indexTitle:'Owner Independence Index',score:76},
      {name:'Strategic Independence',capability:'Strategic Independence',index:'independence',indexTitle:'Owner Independence Index',score:76}
    ];
    const issues = weakest.map(row=>({...row,description:`${row.name} is below the other measured capabilities and should be improved in the next planning cycle.`}));
    const rec = {
      'Revenue Independence':'Move pipeline, referrals, and marketing ownership away from the founder and into a measurable revenue system.',
      'Delivery Independence':'Shift day-to-day delivery approvals and client escalation ownership to the delivery leadership team.',
      'Operating System':'Document core delivery workflows, install QA ownership, and track adherence to SOPs.',
      'Leadership Independence':'Have department leaders own recurring operating meetings, decisions, and accountability.',
      'Strategic Independence':'Protect owner time for strategy, capital allocation, and leadership coaching.'
    };
    const opportunities = weakest.map((row,i)=>({...row,recommendation:rec[row.name],estimatedLift:[6,5,4,4,4][i]}));
    return {
      title:'Agency Scorecard',
      score:82,
      confidence:92,
      band:{label:'High Performing',meaning:'Strong agency with targeted opportunities.'},
      validation:'Verified',
      reports,
      weakest,
      issues,
      opportunities,
      archetype:'Strategic Builder',
      generatedAt:'2026-09-28T12:00:00.000Z',
      valuation:{
        available:true,
        status:'available',
        adjustedSDE:510000,
        baseMultiple:5.35,
        adjustments:{strength:0.25,ownerIndependence:-0.10,roicLite:0.30,revenueQuality:0.18},
        finalMultiple:5.98,
        enterpriseValue:3049800,
        evidenceGaps:[]
      },
      momentum:{
        state:'up',delta:5,label:'▲ 5 pts',primaryDriver:{label:'Performance',change:6},
        positiveElements:[
          {title:'Profitability',category:'Performance',points:3,description:'Net margin and adjusted SDE improved while revenue continued to grow.'},
          {title:'Operating System',category:'Strength',points:2,description:'Delivery QA and KPI ownership became more consistent.'}
        ],
        negativeElements:[
          {title:'Revenue Independence',category:'Owner Independence',points:1,description:'Founder involvement in pipeline and referrals remains elevated.'}
        ]
      }
    };
  }

  function scorecardHistory() {
    return [
      {quarter:'Q4 2025',generatedAt:'2025-12-20T12:00:00Z',score:68,confidence:78,performance:72,strength:69,independence:58,enterpriseValue:2260000,positiveElements:[],negativeElements:[]},
      {quarter:'Q1 2026',generatedAt:'2026-03-25T12:00:00Z',score:72,confidence:83,performance:77,strength:73,independence:61,enterpriseValue:2480000,previousQuarter:'Q4 2025',positiveElements:[{title:'Margin discipline',category:'Performance',points:2,description:'Gross margin and cash discipline improved.'}],negativeElements:[]},
      {quarter:'Q2 2026',generatedAt:'2026-06-25T12:00:00Z',score:77,confidence:88,performance:80,strength:78,independence:69,enterpriseValue:2740000,previousQuarter:'Q1 2026',positiveElements:[{title:'Leadership cadence',category:'Strength',points:3,description:'Department leaders assumed more operating ownership.'}],negativeElements:[{title:'Founder sales dependence',category:'Independence',points:1,description:'Founder still influenced too much of new business.'}]},
      {quarter:'Q3 2026',generatedAt:'2026-09-28T12:00:00Z',score:82,confidence:92,performance:86,strength:82,independence:74,enterpriseValue:3049800,previousQuarter:'Q2 2026',positiveElements:[{title:'Profitability',category:'Performance',points:3,description:'Net margin and adjusted SDE improved while revenue continued to grow.'},{title:'Operating System',category:'Strength',points:2,description:'Delivery QA and KPI ownership became more consistent.'}],negativeElements:[{title:'Revenue Independence',category:'Owner Independence',points:1,description:'Founder involvement in pipeline and referrals remains elevated.'}]}
    ];
  }

  function apply(account) {
    if (!isDemo(account)) return account;
    const state = diagnosticState();
    const reportData = {...(account.report_data||account.reportData||{}),token:'demo-owner-report',title:'Strategic Builder',archetypeTitle:'Strategic Builder',summary:'A growth-oriented agency owner building systems, leadership capacity, and founder independence.'};
    return {...account,journey:'platform',access_plan:'platform',accessPlan:'platform',agency_name:account.agency_name||account.agencyName||'Brand & Brains',agencyName:account.agency_name||account.agencyName||'Brand & Brains',archetype_result:{...(account.archetype_result||{}),title:'Strategic Builder'},report_data:reportData,reportData,diagnostic_state:state,diagnosticState:state};
  }

  function seed(account) {
    if (!isDemo(account)) return account;
    const resolved = apply(account);
    window.CCDemo = {enabled:true,email:EMAIL,goals:goals(),evidence:evidence(),scorecard:scorecard(),scorecardHistory:scorecardHistory()};
    localStorage.setItem('cc_account', JSON.stringify(resolved));
    localStorage.setItem('ccUserAccount', JSON.stringify(resolved));
    localStorage.setItem('ccSignedIn','true');
    localStorage.setItem('ccOwnerEmail',EMAIL);
    localStorage.setItem('ccOwnerFirstName','Immad');
    localStorage.setItem('ccOwnerLastName','Uddin');
    localStorage.setItem('ccAgencyName',resolved.agency_name||'Brand & Brains');
    localStorage.setItem('ccProgramPath','platform');
    localStorage.setItem('ownerIdentityComplete','true');
    localStorage.setItem('ownerArchetypeReportData',JSON.stringify(resolved.report_data));
    localStorage.setItem('ownerArchetypeReportToken','demo-owner-report');
    if (window.CCDiagnostic?.restore) window.CCDiagnostic.restore(resolved.diagnostic_state,{replace:true});
    else localStorage.setItem('ccPendingDiagnosticState',JSON.stringify({state:resolved.diagnostic_state,replace:true}));
    localStorage.setItem('ccPaymentComplete','true');
    localStorage.setItem('agencyPaymentComplete','true');
    localStorage.setItem('agencyIntegrationsComplete','true');
    localStorage.setItem('agencyGoalsComplete','true');
    return resolved;
  }

  const cc = window.CCAccount;
  if (cc) {
    const originalSave = cc.saveAccount?.bind(cc);
    const originalGet = cc.getAccount?.bind(cc);
    if (originalSave) cc.saveAccount = (account, options={}) => seed(originalSave(apply(account), options));
    if (originalGet) cc.getAccount = () => apply(originalGet());
    const existing = originalGet?.();
    if (existing) seed(existing);
  }
  window.CCDemoAccount = { email: EMAIL, isDemo, apply, seed };
})();