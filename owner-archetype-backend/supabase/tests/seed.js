// seed.js

const payload = {
  questionnaire: {
    title: 'Final Creative Creature Questionnaire',
    description: 'The definitive agency archetype and stage assessment.',
    questions: [
      {
        internal_id: 'first_name',
        type: 'text',
        required: true,
        text: 'What is your first name?'
      },
      {
        internal_id: 'last_name',
        type: 'text',
        required: true,
        text: 'What is your last name?'
      },
      {
        internal_id: 'agency_website',
        type: 'text',
        required: true,
        text: 'What is your agency website URL?'
      },
      {
        internal_id: 'archetype_q1',
        type: 'options',
        required: true,
        text: 'When your agency is under pressure, what is your default instinct?',
        options: [
          { id: 'A', text: 'Jump in and solve the problem myself' },
          { id: 'B', text: 'Come up with a new angle, idea, or repositioning strategy' },
          { id: 'C', text: 'Protect the relationship and make sure everyone feels taken care of' },
          { id: 'D', text: 'Tighten control and make sure things are done right' },
          { id: 'E', text: 'Look for the bigger opportunity or strategic move forward' }
        ]
      },
      {
        internal_id: 'archetype_q2',
        type: 'options',
        required: true,
        text: 'What part of running the agency gives you the most energy?',
        options: [
          { id: 'A', text: 'Fixing problems and getting things back on track' },
          { id: 'B', text: 'Creating ideas, offers, branding, or vision' },
          { id: 'C', text: 'Building trust with clients and team' },
          { id: 'D', text: 'Improving quality, standards, and execution' },
          { id: 'E', text: 'Growth strategy, expansion, and future opportunities' }
        ]
      },
      {
        internal_id: 'archetype_q3',
        type: 'options',
        required: true,
        text: 'What most often slows your agency down because of you?',
        options: [
          { id: 'A', text: 'Too much still depends on me' },
          { id: 'B', text: 'I change direction or start too many things' },
          { id: 'C', text: 'I avoid hard conversations or tolerate too much' },
          { id: 'D', text: 'I do not trust others to do it right' },
          { id: 'E', text: 'I push too many priorities at once' }
        ]
      },
      {
        internal_id: 'archetype_q4',
        type: 'options',
        required: true,
        text: 'If your agency no longer needed you day to day, what would feel hardest to let go of?',
        options: [
          { id: 'A', text: 'Being the one people rely on in hard moments' },
          { id: 'B', text: 'Being the creator of the ideas and direction' },
          { id: 'C', text: 'Being personally connected to everyone' },
          { id: 'D', text: 'Being the one who ensures quality and control' },
          { id: 'E', text: 'Being the one who sees what’s next and drives the business forward' }
        ]
      },
      {
        internal_id: 'stage_q5',
        type: 'options',
        required: true,
        text: 'Which statement best describes your agency right now?',
        options: [
          { id: 'A', text: 'We are still trying to create consistent revenue and stability', mapped_stage: 'survival' },
          { id: 'B', text: 'We have momentum, but a lot still depends on the founder', mapped_stage: 'traction' },
          { id: 'C', text: 'We are growing, but things feel messy and inconsistent', mapped_stage: 'unstable_growth' },
          { id: 'D', text: 'We have enough clients and team, but complexity is creating strain', mapped_stage: 'operational_strain' },
          { id: 'E', text: 'We are stable, but growth has slowed or become harder', mapped_stage: 'plateau_complexity' },
          { id: 'F', text: 'We are intentionally building leadership, systems, and scale capacity', mapped_stage: 'scale_readiness' },
          { id: 'G', text: 'The business can perform with strong leadership and limited founder dependence', mapped_stage: 'asset_stage' }
        ]
      },
      {
        internal_id: 'stage_q6',
        type: 'options',
        required: true,
        text: 'What best describes the founder\'s current role in the business?',
        options: [
          { id: 'A', text: 'I do almost everything' },
          { id: 'B', text: 'I still sell, solve, and deliver a lot personally' },
          { id: 'C', text: 'I lead a team, but many key decisions still come through me' },
          { id: 'D', text: 'I am often the bottleneck for approvals, people, or clients' },
          { id: 'E', text: 'I am trying to step back, but the business is not fully ready' },
          { id: 'F', text: 'I am focused mostly on leadership, strategy, and building systems' },
          { id: 'G', text: 'I could step away for a period and the business would still operate well' }
        ]
      },
      {
        internal_id: 'stage_q7',
        type: 'options',
        required: true,
        text: 'Which statement best describes your systems and team?',
        options: [
          { id: 'A', text: 'Very little is documented or repeatable yet' },
          { id: 'B', text: 'Some processes exist, but execution depends on key people' },
          { id: 'C', text: 'We have people and process, but inconsistency is still common' },
          { id: 'D', text: 'The team is capable, but accountability and cross-functional coordination are weak' },
          { id: 'E', text: 'We have structure, but it is getting harder to scale efficiently' },
          { id: 'F', text: 'We are building a true management layer and clearer operating rhythm' },
          { id: 'G', text: 'Most major functions run through accountable leaders with clear metrics' }
        ]
      },
      {
        internal_id: 'stage_q8',
        type: 'options',
        required: true,
        text: 'Which of these feels most true about the business as an asset?',
        options: [
          { id: 'A', text: 'Right now, it is mostly a job I own' },
          { id: 'B', text: 'It has value, but it still depends heavily on me' },
          { id: 'C', text: 'It is growing, but not predictably enough yet' },
          { id: 'D', text: 'It is a real business, but not yet easy to scale' },
          { id: 'E', text: 'It is stable, but not yet highly transferable or optimized' },
          { id: 'F', text: 'It is becoming more transferable and valuable' },
          { id: 'G', text: 'It is increasingly operating like an asset, not just an owner-led company' }
        ]
      },
      {
        internal_id: 'annual_revenue',
        type: 'options',
        required: true,
        text: 'Which best describes the annual revenue your agency is generating right now?',
        options: [
          { id: 'under_1m', text: 'Under $1M' },
          { id: 'between_1m_2m', text: 'Between $1M and $2M' },
          { id: 'between_2m_3m', text: 'Between $2M and $3M' },
          { id: 'over_3m', text: 'Over $3M' }
        ]
      }
    ]
  },
  rubric: {
    firefighter_founder: 'You are at your best under pressure—solving problems, restoring stability, and carrying the business through difficult moments. Your next level is building a company that no longer depends on you to rescue it.',
    creative_wizard: 'You create value through ideas, originality, positioning, and vision. Your next level is turning your best ideas into repeatable systems that can grow beyond your personal involvement.',
    people_pleaser: 'You build trust, loyalty, and strong relationships with clients and your team. Your next level is combining that empathy with clearer boundaries, standards, and accountability.',
    control_builder: 'You protect quality, consistency, and high standards. Your next level is building trust-backed systems so excellence can continue without every decision passing through you.',
    vision_chaser: 'You see bigger opportunities, create momentum, and inspire people around the future. Your next level is disciplined focus—sequencing fewer priorities deeply enough for them to compound.'
  }
};

async function run() {
  console.log('Sending seed request...');
  const res = await fetch('https://mkgohvukpckcfwimxrra.supabase.co/functions/v1/api-v1/seed-configs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('Status:', res.status);
  console.log('Response:', await res.text());
}

run();
