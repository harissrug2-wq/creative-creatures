export const CATEGORIES = [
  { id: 'decision', name: 'Decisions' },
  { id: 'delivery', name: 'Delivery' },
  { id: 'revenue', name: 'Revenue' },
  { id: 'leadership', name: 'Leadership' },
  { id: 'strategic', name: 'Strategic' },
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
    text: 'Who has final authority over pricing?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 2,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who approves hiring?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 3,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who approves terminating employees?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 4,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who resolves major client escalations?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 5,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'Who makes day-to-day operational decisions?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 6,
    category: 'decision',
    categoryName: 'Decisions',
    text: 'If you took a four-week vacation tomorrow, how many of these decisions would require you?',
    type: 'choice',
    options: [
      { label: 'Nearly all', score: 0 },
      { label: 'Most', score: 1 },
      { label: 'About half', score: 2 },
      { label: 'Very few', score: 3 },
      { label: 'None', score: 4 }
    ]
  },

  // Category 2: Revenue Independence (5 questions)
  {
    id: 7,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'If you disappeared for 90 days, would new sales continue?',
    type: 'choice',
    options: [
      { label: 'No', score: 0 },
      { label: 'Significantly reduced', score: 1 },
      { label: 'Somewhat reduced', score: 2 },
      { label: 'Mostly unaffected', score: 3 },
      { label: 'Completely unaffected', score: 4 }
    ]
  },
  {
    id: 8,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Would referrals continue?',
    type: 'choice',
    options: [
      { label: 'No', score: 0 },
      { label: 'Significantly reduced', score: 1 },
      { label: 'Somewhat reduced', score: 2 },
      { label: 'Mostly unaffected', score: 3 },
      { label: 'Completely unaffected', score: 4 }
    ]
  },
  {
    id: 9,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Would marketing continue?',
    type: 'choice',
    options: [
      { label: 'No', score: 0 },
      { label: 'Significantly reduced', score: 1 },
      { label: 'Somewhat reduced', score: 2 },
      { label: 'Mostly unaffected', score: 3 },
      { label: 'Completely unaffected', score: 4 }
    ]
  },
  {
    id: 10,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'Who owns the sales pipeline?',
    type: 'choice',
    options: [
      { label: 'Owner', score: 0 },
      { label: 'Mostly Owner', score: 1 },
      { label: 'Shared', score: 2 },
      { label: 'Sales Leader', score: 3 },
      { label: 'Sales Team', score: 4 }
    ]
  },
  {
    id: 11,
    category: 'revenue',
    categoryName: 'Revenue',
    text: 'What percentage of new revenue personally involves the owner?',
    type: 'choice',
    options: [
      { label: '90-100%', score: 0 },
      { label: '70-89%', score: 1 },
      { label: '40-69%', score: 2 },
      { label: '10-39%', score: 3 },
      { label: 'Less than 10%', score: 4 }
    ]
  },

  // Category 3: Delivery Independence (6 questions)
  {
    id: 12,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who owns project delivery?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 13,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who owns client communication?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 14,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who approves work before delivery?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 15,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Who owns fulfillment quality?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 16,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'If you left for 90 days, how many clients would notice?',
    type: 'choice',
    options: [
      { label: 'Nearly all', score: 0 },
      { label: 'Most', score: 1 },
      { label: 'About half', score: 2 },
      { label: 'Very few', score: 3 },
      { label: 'None', score: 4 }
    ]
  },
  {
    id: 17,
    category: 'delivery',
    categoryName: 'Delivery',
    text: 'Could every current client continue receiving service without you?',
    type: 'choice',
    options: [
      { label: 'No', score: 0 },
      { label: 'Probably not', score: 1 },
      { label: 'Unsure', score: 2 },
      { label: 'Probably yes', score: 3 },
      { label: 'Definitely yes', score: 4 }
    ]
  },

  // Category 4: Leadership Independence (6 questions)
  {
    id: 18,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who runs the Leadership Team meeting?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 19,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who facilitates Quarterly Planning?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 20,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who manages department leaders?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 21,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Who holds leaders accountable?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },
  {
    id: 22,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'If the owner disappeared, would leadership meetings continue?',
    type: 'choice',
    options: [
      { label: 'Definitely not', score: 0 },
      { label: 'Probably not', score: 1 },
      { label: 'Unsure', score: 2 },
      { label: 'Probably yes', score: 3 },
      { label: 'Definitely yes', score: 4 }
    ]
  },
  {
    id: 23,
    category: 'leadership',
    categoryName: 'Leadership',
    text: 'Can department leaders solve problems without owner involvement?',
    type: 'slider',
    minLabel: 'Owner always',
    maxLabel: 'Leadership team always',
    options: STANDARD_5_OPTIONS
  },

  // Category 5: Strategic Independence (2 questions)
  {
    id: 24,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'Over the last 30 days, how much time did you spend on Strategic vs Operational Work?',
    subtitle: 'Percentages totaling across both categories need to = 100%',
    type: 'strategic-sliders',
    strategicItems: ['Vision', 'Strategy', 'Leadership Coaching', 'Capital Allocation', 'Relationships', 'Recruiting Executives'],
    operationalItems: ['Sales', 'Delivery', 'Client Management', 'Firefighting', 'Internal Operations', 'HR', 'Finance', 'Approvals']
  },
  {
    id: 25,
    category: 'strategic',
    categoryName: 'Strategic',
    text: 'What happens if you stop doing each activity?',
    type: 'activity-matrix',
    activities: ['Sales', 'Client Delivery', 'Leadership', 'Marketing', 'Hiring', 'Finance'],
    matrixOptions: [
      { label: 'Business continues', score: 100 },
      { label: 'Slows down', score: 50 },
      { label: 'Stops completely', score: 0 }
    ]
  },

  // Validation Question (Q26)
  {
    id: 26,
    category: 'validation',
    categoryName: 'Validation',
    text: 'If you were unable to work for the next 90 days due to illness, travel, or another life event, which statement best describes what would happen?',
    type: 'choice',
    options: [
      { label: 'The business would likely stop operating effectively', score: 0 },
      { label: 'Revenue would decline significantly and major decisions would wait for me', score: 1 },
      { label: 'The business would continue, but with noticeable disruption', score: 2 },
      { label: 'The leadership team could keep the business running with only occasional input', score: 3 },
      { label: 'The business would continue operating with minimal impact and likely achieve its planned goals', score: 4 }
    ]
  }
];
