export const CATEGORIES = [
  { id: 'leadership', label: 'Leadership System', color: '#34d399' },
  { id: 'operating', label: 'Operating System', color: '#60a5fa' },
  { id: 'financial', label: 'Financial Infrastructure', color: '#f59e0b' },
  { id: 'revenue', label: 'Revenue Infrastructure', color: '#a78bfa' },
  { id: 'people', label: 'People Infrastructure', color: '#f87171' },
];

export const CATEGORY_ORDER = ['leadership', 'operating', 'financial', 'revenue', 'people'];

export const QUESTIONS = [
  // Category 1: Leadership System (20%)
  {
    id: 1,
    category: 'leadership',
    categoryLabel: 'Leadership System',
    type: 'radio',
    stressTest: false,
    text: 'Does your agency have a documented Accountability Chart with clearly defined roles and responsibilities?',
    options: [
      { label: 'No documented organizational structure', value: 0 },
      { label: 'Informal roles exist but are unclear', value: 1 },
      { label: 'Accountability Chart exists but many roles are undefined', value: 2 },
      { label: 'Accountability Chart is complete and reviewed periodically', value: 3 },
      { label: 'Accountability Chart is actively managed and updated quarterly with clear ownership and KPIs', value: 4 },
    ],
  },
  {
    id: 2,
    category: 'leadership',
    categoryLabel: 'Leadership System',
    type: 'radio',
    stressTest: false,
    text: 'Which best describes your leadership team?',
    options: [
      { label: 'Owner runs everything', value: 0 },
      { label: 'Owner has managers but no true leadership team', value: 1 },
      { label: 'Leadership team exists but owner still makes most decisions', value: 2 },
      { label: 'Leadership team owns execution with occasional owner involvement', value: 3 },
      { label: 'Leadership team independently owns company execution and accountability', value: 4 },
    ],
  },
  {
    id: 3,
    category: 'leadership',
    categoryLabel: 'Leadership System',
    type: 'radio',
    stressTest: false,
    text: 'How consistently does your leadership team follow an operating cadence?',
    options: [
      { label: 'No formal meeting cadence', value: 0 },
      { label: 'Meetings happen occasionally', value: 1 },
      { label: 'Monthly leadership meetings', value: 2 },
      { label: 'Weekly leadership meetings with agendas and follow-up', value: 3 },
      { label: 'Weekly L10s, Quarterly Planning, Annual Planning and regular scorecard reviews', value: 4 },
    ],
  },
  {
    id: 4,
    category: 'leadership',
    categoryLabel: 'Leadership System',
    type: 'radio',
    stressTest: false,
    text: 'Who owns the company KPI Scorecard?',
    options: [
      { label: 'KPIs are not tracked', value: 0 },
      { label: 'Owner tracks KPIs personally', value: 1 },
      { label: 'Owner and leadership share responsibility', value: 2 },
      { label: 'Leadership team owns KPIs', value: 3 },
      { label: 'Department leaders own KPIs and regularly improve them', value: 4 },
    ],
  },
  {
    id: 5,
    category: 'leadership',
    categoryLabel: 'Leadership System',
    type: 'radio',
    stressTest: false,
    text: 'How capable are your department leaders?',
    options: [
      { label: 'No department leaders', value: 0 },
      { label: 'Team leads exist but mainly supervise work', value: 1 },
      { label: 'Managers run departments but depend heavily on owner', value: 2 },
      { label: 'Department leaders own departmental execution', value: 3 },
      { label: 'Department leaders improve systems, develop people and deliver results independently', value: 4 },
    ],
  },
  {
    id: 6,
    category: 'leadership',
    categoryLabel: 'Leadership System',
    type: 'radio',
    stressTest: true,
    text: 'If the owner missed the next four weekly leadership meetings, what would happen?',
    options: [
      { label: 'Meetings would stop', value: 0 },
      { label: 'Meetings would probably be cancelled', value: 1 },
      { label: 'Meetings would continue but lose effectiveness', value: 2 },
      { label: 'Meetings would continue normally', value: 3 },
      { label: 'Meetings would continue and leadership performance would remain unchanged', value: 4 },
    ],
  },

  // Category 2: Operating System (20%)
  {
    id: 7,
    category: 'operating',
    categoryLabel: 'Operating System',
    type: 'radio',
    stressTest: false,
    text: 'Approximately what percentage of recurring business processes are documented?',
    options: [
      { label: 'Less than 10%', value: 0 },
      { label: '10–30%', value: 1 },
      { label: '31–60%', value: 2 },
      { label: '61–90%', value: 3 },
      { label: 'More than 90%', value: 4 },
    ],
  },
  {
    id: 8,
    category: 'operating',
    categoryLabel: 'Operating System',
    type: 'radio',
    stressTest: false,
    text: 'How standardized is client delivery?',
    options: [
      { label: 'Every project is different', value: 0 },
      { label: 'Some repeatable processes exist', value: 1 },
      { label: 'Core delivery process is documented', value: 2 },
      { label: 'Nearly all services follow standardized playbooks', value: 3 },
      { label: 'Delivery is standardized, measured and continuously optimized', value: 4 },
    ],
  },
  {
    id: 9,
    category: 'operating',
    categoryLabel: 'Operating System',
    type: 'radio',
    stressTest: false,
    text: 'How automated are your recurring administrative processes?',
    options: [
      { label: 'Almost none', value: 0 },
      { label: 'Limited automation', value: 1 },
      { label: 'Moderate automation', value: 2 },
      { label: 'Most recurring work automated', value: 3 },
      { label: 'Automation is continuously monitored and improved', value: 4 },
    ],
  },
  {
    id: 10,
    category: 'operating',
    categoryLabel: 'Operating System',
    type: 'radio',
    stressTest: false,
    text: 'How often are SOPs reviewed and updated?',
    options: [
      { label: 'Never', value: 0 },
      { label: 'Rarely', value: 1 },
      { label: 'Annually', value: 2 },
      { label: 'Quarterly', value: 3 },
      { label: 'Continuously as processes improve', value: 4 },
    ],
  },
  {
    id: 11,
    category: 'operating',
    categoryLabel: 'Operating System',
    type: 'radio',
    stressTest: false,
    text: 'How mature is your quality assurance process?',
    options: [
      { label: 'No QA process', value: 0 },
      { label: 'Informal review', value: 1 },
      { label: 'Documented QA checklist', value: 2 },
      { label: 'QA consistently followed', value: 3 },
      { label: 'QA measured with KPIs and continuous improvement', value: 4 },
    ],
  },
  {
    id: 12,
    category: 'operating',
    categoryLabel: 'Operating System',
    type: 'radio',
    stressTest: true,
    text: 'If two senior employees resigned tomorrow, how quickly could qualified replacements perform their work using existing documentation?',
    options: [
      { label: 'Documentation does not exist', value: 0 },
      { label: 'More than 6 months', value: 1 },
      { label: '3–6 months', value: 2 },
      { label: '30–90 days', value: 3 },
      { label: 'Less than 30 days', value: 4 },
    ],
  },

  // Category 3: Financial Infrastructure (20%)
  {
    id: 13,
    category: 'financial',
    categoryLabel: 'Financial Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How quickly are monthly financial statements available?',
    options: [
      { label: 'Not produced monthly', value: 0 },
      { label: 'More than 30 days after month-end', value: 1 },
      { label: 'Within 15 business days', value: 2 },
      { label: 'Within 10 business days', value: 3 },
      { label: 'Within 5 business days', value: 4 },
    ],
  },
  {
    id: 14,
    category: 'financial',
    categoryLabel: 'Financial Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'Which best describes your budgeting process?',
    options: [
      { label: 'No budget', value: 0 },
      { label: 'Annual estimate only', value: 1 },
      { label: 'Budget created but rarely used', value: 2 },
      { label: 'Budget reviewed monthly', value: 3 },
      { label: 'Budget drives strategic decisions and forecasting', value: 4 },
    ],
  },
  {
    id: 15,
    category: 'financial',
    categoryLabel: 'Financial Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How frequently are forecasts compared to actual performance?',
    options: [
      { label: 'Never', value: 0 },
      { label: 'Occasionally', value: 1 },
      { label: 'Quarterly', value: 2 },
      { label: 'Monthly', value: 3 },
      { label: 'Monthly with rolling forecasts', value: 4 },
    ],
  },
  {
    id: 16,
    category: 'financial',
    categoryLabel: 'Financial Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How mature are departmental KPIs?',
    options: [
      { label: 'No KPIs', value: 0 },
      { label: 'Company KPIs only', value: 1 },
      { label: 'Some departments track KPIs', value: 2 },
      { label: 'All departments track KPIs', value: 3 },
      { label: 'KPIs drive accountability and decisions across every department', value: 4 },
    ],
  },
  {
    id: 17,
    category: 'financial',
    categoryLabel: 'Financial Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'Which best describes your financial review process?',
    options: [
      { label: 'No structured reviews', value: 0 },
      { label: 'Owner reviews finances', value: 1 },
      { label: 'Leadership reviews quarterly', value: 2 },
      { label: 'Leadership reviews monthly', value: 3 },
      { label: 'Monthly reviews with board/advisors and strategic planning', value: 4 },
    ],
  },
  {
    id: 18,
    category: 'financial',
    categoryLabel: 'Financial Infrastructure',
    type: 'radio',
    stressTest: true,
    text: 'If your CFO or financial leader left tomorrow, how quickly could someone else assume responsibility?',
    options: [
      { label: "Financial knowledge exists only in one person's head", value: 0 },
      { label: 'More than 6 months', value: 1 },
      { label: '90–180 days', value: 2 },
      { label: '30–90 days', value: 3 },
      { label: 'Less than 30 days using documented systems', value: 4 },
    ],
  },

  // Category 4: Revenue Infrastructure (20%)
  {
    id: 19,
    category: 'revenue',
    categoryLabel: 'Revenue Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How mature is your CRM?',
    options: [
      { label: 'No CRM', value: 0 },
      { label: 'CRM used inconsistently', value: 1 },
      { label: 'CRM used by sales', value: 2 },
      { label: 'CRM drives sales process', value: 3 },
      { label: 'CRM fully integrated with reporting and automation', value: 4 },
    ],
  },
  {
    id: 20,
    category: 'revenue',
    categoryLabel: 'Revenue Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How documented is your sales process?',
    options: [
      { label: 'No documented process', value: 0 },
      { label: 'Informal process', value: 1 },
      { label: 'Documented but inconsistent', value: 2 },
      { label: 'Consistently followed', value: 3 },
      { label: 'Continuously measured and optimized', value: 4 },
    ],
  },
  {
    id: 21,
    category: 'revenue',
    categoryLabel: 'Revenue Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How consistently are inbound leads contacted?',
    options: [
      { label: 'No standard', value: 0 },
      { label: 'Usually after several days', value: 1 },
      { label: 'Within one business day', value: 2 },
      { label: 'Within four hours', value: 3 },
      { label: 'Within one hour through automated workflows', value: 4 },
    ],
  },
  {
    id: 22,
    category: 'revenue',
    categoryLabel: 'Revenue Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'Which best describes your marketing system?',
    options: [
      { label: 'No consistent marketing', value: 0 },
      { label: 'Sporadic marketing', value: 1 },
      { label: 'Consistent campaigns', value: 2 },
      { label: 'Predictable lead generation', value: 3 },
      { label: 'Marketing operates as a measurable growth engine', value: 4 },
    ],
  },
  {
    id: 23,
    category: 'revenue',
    categoryLabel: 'Revenue Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How mature is Revenue Operations?',
    options: [
      { label: 'No RevOps', value: 0 },
      { label: 'Sales only', value: 1 },
      { label: 'Sales and marketing aligned', value: 2 },
      { label: 'Revenue process documented', value: 3 },
      { label: 'Entire revenue engine measured and optimized', value: 4 },
    ],
  },
  {
    id: 24,
    category: 'revenue',
    categoryLabel: 'Revenue Infrastructure',
    type: 'radio',
    stressTest: true,
    text: 'If your top salesperson left tomorrow, what would happen?',
    options: [
      { label: 'Revenue would collapse', value: 0 },
      { label: 'Revenue would decline significantly', value: 1 },
      { label: 'Revenue would slow temporarily', value: 2 },
      { label: 'Revenue would continue with moderate disruption', value: 3 },
      { label: 'Revenue generation would continue with minimal impact', value: 4 },
    ],
  },

  // Category 5: People Infrastructure (20%)
  {
    id: 25,
    category: 'people',
    categoryLabel: 'People Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How are Core Values used?',
    options: [
      { label: 'Not defined', value: 0 },
      { label: 'Defined only', value: 1 },
      { label: 'Used in hiring', value: 2 },
      { label: 'Used in hiring and reviews', value: 3 },
      { label: 'Used to drive hiring, reviews, promotions and recognition', value: 4 },
    ],
  },
  {
    id: 26,
    category: 'people',
    categoryLabel: 'People Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How mature is your hiring process?',
    options: [
      { label: 'No defined hiring process', value: 0 },
      { label: 'Informal interviews', value: 1 },
      { label: 'Standard hiring process', value: 2 },
      { label: 'Structured hiring with scorecards', value: 3 },
      { label: 'Hiring process continuously measured and improved', value: 4 },
    ],
  },
  {
    id: 27,
    category: 'people',
    categoryLabel: 'People Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How consistently are employee performance reviews completed?',
    options: [
      { label: 'Never', value: 0 },
      { label: 'Occasionally', value: 1 },
      { label: 'Annually', value: 2 },
      { label: 'Quarterly', value: 3 },
      { label: 'Quarterly with measurable development plans', value: 4 },
    ],
  },
  {
    id: 28,
    category: 'people',
    categoryLabel: 'People Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'How well defined are career paths?',
    options: [
      { label: 'None', value: 0 },
      { label: 'Informal', value: 1 },
      { label: 'Some roles documented', value: 2 },
      { label: 'Most roles have career paths', value: 3 },
      { label: 'Every role has documented growth and succession planning', value: 4 },
    ],
  },
  {
    id: 29,
    category: 'people',
    categoryLabel: 'People Infrastructure',
    type: 'radio',
    stressTest: false,
    text: 'Which best describes your incentive system?',
    options: [
      { label: 'No incentives', value: 0 },
      { label: 'Discretionary bonuses', value: 1 },
      { label: 'Defined bonus plans', value: 2 },
      { label: 'Incentives aligned with KPIs', value: 3 },
      { label: 'Incentives drive ownership, accountability and company performance', value: 4 },
    ],
  },
  {
    id: 30,
    category: 'people',
    categoryLabel: 'People Infrastructure',
    type: 'radio',
    stressTest: true,
    text: 'If your Operations Leader resigned tomorrow, what would happen?',
    options: [
      { label: 'Operations would stop', value: 0 },
      { label: 'Major disruption for several months', value: 1 },
      { label: 'Moderate disruption', value: 2 },
      { label: 'Temporary disruption with recovery in under 90 days', value: 3 },
      { label: 'Successor or documented systems would allow normal operations to continue', value: 4 },
    ],
  },
];

export const SCALE_TEST_QUESTION = {
  id: 31,
  type: 'radio',
  text: 'If your agency doubled in revenue, clients, and employees over the next 24 months, which statement best describes what would happen?',
  options: [
    { label: 'Our agency would likely become overwhelmed. Service quality would decline, leadership would struggle to keep up, and the owner would need to become heavily involved again.', value: 0 },
    { label: 'We could probably grow, but only by asking the owner and a few key employees to work significantly harder. We would likely experience operational bottlenecks and inconsistent client experiences.', value: 1 },
    { label: 'We believe we could handle the growth, but we would need to build additional systems, documentation, and leadership capabilities as we grow.', value: 2 },
    { label: 'Our current operating systems, leadership team, and processes could support this level of growth with only moderate hiring and refinement.', value: 3 },
    { label: 'Our agency is intentionally designed to scale. Leadership, systems, documentation, financial controls, and operating rhythms would allow us to double with minimal disruption while maintaining profitability and client experience.', value: 4 },
  ],
};

export const CATEGORY_COLORS = {
  leadership: '#10b981',
  operating: '#10b981',
  financial: '#10b981',
  revenue: '#10b981',
  people: '#10b981',
};

export const CATEGORY_NAMES = {
  leadership: 'Leadership System',
  operating: 'Operating System',
  financial: 'Financial Infrastructure',
  revenue: 'Revenue Infrastructure',
  people: 'People Infrastructure',
};

export const CATEGORY_SHORT = {
  leadership: 'Leadership',
  operating: 'Operations',
  financial: 'Finance',
  revenue: 'Revenue',
  people: 'People',
};

export function valueToScore(v) {
  return [0, 25, 50, 75, 100][v] ?? 0;
}

export function computeResults(answers, scaleTestAnswer) {
  const categoryScores = {};
  CATEGORY_ORDER.forEach((cat) => {
    const catQs = QUESTIONS.filter((q) => q.category === cat);
    const pointsEarned = catQs.reduce((sum, q) => {
      return sum + (answers[q.id] !== undefined ? answers[q.id] : 0);
    }, 0);
    categoryScores[cat] = Math.round((pointsEarned / 24) * 100);
  });

  const overallScore = Math.round(
    CATEGORY_ORDER.reduce((sum, cat) => sum + categoryScores[cat], 0) / 5
  );

  const scaleScore = scaleTestAnswer !== undefined ? valueToScore(scaleTestAnswer) : null;
  const mismatch = scaleScore !== null ? Math.abs(scaleScore - overallScore) : null;

  let validationStatus = 'Verified';
  let confidenceScore = 100;
  if (mismatch !== null) {
    if (mismatch > 30) {
      validationStatus = 'Significant Contradiction';
      confidenceScore = Math.max(0, 100 - mismatch * 2);
    } else if (mismatch > 15) {
      validationStatus = 'Needs Validation';
      confidenceScore = Math.max(50, 100 - mismatch * 1.5);
    }
  }

  return { categoryScores, overallScore, scaleScore, mismatch, validationStatus, confidenceScore };
}

export function generateInsights(categoryScores, overallScore) {
  const sorted = CATEGORY_ORDER
    .map((cat) => ({ cat, score: categoryScores[cat] }))
    .sort((a, b) => a.score - b.score);

  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  const insights = [];

  if (overallScore >= 80) {
    insights.push('Your agency demonstrates exceptional infrastructure maturity. Focus on maintaining and continuously improving your strongest systems while developing next-level capabilities.');
  } else if (overallScore >= 60) {
    insights.push('Your agency has solid foundations in place. The key to scaling is tightening your weakest systems and creating more consistency across all five infrastructure areas.');
  } else if (overallScore >= 40) {
    insights.push("Your agency is operationally developing. You have pockets of strength but critical gaps that will limit growth. Prioritize building documented systems before trying to scale.");
  } else {
    insights.push('Your agency is in early-stage infrastructure development. Growth is possible but will remain heavily owner-dependent until foundational systems are built.');
  }

  insights.push(
    `Your weakest area is ${CATEGORY_NAMES[weakest.cat]} (${weakest.score}%). Investing here will have the greatest immediate impact on your ability to scale and reduce owner dependency.`
  );

  if (strongest.score >= 70) {
    insights.push(
      `${CATEGORY_NAMES[strongest.cat]} is your strongest pillar at ${strongest.score}%. Use this as a model for how to systematize your other departments.`
    );
  }

  if (categoryScores.people < 50) {
    insights.push('People Infrastructure gaps often create a ceiling on agency growth. Without documented career paths, structured hiring, and performance systems, retaining top talent becomes increasingly difficult.');
  }

  if (categoryScores.revenue < 50) {
    insights.push('Revenue Infrastructure below 50% signals that your growth is likely inconsistent or owner-dependent. Building a repeatable revenue engine is critical to sustainable scaling.');
  }

  return insights.slice(0, 5);
}
