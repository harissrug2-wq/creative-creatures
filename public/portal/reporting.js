(() => {
  const LOGO_BASE64 = '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';

  const safeJson = (value, fallback = null) => { try { return JSON.parse(value); } catch { return fallback; } };
  const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const account = () => window.CCAccount?.getAccount?.() || safeJson(localStorage.getItem('cc_account'), {}) || {};
  const ownerReport = () => safeJson(localStorage.getItem('ownerArchetypeReportData'), {}) || {};
  const state = () => window.CCDiagnostic?.getState?.() || { indexes:{} };
  let databaseScorecard = null;
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

  const localReports = () => ({performance:performanceReport(),strength:strengthReport(),independence:independenceReport()});
  const reports = () => databaseScorecard?.reports || localReports();
  function scorecard() {
    if (databaseScorecard) return databaseScorecard;
    const r = localReports();
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

  async function ensurePdfLib() {
    if (window.PDFLib) return window.PDFLib;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/shared/pdf-lib.min.js';
      s.onload = () => resolve(window.PDFLib);
      s.onerror = () => reject(new Error('Failed to load PDF engine.'));
      document.head.appendChild(s);
    });
  }

  async function makePdfBytesAsync(model) {
    const PDFLib = await ensurePdfLib();
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    let logoImage = null;
    try {
      const logoBytes = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {}

    const C = {
      navy: rgb(0.067, 0.071, 0.094),
      blue: rgb(0.161, 0.161, 0.929),
      royal: rgb(0.145, 0.388, 0.921),
      dark: rgb(0.059, 0.090, 0.165),
      body: rgb(0.200, 0.255, 0.333),
      muted: rgb(0.392, 0.455, 0.545),
      cardBg: rgb(0.973, 0.980, 0.988),
      cardBorder: rgb(0.886, 0.910, 0.941),
      quoteBg: rgb(0.937, 0.965, 1.000),
      white: rgb(1, 1, 1),
      emerald: rgb(0.063, 0.725, 0.506),
      amber: rgb(0.851, 0.467, 0.024),
      red: rgb(0.863, 0.149, 0.149)
    };

    function scoreColor(val) {
      const n = Number(val) || 0;
      if (n >= 80) return C.emerald;
      if (n >= 60) return C.royal;
      if (n >= 50) return C.amber;
      return C.red;
    }

    function cleanText(text) {
      return String(text || '')
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/\u2122/g, '(TM)')
        .replace(/\u00AE/g, '(R)')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
    }

    function wrapText(text, maxChars) {
      const words = cleanText(text).split(/\s+/).filter(Boolean);
      if (!words.length) return [''];
      const lines = [];
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    const reports = model.reports || {};
    const isScorecard = Boolean(model.band || model.score !== undefined);

    function setupPage(pageTitle = 'AGENCY DIAGNOSTIC REPORT') {
      const page = pdfDoc.addPage([612, 792]);
      const { width, height } = page.getSize();

      page.drawRectangle({ x: 0, y: height - 60, width, height: 60, color: C.navy });
      page.drawRectangle({ x: 0, y: height - 64, width, height: 4, color: C.blue });

      if (logoImage) {
        const dims = logoImage.scale(0.24);
        page.drawImage(logoImage, { x: 36, y: height - 48, width: dims.width, height: dims.height });
      } else {
        page.drawText('CREATIVE CREATURES', { x: 36, y: height - 40, size: 14, font: fontBold, color: C.white });
      }

      const titleText = cleanText(pageTitle).toUpperCase();
      page.drawText(titleText, { x: width - 36 - fontBold.widthOfTextAtSize(titleText, 10), y: height - 38, size: 10, font: fontBold, color: rgb(0.8, 0.85, 1.0) });

      return page;
    }

    function drawFooter(page, pageNum, totalPages) {
      const { width } = page.getSize();
      page.drawLine({ start: { x: 36, y: 36 }, end: { x: width - 36, y: 36 }, thickness: 1, color: C.cardBorder });
      page.drawText('Creative Creatures Agency Intelligence Platform  |  https://creativecreatures.ai', { x: 36, y: 18, size: 8, font, color: C.muted });
      const pageStr = `Page ${pageNum} of ${totalPages}`;
      page.drawText(pageStr, { x: width - 36 - font.widthOfTextAtSize(pageStr, 8), y: 18, size: 8, font, color: C.muted });
    }

    // PAGE 1: COVER
    const page1 = setupPage(isScorecard ? 'AGENCY OWNER FREEDOM INDEX™' : (model.title || 'DIAGNOSTIC REPORT'));
    const { width } = page1.getSize();
    let y = 700;

    const mainTitle = isScorecard ? 'Agency Owner Freedom Index™ (AOFI™)' : cleanText(model.title || 'Agency Diagnostic Report');
    page1.drawText(mainTitle, { x: 36, y, size: 18, font: fontBold, color: C.dark });
    y -= 18;

    const subtitle = isScorecard ? 'Executive Baseline & Valuation Readiness Report' : 'Capability Assessment & Operating Infrastructure Breakdown';
    page1.drawText(subtitle, { x: 36, y, size: 10, font, color: C.muted });
    y -= 25;

    page1.drawRectangle({ x: 36, y: y - 28, width: width - 72, height: 32, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 1 });
    const archetypeText = `Owner Archetype: ${cleanText(model.archetype || 'Owner Archetype')}`;
    const dateText = `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    page1.drawText(archetypeText, { x: 48, y: y - 18, size: 9, font: fontBold, color: C.body });
    page1.drawText(dateText, { x: width - 48 - font.widthOfTextAtSize(dateText, 9), y: y - 18, size: 9, font, color: C.muted });
    y -= 45;

    if (isScorecard) {
      const cardH = 110;
      page1.drawRectangle({ x: 36, y: y - cardH, width: width - 72, height: cardH, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 1 });

      const scoreVal = String(model.score ?? 0);
      const scoreCol = scoreColor(model.score);
      page1.drawRectangle({ x: 52, y: y - cardH + 18, width: 80, height: 74, color: scoreCol });

      const sWidth = fontBold.widthOfTextAtSize(scoreVal, 32);
      page1.drawText(scoreVal, { x: 52 + (80 - sWidth) / 2, y: y - cardH + 50, size: 32, font: fontBold, color: C.white });
      const scaleText = '/ 100';
      const scWidth = font.widthOfTextAtSize(scaleText, 10);
      page1.drawText(scaleText, { x: 52 + (80 - scWidth) / 2, y: y - cardH + 30, size: 10, font, color: C.white });

      const bandLabel = cleanText(model.band?.label || 'Scorecard Summary').toUpperCase();
      page1.drawText(bandLabel, { x: 148, y: y - 30, size: 14, font: fontBold, color: C.dark });

      const bandMeaning = cleanText(model.band?.meaning || 'Baseline index for agency performance and valuation.');
      const meaningLines = wrapText(bandMeaning, 54);
      let my = y - 48;
      meaningLines.slice(0, 2).forEach(line => {
        page1.drawText(line, { x: 148, y: my, size: 10, font, color: C.body });
        my -= 14;
      });

      const confText = `Confidence: ${model.confidence ?? 60}%`;
      const valText = `Validation: ${cleanText(model.validation || 'Needs Validation')}`;

      page1.drawRectangle({ x: 148, y: y - cardH + 18, width: 110, height: 20, color: rgb(0.93, 0.95, 0.98) });
      page1.drawText(confText, { x: 156, y: y - cardH + 24, size: 8, font: fontBold, color: C.royal });

      page1.drawRectangle({ x: 266, y: y - cardH + 18, width: 140, height: 20, color: rgb(0.93, 0.95, 0.98) });
      page1.drawText(valText, { x: 274, y: y - cardH + 24, size: 8, font: fontBold, color: C.body });

      y -= cardH + 25;
    }

    page1.drawText('CORE INDEX BREAKDOWN', { x: 36, y, size: 11, font: fontBold, color: C.royal });
    y -= 15;

    const repList = Object.values(reports);
    const cardW = (width - 72 - 24) / 3;
    let cx = 36;
    const indexH = 100;

    repList.forEach(rep => {
      page1.drawRectangle({ x: cx, y: y - indexH, width: cardW, height: indexH, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 1 });
      page1.drawRectangle({ x: cx, y: y - 24, width: cardW, height: 24, color: C.navy });

      const titleShort = cleanText(rep.title || 'Index').replace('Agency ', '').replace(' Index', '');
      page1.drawText(titleShort.toUpperCase(), { x: cx + 10, y: y - 16, size: 9, font: fontBold, color: C.white });

      const rScore = String(rep.score ?? 0);
      const rCol = scoreColor(rep.score);
      page1.drawText(rScore, { x: cx + 12, y: y - 56, size: 24, font: fontBold, color: rCol });
      page1.drawText('/ 100', { x: cx + 12 + fontBold.widthOfTextAtSize(rScore, 24) + 4, y: y - 52, size: 9, font, color: C.muted });

      const cStr = `Conf: ${rep.confidence}%`;
      page1.drawText(cStr, { x: cx + 12, y: y - 76, size: 8, font, color: C.body });
      const vStr = `Val: ${cleanText(rep.validation)}`;
      page1.drawText(vStr, { x: cx + 12, y: y - 88, size: 8, font, color: C.muted });

      cx += cardW + 12;
    });

    y -= indexH + 25;

    if (Array.isArray(model.weakest) && model.weakest.length > 0) {
      page1.drawText('HIGHEST-PRIORITY CAPABILITY GAPS', { x: 36, y, size: 11, font: fontBold, color: C.royal });
      y -= 15;

      const gapBoxH = 140;
      page1.drawRectangle({ x: 36, y: y - gapBoxH, width: width - 72, height: gapBoxH, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 1 });

      let gy = y - 24;
      model.weakest.slice(0, 5).forEach((item, idx) => {
        const rank = `${idx + 1}.`;
        page1.drawText(rank, { x: 48, y: gy, size: 9, font: fontBold, color: C.royal });

        const name = cleanText(item.name || 'Capability');
        page1.drawText(name, { x: 64, y: gy, size: 9, font: fontBold, color: C.dark });

        const indexTag = `(${cleanText(item.indexTitle || item.index || '').replace('Agency ', '').replace(' Index', '')})`;
        page1.drawText(indexTag, { x: 240, y: gy, size: 8, font, color: C.muted });

        const barX = 360;
        const barW = 120;
        const barFill = Math.max(0, Math.min(100, Number(item.score) || 0));
        page1.drawRectangle({ x: barX, y: gy - 2, width: barW, height: 8, color: rgb(0.9, 0.92, 0.95) });
        page1.drawRectangle({ x: barX, y: gy - 2, width: (barW * barFill) / 100, height: 8, color: scoreColor(barFill) });

        const sText = `${barFill}/100`;
        page1.drawText(sText, { x: barX + barW + 8, y: gy, size: 8, font: fontBold, color: C.dark });

        gy -= 24;
      });
    }

    drawFooter(page1, 1, repList.length + 1);

    // PAGES 2+: INDEX DETAILS
    let pageNum = 2;
    for (const rep of repList) {
      const page = setupPage(rep.title || 'INDEX REPORT');
      let iy = 700;

      const headerH = 50;
      page.drawRectangle({ x: 36, y: iy - headerH, width: width - 72, height: headerH, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 1 });

      const rTitle = cleanText(rep.title || 'Index Report').toUpperCase();
      page.drawText(rTitle, { x: 48, y: iy - 22, size: 14, font: fontBold, color: C.dark });

      const scoreStr = `${rep.score}/100`;
      const sColor = scoreColor(rep.score);
      page.drawText(scoreStr, { x: width - 48 - fontBold.widthOfTextAtSize(scoreStr, 18), y: iy - 24, size: 18, font: fontBold, color: sColor });

      const subMeta = `Confidence: ${rep.confidence}%  |  Validation: ${cleanText(rep.validation)}`;
      page.drawText(subMeta, { x: 48, y: iy - 40, size: 9, font, color: C.muted });
      iy -= headerH + 20;

      if (rep.executiveQuestion) {
        page.drawText('EXECUTIVE QUESTION', { x: 36, y: iy, size: 9, font: fontBold, color: C.royal });
        iy -= 14;
        const qLines = wrapText(rep.executiveQuestion, 80);
        qLines.forEach(line => {
          page.drawText(line, { x: 36, y: iy, size: 10, font: fontOblique, color: C.body });
          iy -= 14;
        });
        iy -= 10;
      }

      if (rep.narrative) {
        page.drawText('EXECUTIVE SUMMARY & NARRATIVE', { x: 36, y: iy, size: 9, font: fontBold, color: C.royal });
        iy -= 14;

        const nLines = wrapText(rep.narrative, 76);
        const nBoxH = Math.max(40, nLines.length * 14 + 16);

        page.drawRectangle({ x: 36, y: iy - nBoxH, width: width - 72, height: nBoxH, color: C.quoteBg, borderColor: rgb(0.8, 0.88, 1.0), borderWidth: 1 });
        page.drawRectangle({ x: 36, y: iy - nBoxH, width: 4, height: nBoxH, color: C.blue });

        let ny = iy - 18;
        nLines.forEach(line => {
          page.drawText(line, { x: 48, y: ny, size: 9, font, color: C.dark });
          ny -= 14;
        });

        iy -= nBoxH + 20;
      }

      if (Array.isArray(rep.categories) && rep.categories.length > 0) {
        page.drawText('CAPABILITY CATEGORY SCORES', { x: 36, y: iy, size: 9, font: fontBold, color: C.royal });
        iy -= 14;

        const catBoxH = rep.categories.length * 22 + 16;
        page.drawRectangle({ x: 36, y: iy - catBoxH, width: width - 72, height: catBoxH, color: C.cardBg, borderColor: C.cardBorder, borderWidth: 1 });

        let cy = iy - 22;
        rep.categories.forEach(cat => {
          const cName = cleanText(cat.name || 'Category');
          page.drawText(cName, { x: 48, y: cy, size: 9, font: fontBold, color: C.dark });

          const wText = cat.weight ? `(${cat.weight}%)` : '';
          page.drawText(wText, { x: 220, y: cy, size: 8, font, color: C.muted });

          const bX = 280;
          const bW = 180;
          const cVal = Math.max(0, Math.min(100, Number(cat.score) || 0));
          page.drawRectangle({ x: bX, y: cy - 2, width: bW, height: 8, color: rgb(0.9, 0.92, 0.95) });
          page.drawRectangle({ x: bX, y: cy - 2, width: (bW * cVal) / 100, height: 8, color: scoreColor(cVal) });

          const valLabel = `${cVal}/100`;
          page.drawText(valLabel, { x: bX + bW + 8, y: cy, size: 8, font: fontBold, color: C.dark });

          cy -= 22;
        });

        iy -= catBoxH + 20;
      }

      if (rep.primaryConstraint || rep.recommendation) {
        if (rep.primaryConstraint) {
          page.drawText('PRIMARY CONSTRAINT', { x: 36, y: iy, size: 9, font: fontBold, color: C.amber });
          iy -= 12;
          const pcLines = wrapText(rep.primaryConstraint, 80);
          pcLines.forEach(line => {
            page.drawText(line, { x: 36, y: iy, size: 9, font: fontBold, color: C.dark });
            iy -= 12;
          });
          iy -= 8;
        }

        if (rep.recommendation) {
          page.drawText('RECOMMENDED NEXT MOVE', { x: 36, y: iy, size: 9, font: fontBold, color: C.royal });
          iy -= 12;
          const recLines = wrapText(rep.recommendation, 80);
          recLines.forEach(line => {
            page.drawText(line, { x: 36, y: iy, size: 9, font, color: C.body });
            iy -= 12;
          });
          iy -= 14;
        }
      }

      if (Array.isArray(rep.evidence) || Array.isArray(rep.missingEvidence)) {
        const colW = (width - 72 - 20) / 2;

        if (Array.isArray(rep.evidence)) {
          page.drawText('EVIDENCE EVALUATED', { x: 36, y: iy, size: 9, font: fontBold, color: C.emerald });
          let ey = iy - 14;
          rep.evidence.slice(0, 5).forEach(item => {
            page.drawText(`• ${cleanText(item)}`, { x: 36, y: ey, size: 8, font, color: C.body });
            ey -= 11;
          });
        }

        if (Array.isArray(rep.missingEvidence)) {
          const mx = 36 + colW + 20;
          page.drawText('UNVERIFIED / MISSING EVIDENCE', { x: mx, y: iy, size: 9, font: fontBold, color: C.amber });
          let my = iy - 14;
          rep.missingEvidence.slice(0, 5).forEach(item => {
            page.drawText(`• ${cleanText(item)}`, { x: mx, y: my, size: 8, font, color: C.body });
            my -= 11;
          });
        }
      }

      drawFooter(page, pageNum, repList.length + 1);
      pageNum++;
    }

    return await pdfDoc.save();
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadReport(index) {
    const model = index === 'scorecard' ? scorecard() : reports()[index];
    if (!model) return;
    try {
      const bytes = await makePdfBytesAsync(model);
      downloadBytes(bytes, `creative-creatures-${index}-report.pdf`);
    } catch (e) {
      console.error('PDF generation error:', e);
    }
  }

  async function pdfBase64(index) {
    const model = index === 'scorecard' ? scorecard() : reports()[index];
    if (!model) return '';
    try {
      const bytes = await makePdfBytesAsync(model);
      let binary = '';
      bytes.forEach(byte => binary += String.fromCharCode(byte));
      return btoa(binary);
    } catch (e) {
      console.error('PDF base64 error:', e);
      return '';
    }
  }

  function textSummary(index) {
    const model = index === 'scorecard' ? scorecard() : reports()[index];
    return (index === 'scorecard' ? scorecardLines(model) : reportLines(model)).join('\n');
  }

  async function emailReport(index, recipient) {
    const model = index === 'scorecard' ? scorecard() : reports()[index];
    const email = String(recipient || account()?.email || localStorage.getItem('ccOwnerEmail') || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
    const acc = account();
    const firstName = acc?.name ? acc.name.split(' ')[0] : (localStorage.getItem('ccOwnerFirstName') || '');
    const p64 = await pdfBase64(index);
    try {
      const response = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          index,
          type: index === 'scorecard' ? 'scorecard' : index,
          firstName,
          title: model.title || 'Agency Scorecard',
          summary: textSummary(index),
          pdfBase64: p64,
          filename: `creative-creatures-${index}-report.pdf`
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Email delivery is not configured.');
      return payload;
    } catch (error) {
      const subject = encodeURIComponent(`See your AOFI™ score, what is affecting it and where to focus next.`);
      const body = encodeURIComponent(textSummary(index).slice(0, 7000));
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
      return { fallback: true };
    }
  }

  function openEmailDialog(index) {
    let dialog = document.getElementById('ccEmailReportDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'ccEmailReportDialog';
      dialog.className = 'cc-report-dialog';
      dialog.innerHTML = `<form method="dialog"><button class="dialog-close" value="cancel" aria-label="Close">×</button><h2>Email report</h2><p>Send a PDF copy of this report.</p><label>Email address<input type="email" id="ccReportEmail" required></label><div class="dialog-status" id="ccReportStatus"></div><div class="dialog-actions"><button value="cancel" class="cc-btn cc-btn-light">Cancel</button><button type="button" class="cc-btn cc-btn-primary" id="ccSendReport">Send report</button></div></form>`;
      document.body.appendChild(dialog);
    }
    dialog.dataset.index = index;
    dialog.querySelector('#ccReportEmail').value = account()?.email || localStorage.getItem('ccOwnerEmail') || '';
    dialog.querySelector('#ccReportStatus').textContent = '';
    dialog.querySelector('#ccSendReport').onclick = async () => {
      const button = dialog.querySelector('#ccSendReport');
      const status = dialog.querySelector('#ccReportStatus');
      button.disabled = true;
      status.textContent = 'Sending...';
      try {
        const result = await emailReport(dialog.dataset.index, dialog.querySelector('#ccReportEmail').value);
        status.textContent = result.fallback ? 'Your email app has been opened.' : 'Report emailed.';
        if (!result.fallback) setTimeout(() => dialog.close(), 900);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
    dialog.showModal();
  }

  const setScorecardModel = model => { databaseScorecard = model && typeof model === 'object' ? model : null; return databaseScorecard; };
  window.CCReports = { reports, scorecard, setScorecardModel, downloadReport, emailReport, openEmailDialog, reportLines, scorecardLines, esc, aofiBand, pdfBase64, makePdfBytesAsync };
})();
