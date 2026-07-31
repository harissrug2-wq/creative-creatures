export const CATEGORIES = [
  { id: 'decision', name: 'Decisions', subtitle: 'Decision Independence' },
  { id: 'revenue', name: 'Revenue', subtitle: 'Revenue Independence' },
  { id: 'delivery', name: 'Delivery', subtitle: 'Delivery Independence' },
  { id: 'leadership', name: 'Leadership', subtitle: 'Leadership Independence' },
  { id: 'strategic', name: 'Strategic', subtitle: 'Strategic Independence' },
];

export const STANDARD_5_OPTIONS = [
  { label: 'Owner always', score: 0 },
  { label: 'Owner usually', score: 1 },
  { label: 'Shared equally', score: 2 },
  { label: 'Leadership team usually', score: 3 },
  { label: 'Leadership team always', score: 4 },
];

export const QUESTIONS = [
  // Category 1: Decision Independence (6 questions)
  {
    id: 1,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who has final authority over pricing and service packaging?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 2,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who approves team hiring and staffing decisions?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 3,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who approves terminating underperforming employees or contractors?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 4,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who resolves major client escalations and critical disputes?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 5,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who makes day-to-day operational decisions for the agency?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 6,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who handles emergency operational and strategic decisions during owner absences?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },

  // Category 2: Revenue Independence (5 questions)
  {
    id: 7,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Who drives and executes new client sales & business development?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 8,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Who generates and nurtures client referrals and strategic partnership growth?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 9,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Who manages marketing strategy, campaign execution, and lead generation?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 10,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Who owns the overall sales pipeline, deal negotiation, and closing?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 11,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Who manages account expansions, renewals, and upsell opportunities?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },

  // Category 3: Delivery Independence (6 questions)
  {
    id: 12,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who owns project delivery and day-to-day execution for clients?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 13,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who manages primary client communication and account management?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 14,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who approves work quality before final delivery to clients?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 15,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who owns overall service fulfillment quality standards and processes?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 16,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who manages delivery team workflow, capacity, and resource allocation?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 17,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who handles service recovery and troubleshooting when client issues occur?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },

  // Category 4: Leadership Independence (6 questions)
  {
    id: 18,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who runs regular Leadership Team meetings?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 19,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who facilitates Quarterly and Annual Strategic Planning sessions?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 20,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who manages, mentors, and coaches department leaders?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 21,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who holds department leaders accountable to key performance metrics?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 22,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who sets department goals and tracks execution progress independently?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 23,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who resolves cross-departmental conflicts and operational bottlenecks?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },

  // Category 5: Strategic Independence (5 questions)
  {
    id: 24,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'Who defines long-term vision, company strategy, and growth roadmap?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 25,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'Who manages capital allocation, budgeting, and financial planning?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 26,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'Who leads executive recruitment and organizational structure design?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 27,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'Who manages strategic partnerships, acquisitions, and key vendor relationships?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 28,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'Who drives operational innovation, systems architecture, and process improvements?',
    type: 'choice',
    options: STANDARD_5_OPTIONS
  }
];
