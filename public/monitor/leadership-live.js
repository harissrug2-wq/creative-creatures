(() => {
  if ((document.body?.dataset?.page || '') !== 'leadership') return;

  const pageWrap = () => document.querySelector('.page-wrap');
  const qs = new URLSearchParams(location.search);
  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  const meetingSections = [
    ['segue','Segue',5], ['headlines','Headlines',5], ['scorecard','Scorecard',5],
    ['rocks','Rocks',5], ['todos','To-Dos',10], ['ids','IDS',60], ['conclude','Conclude',5]
  ];

  const currentAccount = () => safeJson(localStorage.getItem('cc_account'), null)
    || safeJson(localStorage.getItem('ccUserAccount'), null)
    || {};

  function identity() {
    const account = currentAccount();
    const tenant = clean(qs.get('tenant'));
    return {
      accountId: tenant || (account.id && !String(account.id).startsWith('local-') ? account.id : ''),
      email: tenant ? '' : clean(account.email || localStorage.getItem('ccOwnerEmail')),
      agencyUrl: tenant ? '' : clean(account.agency_url || account.agencyUrl || localStorage.getItem('ccAgencyWebsite'))
    };
  }

  function identityQuery() {
    const params = new URLSearchParams();
    const id = identity();
    if (id.accountId) params.set('accountId', id.accountId);
    if (id.email) params.set('email', id.email);
    if (id.agencyUrl) params.set('agencyUrl', id.agencyUrl);
    return params.toString();
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Request failed.');
      error.code = payload.code || null;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  const state = {
    leadership: null,
    tab: 'meetings',
    loading: true,
    saving: false,
    error: null,
    openMeetingId: '',
    timerHandle: null,
    calendar: { checked:false, connected:false, imported:0 }
  };

  function dateLabel(value) {
    if (!value) return 'No meeting yet';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }

  function dueLabel(value) {
    return value ? dateLabel(value) : 'No due date';
  }

  function mondayOf(value = new Date()) {
    const date = new Date(value);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return date.toISOString().slice(0,10);
  }

  function metricEntries(metricId) {
    return (state.leadership?.metricEntries || []).filter(entry => entry.metric_id === metricId);
  }

  function latestMetricEntry(metricId) {
    return metricEntries(metricId)[0] || null;
  }

  function targetLabel(metric) {
    if (metric.direction === 'range') return `${metric.target_min ?? '?'}–${metric.target_max ?? '?'}`;
    const operator = metric.direction === 'lower' ? '≤' : '≥';
    return `${operator} ${metric.target_value ?? '?'}`;
  }

  function formatMetricValue(value, unit = '') {
    if (value === null || value === undefined || value === '') return 'No data';
    if (unit === 'percent' || unit === '%') return `${value}%`;
    if (unit === 'currency' || unit === '$') return `$${Number(value).toLocaleString()}`;
    return `${value}${unit && unit !== 'number' ? ` ${unit}` : ''}`;
  }

  function statusLabel(value) {
    return clean(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function pill(value, kind = '') {
    const normalized = clean(value).toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
    return `<span class="lead-pill ${esc(kind || normalized)}">${esc(statusLabel(value || 'No status'))}</span>`;
  }

  function emptyState(title, copy, action = '') {
    return `<div class="lead-empty"><strong>${esc(title)}</strong><span>${esc(copy)}</span>${action}</div>`;
  }

  function summaryCards() {
    const summary = state.leadership?.summary || {};
    const activeRocks = (state.leadership?.rocks || []).filter(rock => rock.status !== 'Complete').length;
    const items = [
      ['Last leadership meeting', summary.lastMeetingAt ? dateLabel(summary.lastMeetingAt) : 'No Data', 'Saved meeting history'],
      ['Active 90-Day Rocks', String(activeRocks), 'Agency Goals'],
      ['Open issues', String(summary.openIssues || 0), 'Leadership issue list'],
      ['Average meeting rating', summary.averageRating == null ? 'No Data' : `${summary.averageRating}/10`, 'Completed meetings']
    ];
    return `<section class="lead-summary-grid">${items.map(item => `<article><span>${esc(item[0])}</span><strong>${esc(item[1])}</strong><small>${esc(item[2])}</small></article>`).join('')}</section>`;
  }

  function tabs() {
    const items = [
      ['meetings','Weekly Leadership Meetings'],
      ['scorecard','Scorecard'],
      ['rocks','Rocks & Issues'],
      ['marketing','Marketing Strategy'],
      ['vision','Vision / Traction']
    ];
    return `<nav class="lead-tabs" aria-label="Agency Leadership sections">${items.map(([id,label]) => `<button type="button" class="${state.tab === id ? 'active' : ''}" data-lead-tab="${id}">${esc(label)}</button>`).join('')}</nav>`;
  }

  function meetingRows() {
    const meetings = state.leadership?.meetings || [];
    if (!meetings.length) return emptyState(
      'No leadership meetings saved',
      'Create the first weekly meeting. Nothing is prefilled with prototype activity.',
      '<button type="button" class="lead-primary" data-new-meeting>Create first meeting</button>'
    );
    return `<div class="lead-meeting-list">${meetings.map(meeting => `<button type="button" class="lead-meeting-row" data-edit-meeting="${esc(meeting.id)}">
      <span class="lead-meeting-date"><b>${esc(new Date(`${meeting.meeting_date}T12:00:00`).toLocaleDateString('en-US',{month:'short'}))}</b><strong>${esc(new Date(`${meeting.meeting_date}T12:00:00`).getDate())}</strong></span>
      <span class="lead-meeting-main"><strong>${esc(meeting.title)}</strong><small>${esc(dateLabel(meeting.meeting_date))}${meeting.facilitator_name ? ` · Facilitator ${esc(meeting.facilitator_name)}` : ''}</small></span>
      <span class="lead-meeting-stats"><span>${esc(`${meeting.rocks_on_track || 0}/${meeting.rocks_total || 0}`)} rocks</span><span>${esc(`${meeting.open_todo_count || 0}`)} open to-dos</span><span>${esc(`${meeting.open_issue_count || 0}`)} open issues</span><span>${meeting.rating == null ? 'No rating' : `${esc(meeting.rating)}/10`}</span></span>
      <span class="lead-meeting-action">${pill(meeting.status)}<b>${meeting.status === 'completed' ? 'View' : meeting.status === 'in_progress' ? 'Resume' : 'Open'}</b></span>
    </button>`).join('')}</div>`;
  }

  function todoRows() {
    const todos = state.leadership?.todos || [];
    if (!todos.length) return emptyState('No to-dos', 'Add follow-up actions from a leadership meeting.');
    return `<div class="lead-compact-list">${todos.map(todo => `<button type="button" data-edit-todo="${esc(todo.id)}">
      <span class="lead-check ${todo.status === 'complete' ? 'done' : ''}">${todo.status === 'complete' ? '✓' : '○'}</span>
      <span><strong>${esc(todo.title)}</strong><small>${esc(todo.owner_name || 'No owner')} · ${esc(dueLabel(todo.due_date))}</small></span>
      ${pill(todo.status)}
    </button>`).join('')}</div>`;
  }

  function meetingsTab() {
    return `<section class="lead-panel">
      <div class="lead-source-notice"><span>L10</span><div><strong>Weekly leadership operating workspace</strong><p>${state.calendar.connected ? 'Matching Leadership, L10, and Level 10 events are scheduled automatically from this agency’s connected Google Calendar.' : 'Connect Google Calendar to schedule matching Leadership, L10, and Level 10 events automatically.'} Calendar events never create transcript content.</p></div></div>
      <div class="lead-section-head"><div><span>Meeting cadence</span><h2>Weekly leadership meetings</h2></div><button type="button" class="lead-primary" data-new-meeting>＋ New meeting</button></div>
      <section class="lead-card">${meetingRows()}</section>
      <div class="lead-section-head"><div><span>Follow-through</span><h2>Leadership to-dos</h2></div><button type="button" class="lead-secondary" data-new-todo>＋ Add to-do</button></div>
      <section class="lead-card">${todoRows()}</section>
    </section>`;
  }

  function scorecardRows() {
    const metrics = (state.leadership?.metrics || []).filter(metric => metric.active);
    if (!metrics.length) return emptyState(
      'No weekly metrics',
      'Add the numbers the leadership team must review every week.',
      '<button type="button" class="lead-primary" data-new-metric>Add first metric</button>'
    );
    const weekStart = mondayOf();
    return `<div class="lead-scorecard-list">${metrics.map(metric => {
      const latest = latestMetricEntry(metric.id);
      return `<form class="lead-scorecard-row" data-metric-entry-form="${esc(metric.id)}">
        <button type="button" class="lead-scorecard-name" data-edit-metric="${esc(metric.id)}"><strong>${esc(metric.name)}</strong><small>${esc(metric.owner_name || 'No owner')} · Target ${esc(targetLabel(metric))}</small></button>
        <span class="lead-scorecard-latest"><small>Latest</small><strong>${esc(formatMetricValue(latest?.value, metric.unit))}</strong>${latest ? pill(latest.status) : pill('no_data')}</span>
        <label><span>Week</span><input type="date" name="weekStart" value="${esc(weekStart)}" required></label>
        <label><span>Value</span><input type="number" name="value" step="any" required placeholder="0"></label>
        <button type="submit" class="lead-primary">Save</button>
      </form>`;
    }).join('')}</div>`;
  }

  function scorecardTab() {
    return `<section class="lead-panel">
      <div class="lead-source-notice"><span>KPI</span><div><strong>13-week operating scorecard</strong><p>Enter one value per metric each week. Targets determine whether each number is on track or off track for the L10.</p></div></div>
      <div class="lead-section-head"><div><span>Weekly numbers</span><h2>Leadership scorecard</h2></div><button type="button" class="lead-primary" data-new-metric>＋ Add metric</button></div>
      <section class="lead-card">${scorecardRows()}</section>
    </section>`;
  }

  function rockRows() {
    const rocks = state.leadership?.rocks || [];
    if (!rocks.length) return emptyState('No 90-Day Rocks', 'Create a manual Rock or convert scorecard priorities from Agency Goals.');
    return `<div class="lead-work-list">${rocks.map(rock => `<button type="button" data-edit-rock="${esc(rock.id)}">
      <span><strong>${esc(rock.title)}</strong><small>${esc(rock.owner || 'No owner')} · ${esc(dueLabel(rock.dueDate))}</small></span>
      ${pill(rock.status)}
    </button>`).join('')}</div>`;
  }

  function issueRows() {
    const issues = state.leadership?.issues || [];
    if (!issues.length) return emptyState('No issues recorded', 'Add an issue when the leadership team needs to identify, discuss, and solve it.');
    return `<div class="lead-work-list">${issues.map(issue => `<button type="button" data-edit-issue="${esc(issue.id)}">
      <span><strong>${esc(issue.title)}</strong><small>${esc(issue.owner_name || 'No owner')} · ${esc(statusLabel(issue.priority))} priority</small></span>
      ${pill(issue.status)}
    </button>`).join('')}</div>`;
  }

  function rocksTab() {
    return `<section class="lead-panel lead-two-column">
      <article><div class="lead-section-head"><div><span>90-day priorities</span><h2>Rocks</h2></div><button type="button" class="lead-primary" data-new-rock>＋ New Rock</button></div><section class="lead-card">${rockRows()}</section></article>
      <article><div class="lead-section-head"><div><span>Identify · Discuss · Solve</span><h2>Issues</h2></div><button type="button" class="lead-secondary" data-new-issue>＋ Add issue</button></div><section class="lead-card">${issueRows()}</section></article>
    </section>`;
  }

  function planValue(field) {
    return state.leadership?.plan?.[field] || '';
  }

  function marketingTab() {
    const uniques = Array.isArray(planValue('three_uniques')) ? planValue('three_uniques') : [];
    return `<form class="lead-plan-form" data-plan-form="marketing">
      <div class="lead-form-head"><div><span>Persistent strategy</span><h2>Marketing Strategy</h2><p>Define who the agency serves and why it wins. Blank fields remain blank until the leadership team defines them.</p></div><button type="submit" class="lead-primary">Save strategy</button></div>
      <div class="lead-plan-grid">
        <label class="lead-field lead-wide"><span>Target market</span><textarea name="targetMarket" rows="5" placeholder="Define the ideal market, buyer and problem…">${esc(planValue('target_market'))}</textarea></label>
        ${[0,1,2].map(index => `<label class="lead-field"><span>Unique ${index + 1}</span><textarea name="unique${index + 1}" rows="4" placeholder="A specific reason clients choose this agency…">${esc(uniques[index] || '')}</textarea></label>`).join('')}
        <label class="lead-field lead-wide"><span>Proven process</span><textarea name="provenProcess" rows="6" placeholder="Document the client-facing delivery process…">${esc(planValue('proven_process'))}</textarea></label>
        <label class="lead-field lead-wide"><span>Guarantee</span><textarea name="guarantee" rows="4" placeholder="Define the promise and its limits…">${esc(planValue('guarantee'))}</textarea></label>
      </div>
    </form>`;
  }

  function visionTab() {
    const values = Array.isArray(planValue('core_values')) ? planValue('core_values').join('\n') : '';
    return `<form class="lead-plan-form" data-plan-form="vision">
      <div class="lead-form-head"><div><span>Vision and execution</span><h2>Vision / Traction</h2><p>Store the leadership team's long-term direction and current execution focus in one agency record.</p></div><button type="submit" class="lead-primary">Save vision</button></div>
      <div class="lead-plan-grid">
        <label class="lead-field"><span>Core values</span><textarea name="coreValues" rows="7" placeholder="One value per line">${esc(values)}</textarea></label>
        <label class="lead-field"><span>Core focus</span><textarea name="coreFocus" rows="7" placeholder="Purpose, cause or passion and the agency niche…">${esc(planValue('core_focus'))}</textarea></label>
        <label class="lead-field"><span>10-year target</span><textarea name="tenYearTarget" rows="5" placeholder="The long-range measurable target…">${esc(planValue('ten_year_target'))}</textarea></label>
        <label class="lead-field"><span>3-year picture</span><textarea name="threeYearPicture" rows="5" placeholder="What the agency should look like in three years…">${esc(planValue('three_year_picture'))}</textarea></label>
        <label class="lead-field"><span>1-year plan</span><textarea name="oneYearPlan" rows="6" placeholder="The outcomes that must be true one year from now…">${esc(planValue('one_year_plan'))}</textarea></label>
        <label class="lead-field"><span>Quarterly focus</span><textarea name="quarterlyFocus" rows="6" placeholder="The current quarter's small set of priorities…">${esc(planValue('quarterly_focus'))}</textarea></label>
      </div>
    </form>`;
  }

  function activePanel() {
    if (state.tab === 'scorecard') return scorecardTab();
    if (state.tab === 'rocks') return rocksTab();
    if (state.tab === 'marketing') return marketingTab();
    if (state.tab === 'vision') return visionTab();
    return meetingsTab();
  }

  function render() {
    const root = pageWrap();
    if (!root) return;
    if (state.loading) {
      root.innerHTML = '<div class="lead-loading"><span></span><span></span><span></span><span></span></div>';
      return;
    }
    if (state.error) {
      root.innerHTML = `<div class="lead-load-error"><strong>Leadership could not load</strong><span>${esc(state.error)}</span><button type="button" data-retry-leadership>Retry</button></div>`;
      bind();
      return;
    }

    const account = state.leadership?.account || {};
    root.innerHTML = `<div class="leadership-live">
      <header class="lead-page-head"><div><span class="lead-eyebrow">Monitor · Agency Leadership</span><h1>Leadership</h1><p>Weekly operating cadence, priorities, issues, strategy, and vision for <strong>${esc(account.agencyName || 'this agency')}</strong>.</p></div><div class="lead-owner-card"><span>Workspace owner</span><strong>${esc(account.name || 'Agency Owner')}</strong><small>Native · persisted</small></div></header>
      ${summaryCards()}${tabs()}${activePanel()}
      <div class="lead-toast" role="status" aria-live="polite"></div>
      <div class="lead-modal-backdrop" data-lead-modal hidden><div class="lead-modal" role="dialog" aria-modal="true"><div data-lead-modal-content></div></div></div>
    </div>`;
    bind();
  }

  function meetingsOptions(selected) {
    return `<option value="">No meeting</option>${(state.leadership?.meetings || []).map(meeting => `<option value="${esc(meeting.id)}" ${meeting.id === selected ? 'selected' : ''}>${esc(meeting.title)} · ${esc(dateLabel(meeting.meeting_date))}</option>`).join('')}`;
  }

  function agendaFor(item) {
    const agenda = item?.agenda && typeof item.agenda === 'object' ? item.agenda : {};
    return {
      goodNews: Array.isArray(agenda.goodNews) ? agenda.goodNews : [],
      headlines: Array.isArray(agenda.headlines) ? agenda.headlines : [],
      cascadeMessages: Array.isArray(agenda.cascadeMessages) ? agenda.cascadeMessages : [],
      ratings: Array.isArray(agenda.ratings) ? agenda.ratings : [],
      rockNotes: agenda.rockNotes && typeof agenda.rockNotes === 'object' ? agenda.rockNotes : {}
    };
  }

  function agendaInputs(kind, items, placeholder) {
    return `<div class="lead-l10-items" data-agenda-list="${kind}">${items.map(item => `<div class="lead-l10-inline" data-agenda-item><input value="${esc(item.text || '')}" placeholder="${esc(placeholder)}"><button type="button" data-remove-row aria-label="Remove">×</button></div>`).join('')}</div><div class="lead-l10-add"><input data-agenda-input="${kind}" placeholder="${esc(placeholder)}"><button type="button" data-add-agenda="${kind}">Add</button></div>`;
  }

  function meetingSource(item) {
    if (item?.source === 'google_calendar') return 'Scheduled from Google Calendar. The agenda is editable; no transcript content was inferred.';
    if (item?.transcript_url) return 'A transcript link is attached. Agenda content remains editable and is saved only for this agency.';
    return 'Created manually. Anyone signed in to this agency account can view or edit.';
  }

  function meetingRowsFor(collection, meetingId) {
    return (state.leadership?.[collection] || []).filter(row => row.meeting_id === meetingId);
  }

  function meetingItemsFor(meetingId, sectionKey) {
    return meetingRowsFor('meetingItems', meetingId).filter(row => row.section_key === sectionKey);
  }

  function meetingNavigator(item) {
    if (!item?.id || item.status === 'planned') return '';
    const sections = meetingRowsFor('sections', item.id);
    if (!sections.length) return '';
    return `<div class="lead-l10-runner"><div class="lead-l10-runner-top"><div><small>${item.status === 'completed' ? 'Meeting completed' : 'Meeting in progress'}</small><strong data-section-timer>00:00</strong></div>${item.status === 'in_progress' ? '<span>Move through the agenda in order. Section changes are saved immediately.</span>' : `<span>Completed ${esc(item.completed_at ? new Date(item.completed_at).toLocaleString() : dateLabel(item.meeting_date))}</span>`}</div><nav>${meetingSections.map(([key,label,minutes]) => {
      const section = sections.find(row => row.section_key === key);
      const sectionStatus = section?.status || 'pending';
      return `<button type="button" data-set-section="${key}" class="${sectionStatus}" ${item.status === 'completed' ? 'disabled':''}><span>${esc(label)}</span><small>${minutes}m</small></button>`;
    }).join('')}</nav></div>`;
  }

  function meetingMetrics(item) {
    const snapshots = item?.id ? meetingItemsFor(item.id, 'scorecard') : [];
    if (snapshots.length) return snapshots.map(row => ({
      ...row.snapshot,
      entry: row.outcome?.entry || row.snapshot?.latestEntry || null,
      meetingItemId: row.id
    }));
    return (state.leadership?.metrics || []).filter(metric => metric.active).map(metric => ({
      ...metric, entry: latestMetricEntry(metric.id)
    }));
  }

  function meetingScorecard(item) {
    const metrics = meetingMetrics(item);
    const onTrack = metrics.filter(metric => metric.entry?.status === 'on_track').length;
    const offTrack = metrics.filter(metric => metric.entry?.status === 'off_track').length;
    if (!metrics.length) return '<p class="lead-l10-empty-copy">No weekly metrics exist yet. Add them in the Scorecard tab before starting the meeting.</p>';
    return `<div class="lead-l10-counts"><span>On track <b>${onTrack}</b></span><span>Off track <b>${offTrack}</b></span></div><div class="lead-l10-kpis">${metrics.map(metric => `<article class="${esc(metric.entry?.status || 'no_data')}"><span>${esc(metric.name)}</span><strong>${esc(formatMetricValue(metric.entry?.value, metric.unit))}</strong><small>${esc(metric.owner_name || 'No owner')} · Target ${esc(targetLabel(metric))}</small></article>`).join('')}</div>`;
  }

  function rockReview(item) {
    const agenda = agendaFor(item);
    const snapshots = item?.id ? meetingItemsFor(item.id, 'rocks') : [];
    const rocks = snapshots.length ? snapshots.map(row => ({
      id:row.source_id, meetingItemId:row.id, ...row.snapshot, ...row.outcome,
      owner:row.outcome?.owner ?? row.snapshot?.owner_name ?? '',
      status:row.outcome?.status ?? row.snapshot?.status
    })) : state.leadership?.rocks || [];
    return `<div class="lead-l10-rocks" data-l10-rocks>${rocks.map(rock => `<div class="lead-l10-rock" data-rock-id="${esc(rock.id)}" data-meeting-item-id="${esc(rock.meetingItemId || '')}"><div><input class="rock-title" value="${esc(rock.title)}" aria-label="Rock title"><select class="rock-status" aria-label="Rock status">${['Not started','On track','Watch','Complete'].map(value => `<option ${rock.status === value ? 'selected':''}>${value}</option>`).join('')}</select></div><div><input class="rock-owner" value="${esc(rock.owner || '')}" placeholder="Owner"><input class="rock-note" value="${esc(rock.note ?? agenda.rockNotes[rock.id]?.note ?? '')}" placeholder="Next step / note"></div></div>`).join('')}</div><button type="button" class="lead-l10-row-button" data-add-rock-row>＋ Add rock</button>`;
  }

  function todoReview(item) {
    const snapshots = item?.id ? meetingItemsFor(item.id, 'todos') : [];
    const snapshotIds = new Set(snapshots.map(row => row.source_id));
    const rows = snapshots.map(row => ({ id:row.source_id, meetingItemId:row.id, ...row.snapshot, ...row.outcome }))
      .concat((state.leadership?.todos || []).filter(row => row.meeting_id === item?.id && !snapshotIds.has(row.id)));
    return `<div class="lead-l10-items" data-l10-todos>${rows.map(row => `<div class="lead-l10-task" data-todo-id="${esc(row.id)}" data-meeting-item-id="${esc(row.meetingItemId || '')}"><input type="checkbox" class="todo-status" ${row.status === 'complete' ? 'checked':''}><input class="todo-title" value="${esc(row.title)}"><input class="todo-owner" value="${esc(row.owner_name || '')}" placeholder="Owner"><button type="button" data-remove-row>×</button></div>`).join('')}</div><div class="lead-l10-add lead-l10-add-owner"><input data-new-todo placeholder="To-do for the week…"><input data-new-todo-owner placeholder="Owner"><button type="button" data-add-todo>Add</button></div>`;
  }

  function issueReview(item) {
    const snapshots = item?.id ? meetingItemsFor(item.id, 'ids') : [];
    const snapshotIds = new Set(snapshots.map(row => row.source_id));
    const rows = snapshots.map(row => ({ id:row.source_id, meetingItemId:row.id, ...row.snapshot, ...row.outcome }))
      .concat((state.leadership?.issues || []).filter(row => row.meeting_id === item?.id && !snapshotIds.has(row.id)));
    return `<div class="lead-l10-items" data-l10-issues>${rows.map(row => `<div class="lead-l10-task" data-issue-id="${esc(row.id)}" data-meeting-item-id="${esc(row.meetingItemId || '')}"><input type="checkbox" class="issue-status" ${row.status === 'solved' ? 'checked':''}><input class="issue-title" value="${esc(row.title)}"><button type="button" data-remove-row>×</button></div>`).join('')}</div><div class="lead-l10-add"><textarea data-new-issue rows="2" placeholder="Identify an issue to discuss & solve…"></textarea><button type="button" data-add-issue>Add</button></div>`;
  }

  function ratingsReview(item) {
    const ratings = agendaFor(item).ratings;
    return `<div class="lead-l10-items" data-rating-list>${ratings.map(rating => `<div class="lead-l10-rating" data-rating-item><input class="rating-name" value="${esc(rating.name || '')}" placeholder="Name"><input class="rating-score" type="number" min="1" max="10" value="${esc(rating.score ?? '')}"><input class="rating-note" value="${esc(rating.note || '')}" placeholder="Note (optional)"><button type="button" data-remove-row>×</button></div>`).join('')}</div><div class="lead-l10-rating lead-l10-new-rating"><input data-new-rating-name placeholder="Name"><input data-new-rating-score type="number" min="1" max="10" value="8"><input data-new-rating-note placeholder="Note (optional)"><button type="button" data-add-rating>Add</button></div>`;
  }

  function meetingFields(item, today) {
    const agenda = agendaFor(item);
    const meetingDate = item?.meeting_date || today;
    return `<input type="hidden" name="id" value="${esc(item?.id || '')}"><input type="hidden" name="transcriptUrl" value="${esc(item?.transcript_url || '')}">
      <div class="lead-l10-title"><input name="title" required maxlength="220" value="${esc(item?.title || `Weekly Leadership L10 — ${meetingDate}`)}"><input type="date" name="meetingDate" required value="${esc(meetingDate)}"></div>
      ${meetingNavigator(item)}
      <div class="lead-l10-source">✣ <span>${esc(meetingSource(item))}</span>${item?.calendar_html_url ? `<a href="${esc(item.calendar_html_url)}" target="_blank" rel="noopener">Open calendar ↗</a>` : ''}</div>
      <section class="lead-l10-section" data-section-card="segue"><h4><small>5m</small> Segue — Good News</h4>${agendaInputs('goodNews', agenda.goodNews, 'Add a positive headline…')}</section>
      <section class="lead-l10-section" data-section-card="headlines"><h4><small>5m</small> Customer / Employee Headlines</h4>${agendaInputs('headlines', agenda.headlines, 'Add a headline…')}</section>
      <section class="lead-l10-section" data-section-card="scorecard"><div class="lead-l10-section-head"><h4><small>5m</small> KPI Score Card</h4><button type="button" class="lead-l10-row-button" data-open-scorecard>Open scorecard</button></div>${meetingScorecard(item)}</section>
      <section class="lead-l10-section" data-section-card="rocks"><h4><small>5m</small> Rock Review</h4>${rockReview(item)}</section>
      <section class="lead-l10-section" data-section-card="todos"><h4><small>10m</small> To-Do List &amp; Review</h4>${todoReview(item)}</section>
      <section class="lead-l10-section" data-section-card="ids"><h4><small>60m</small> IDS — Identify, Discuss, Solve</h4>${issueReview(item)}</section>
      <section class="lead-l10-section" data-section-card="conclude"><h4><small>5m</small> Conclude — Cascading Messages &amp; Rating</h4><label class="lead-l10-label">Cascading messages</label>${agendaInputs('cascadeMessages', agenda.cascadeMessages, 'Cascade to the team…')}<label class="lead-l10-label">Meeting rating (1–10, below 8 is not good)</label>${ratingsReview(item)}<label class="lead-l10-status"><span>Status</span><select name="status">${['planned','in_progress','completed'].map(value => `<option value="${value}" ${item?.status === value ? 'selected':''}>${value === 'planned' ? 'Scheduled' : statusLabel(value)}</option>`).join('')}</select></label></section>`;
  }

  function openModal(type, item = null) {
    const backdrop = document.querySelector('[data-lead-modal]');
    const target = document.querySelector('[data-lead-modal-content]');
    if (!backdrop || !target) return;
    const today = new Date().toISOString().slice(0,10);
    let title = '';
    let fields = '';

    if (type === 'meeting') {
      title = '';
      fields = meetingFields(item, today);
    } else if (type === 'metric') {
      title = item ? 'Edit scorecard metric' : 'Add scorecard metric';
      fields = `<input type="hidden" name="id" value="${esc(item?.id || '')}"><label><span>Metric name</span><input name="name" required maxlength="180" value="${esc(item?.name || '')}" placeholder="Example: Weekly qualified leads"></label>
        <div class="lead-modal-grid"><label><span>Owner</span><input name="ownerName" maxlength="160" value="${esc(item?.owner_name || '')}" placeholder="Accountable person"></label><label><span>Unit</span><select name="unit">${[['number','Number'],['currency','Currency'],['percent','Percent']].map(([value,label]) => `<option value="${value}" ${item?.unit === value ? 'selected':''}>${label}</option>`).join('')}</select></label></div>
        <div class="lead-modal-grid"><label><span>Target rule</span><select name="direction">${[['higher','At least'],['lower','At most'],['range','Within range']].map(([value,label]) => `<option value="${value}" ${item?.direction === value ? 'selected':''}>${label}</option>`).join('')}</select></label><label><span>Target value</span><input type="number" step="any" name="targetValue" value="${esc(item?.target_value ?? '')}" placeholder="Required for at least/at most"></label></div>
        <div class="lead-modal-grid"><label><span>Range minimum</span><input type="number" step="any" name="targetMin" value="${esc(item?.target_min ?? '')}"></label><label><span>Range maximum</span><input type="number" step="any" name="targetMax" value="${esc(item?.target_max ?? '')}"></label></div>`;
    } else if (type === 'issue') {
      title = item ? 'Edit issue' : 'Add leadership issue';
      fields = `<input type="hidden" name="id" value="${esc(item?.id || '')}"><label><span>Issue</span><input name="title" required maxlength="220" value="${esc(item?.title || '')}" placeholder="Name the issue clearly"></label>
        <div class="lead-modal-grid"><label><span>Priority</span><select name="priority">${['low','normal','high','critical'].map(value => `<option value="${value}" ${item?.priority === value ? 'selected':''}>${esc(statusLabel(value))}</option>`).join('')}</select></label><label><span>Status</span><select name="status">${['open','discussing','solved'].map(value => `<option value="${value}" ${item?.status === value ? 'selected':''}>${esc(statusLabel(value))}</option>`).join('')}</select></label></div>
        <label><span>Owner</span><input name="ownerName" maxlength="160" value="${esc(item?.owner_name || '')}" placeholder="Accountable person"></label><label><span>Meeting</span><select name="meetingId">${meetingsOptions(item?.meeting_id || '')}</select></label>
        <label><span>Description</span><textarea name="description" rows="6" placeholder="What is happening, why it matters, and what must be solved…">${esc(item?.description || '')}</textarea></label>`;
    } else if (type === 'todo') {
      title = item ? 'Edit to-do' : 'Add leadership to-do';
      fields = `<input type="hidden" name="id" value="${esc(item?.id || '')}"><label><span>To-do</span><input name="title" required maxlength="220" value="${esc(item?.title || '')}" placeholder="Specific next action"></label>
        <div class="lead-modal-grid"><label><span>Owner</span><input name="ownerName" maxlength="160" value="${esc(item?.owner_name || '')}" placeholder="Accountable person"></label><label><span>Due date</span><input type="date" name="dueDate" value="${esc(item?.due_date || '')}"></label></div>
        <div class="lead-modal-grid"><label><span>Status</span><select name="status"><option value="open" ${item?.status !== 'complete' ? 'selected':''}>Open</option><option value="complete" ${item?.status === 'complete' ? 'selected':''}>Complete</option></select></label><label><span>Meeting</span><select name="meetingId">${meetingsOptions(item?.meeting_id || '')}</select></label></div>`;
    } else {
      title = item ? 'Edit 90-Day Rock' : 'New 90-Day Rock';
      fields = `<input type="hidden" name="id" value="${esc(item?.id || '')}"><label><span>Rock</span><input name="title" required maxlength="220" value="${esc(item?.title || '')}" placeholder="Measurable 90-day priority"></label>
        <label><span>Description</span><textarea name="description" rows="5" placeholder="Define the outcome and why it matters…">${esc(item?.description || '')}</textarea></label>
        <div class="lead-modal-grid"><label><span>Owner</span><input name="owner" maxlength="160" value="${esc(item?.owner || '')}" placeholder="Accountable person"></label><label><span>Due date</span><input type="date" name="dueDate" value="${esc(item?.dueDate || '')}"></label></div>
        <label><span>Status</span><select name="status">${['Not started','On track','Watch','Complete'].map(value => `<option value="${esc(value)}" ${item?.status === value ? 'selected':''}>${esc(value)}</option>`).join('')}</select></label>`;
    }

    const meetingAction = type === 'meeting' && item?.id && item.status !== 'completed'
      ? `<button type="button" class="lead-primary" ${item.status === 'in_progress' ? 'data-complete-meeting' : 'data-start-meeting'}>${item.status === 'in_progress' ? 'Finish meeting' : 'Start meeting'}</button>`
      : '';
    const saveAction = type === 'meeting' && item?.status === 'completed'
      ? ''
      : `<button type="submit" class="lead-primary">${type === 'meeting' ? 'Save meeting' : 'Save'}</button>`;
    target.innerHTML = `<form data-lead-modal-form="${type}" data-meeting-id="${esc(item?.id || '')}" class="${type === 'meeting' ? 'lead-l10-form':''}"><div class="lead-modal-head">${title ? `<h3>${esc(title)}</h3>` : '<span></span>'}<button type="button" data-close-lead-modal aria-label="Close">×</button></div><div class="lead-modal-fields">${fields}</div><div class="lead-modal-actions"><button type="button" class="lead-secondary" data-close-lead-modal>${item?.status === 'completed' ? 'Close' : 'Cancel'}</button>${saveAction}${meetingAction}</div><p class="lead-form-error" data-form-error></p></form>`;
    document.querySelector('.lead-modal')?.classList.toggle('lead-modal-l10', type === 'meeting');
    backdrop.hidden = false;
    state.openMeetingId = type === 'meeting' ? item?.id || '' : '';
    bindModal();
    startSectionTimer(item);
    if (type === 'meeting' && item?.status === 'completed') {
      target.querySelectorAll('input,textarea,select,button:not([data-close-lead-modal]):not([data-open-scorecard])').forEach(control => {
        control.disabled = true;
      });
    }
    target.querySelector('input:not([type="hidden"]),textarea,select')?.focus();
  }

  function closeModal() {
    const modal = document.querySelector('[data-lead-modal]');
    if (modal) modal.hidden = true;
    document.querySelector('.lead-modal')?.classList.remove('lead-modal-l10');
    state.openMeetingId = '';
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }

  function startSectionTimer(meeting) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
    if (!meeting?.id || meeting.status !== 'in_progress') return;
    const section = meetingRowsFor('sections', meeting.id).find(row => row.status === 'current');
    const node = document.querySelector('[data-section-timer]');
    if (!section || !node) return;
    const update = () => {
      const started = new Date(section.started_at || meeting.started_at || Date.now()).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
      const remaining = (Number(section.duration_minutes) * 60) - elapsed;
      const absolute = Math.abs(remaining);
      const minutes = String(Math.floor(absolute / 60)).padStart(2,'0');
      const seconds = String(absolute % 60).padStart(2,'0');
      node.textContent = `${remaining < 0 ? '+' : ''}${minutes}:${seconds}`;
      node.classList.toggle('over', remaining < 0);
    };
    update();
    state.timerHandle = setInterval(update, 1000);
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function leadershipAction(action, fields) {
    return request('/api/leadership', {
      method:'POST',
      body: JSON.stringify({ ...identity(), action, ...fields })
    });
  }

  async function refreshData() {
    const query = identityQuery();
    const payload = await request(`/api/leadership?${query}`);
    state.leadership = payload.leadership;
  }

  function showToast(message) {
    const toast = document.querySelector('.lead-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.__leadToast);
    window.__leadToast = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  async function handleModalSubmit(form) {
    if (state.saving) return;
    state.saving = true;
    const submit = form.querySelector('[type="submit"]');
    const errorNode = form.querySelector('[data-form-error]');
    if (submit) { submit.disabled = true; submit.textContent = 'Saving…'; }
    if (errorNode) errorNode.textContent = '';
    try {
      const type = form.dataset.leadModalForm;
      const fields = formObject(form);
      if (type === 'rock') {
        await leadershipAction('save_rock', { ...fields, due:'This quarter' });
      } else if (type === 'metric') {
        await leadershipAction('save_metric', fields);
      } else if (type === 'meeting') {
        const agenda = { version:1, rockNotes:{} };
        ['goodNews','headlines','cascadeMessages'].forEach(kind => {
          agenda[kind] = [...form.querySelectorAll(`[data-agenda-list="${kind}"] [data-agenda-item] input`)]
            .map(input => ({ id: crypto.randomUUID(), text: clean(input.value) })).filter(item => item.text);
        });
        agenda.ratings = [...form.querySelectorAll('[data-rating-item]')].map(row => ({
          id: crypto.randomUUID(), name: clean(row.querySelector('.rating-name')?.value),
          score: row.querySelector('.rating-score')?.value || null,
          note: clean(row.querySelector('.rating-note')?.value)
        })).filter(item => item.name || item.score || item.note);
        [...form.querySelectorAll('[data-rock-id]')].forEach(row => {
          agenda.rockNotes[row.dataset.rockId] = { note: clean(row.querySelector('.rock-note')?.value) };
        });
        const scores = agenda.ratings.map(item => Number(item.score)).filter(Number.isFinite);
        const result = await leadershipAction('save_meeting', {
          ...fields, agenda, rating: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null
        });
        const meetingId = result.meeting?.id || fields.id;
        const saves = [];
        form.querySelectorAll('[data-rock-id]').forEach(row => {
          const title = clean(row.querySelector('.rock-title')?.value);
          if (!title) return;
          const outcome = {
            title,
            owner:clean(row.querySelector('.rock-owner')?.value),
            status:row.querySelector('.rock-status')?.value,
            note:clean(row.querySelector('.rock-note')?.value)
          };
          saves.push(leadershipAction('save_rock', {
            id: row.dataset.rockId, title,
            owner: outcome.owner, status: outcome.status,
            due:'This quarter'
          }));
          if (row.dataset.meetingItemId) saves.push(leadershipAction('save_meeting_item_outcome', {
            id:row.dataset.meetingItemId, meetingId, outcome
          }));
        });
        form.querySelectorAll('[data-l10-todos] [data-todo-id]').forEach(row => {
          const outcome = {
            title:clean(row.querySelector('.todo-title')?.value),
            owner_name:clean(row.querySelector('.todo-owner')?.value),
            status:row.querySelector('.todo-status')?.checked ? 'complete' : 'open'
          };
          saves.push(leadershipAction('save_todo', {
            id:row.dataset.todoId.startsWith('new-') ? '' : row.dataset.todoId, meetingId,
            title:outcome.title, ownerName:outcome.owner_name, status:outcome.status
          }));
          if (row.dataset.meetingItemId) saves.push(leadershipAction('save_meeting_item_outcome', {
            id:row.dataset.meetingItemId, meetingId, outcome
          }));
        });
        form.querySelectorAll('[data-l10-issues] [data-issue-id]').forEach(row => {
          const outcome = {
            title:clean(row.querySelector('.issue-title')?.value),
            status:row.querySelector('.issue-status')?.checked ? 'solved' : 'open'
          };
          saves.push(leadershipAction('save_issue', {
            id:row.dataset.issueId.startsWith('new-') ? '' : row.dataset.issueId, meetingId,
            title:outcome.title, status:outcome.status, priority:'normal'
          }));
          if (row.dataset.meetingItemId) saves.push(leadershipAction('save_meeting_item_outcome', {
            id:row.dataset.meetingItemId, meetingId, outcome
          }));
        });
        agenda.ratings.forEach(rating => {
          if (!rating.name) return;
          const attendee = meetingRowsFor('attendees', meetingId).find(row => clean(row.display_name).toLowerCase() === rating.name.toLowerCase());
          saves.push(leadershipAction('save_attendee', {
            id:attendee?.id || '', meetingId, displayName:rating.name,
            attended:true, rating:rating.score, ratingNote:rating.note
          }));
        });
        const removed = safeJson(form.dataset.removedItems || '[]', []);
        removed.forEach(item => saves.push(leadershipAction('delete_leadership_item', { itemType:item.type, id:item.id })));
        await Promise.all(saves);
        if (fields.status === 'in_progress') await leadershipAction('start_meeting', { meetingId });
        if (fields.status === 'completed') await leadershipAction('complete_meeting', { meetingId });
      } else {
        await leadershipAction(`save_${type}`, fields);
      }
      closeModal();
      await refreshData();
      render();
      showToast('Saved.');
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message;
    } finally {
      state.saving = false;
      if (submit) { submit.disabled = false; submit.textContent = form.dataset.leadModalForm === 'meeting' ? 'Save meeting' : 'Save'; }
    }
  }

  function bindModal() {
    document.querySelectorAll('[data-close-lead-modal]').forEach(button => button.addEventListener('click', closeModal));
    document.querySelector('[data-lead-modal-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      handleModalSubmit(event.currentTarget);
    });
    const form = document.querySelector('.lead-l10-form');
    if (!form) return;
    form.dataset.removedItems = '[]';
    form.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.matches('[data-start-meeting]')) {
        form.querySelector('[name="status"]').value = 'in_progress';
        form.requestSubmit();
        return;
      }
      if (button.matches('[data-complete-meeting]')) {
        form.querySelector('[name="status"]').value = 'completed';
        form.requestSubmit();
        return;
      }
      if (button.matches('[data-open-scorecard]')) {
        closeModal();
        state.tab = 'scorecard';
        render();
        return;
      }
      if (button.matches('[data-set-section]')) {
        if (state.saving || !state.openMeetingId) return;
        state.saving = true;
        try {
          await leadershipAction('set_meeting_section', { meetingId:state.openMeetingId, sectionKey:button.dataset.setSection });
          await refreshData();
          const meeting = state.leadership.meetings.find(row => row.id === state.openMeetingId);
          openModal('meeting', meeting);
          requestAnimationFrame(() => document.querySelector(`[data-section-card="${button.dataset.setSection}"]`)?.scrollIntoView({ behavior:'smooth', block:'start' }));
        } catch (error) {
          showToast(error.message);
        } finally {
          state.saving = false;
        }
        return;
      }
      if (button.matches('[data-remove-row]')) {
        const todo = button.closest('[data-todo-id]');
        const issue = button.closest('[data-issue-id]');
        const removed = safeJson(form.dataset.removedItems || '[]', []);
        if (todo && !todo.dataset.todoId.startsWith('new-')) removed.push({ type:'todo', id:todo.dataset.todoId });
        if (issue && !issue.dataset.issueId.startsWith('new-')) removed.push({ type:'issue', id:issue.dataset.issueId });
        form.dataset.removedItems = JSON.stringify(removed);
        button.closest('[data-agenda-item],[data-rating-item],[data-todo-id],[data-issue-id]')?.remove();
      }
      if (button.matches('[data-add-agenda]')) {
        const kind = button.dataset.addAgenda;
        const input = form.querySelector(`[data-agenda-input="${kind}"]`);
        if (!clean(input?.value)) return;
        form.querySelector(`[data-agenda-list="${kind}"]`)?.insertAdjacentHTML('beforeend', `<div class="lead-l10-inline" data-agenda-item><input value="${esc(input.value)}"><button type="button" data-remove-row aria-label="Remove">×</button></div>`);
        input.value = '';
      }
      if (button.matches('[data-add-todo]')) {
        const title = form.querySelector('[data-new-todo]');
        const owner = form.querySelector('[data-new-todo-owner]');
        if (!clean(title?.value)) return;
        form.querySelector('[data-l10-todos]')?.insertAdjacentHTML('beforeend', `<div class="lead-l10-task" data-todo-id="new-${Date.now()}"><input type="checkbox" class="todo-status"><input class="todo-title" value="${esc(title.value)}"><input class="todo-owner" value="${esc(owner?.value || '')}" placeholder="Owner"><button type="button" data-remove-row>×</button></div>`);
        title.value = ''; if (owner) owner.value = '';
      }
      if (button.matches('[data-add-issue]')) {
        const title = form.querySelector('[data-new-issue]');
        if (!clean(title?.value)) return;
        form.querySelector('[data-l10-issues]')?.insertAdjacentHTML('beforeend', `<div class="lead-l10-task" data-issue-id="new-${Date.now()}"><input type="checkbox" class="issue-status"><input class="issue-title" value="${esc(title.value)}"><button type="button" data-remove-row>×</button></div>`);
        title.value = '';
      }
      if (button.matches('[data-add-rating]')) {
        const name = form.querySelector('[data-new-rating-name]');
        const score = form.querySelector('[data-new-rating-score]');
        const note = form.querySelector('[data-new-rating-note]');
        if (!clean(name?.value) && !clean(score?.value) && !clean(note?.value)) return;
        form.querySelector('[data-rating-list]')?.insertAdjacentHTML('beforeend', `<div class="lead-l10-rating" data-rating-item><input class="rating-name" value="${esc(name?.value || '')}" placeholder="Name"><input class="rating-score" type="number" min="1" max="10" value="${esc(score?.value || '')}"><input class="rating-note" value="${esc(note?.value || '')}" placeholder="Note (optional)"><button type="button" data-remove-row>×</button></div>`);
        if (name) name.value = ''; if (score) score.value = '8'; if (note) note.value = '';
      }
      if (button.matches('[data-add-rock-row]')) {
        form.querySelector('[data-l10-rocks]')?.insertAdjacentHTML('beforeend', `<div class="lead-l10-rock" data-rock-id="new-${Date.now()}"><div><input class="rock-title" placeholder="Rock title" aria-label="Rock title"><select class="rock-status" aria-label="Rock status"><option>Not started</option><option>On track</option><option>Watch</option><option>Complete</option></select></div><div><input class="rock-owner" placeholder="Owner"><input class="rock-note" placeholder="Next step / note"></div></div>`);
      }
    });
  }

  function calendarEventDate(event) {
    const raw = clean(event?.start?.date || event?.start?.dateTime);
    return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0,10) : '';
  }

  async function syncCalendarMeetings() {
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 30);
    const to = new Date(now); to.setDate(to.getDate() + 180);
    try {
      const payload = await request('/api/account-auth', {
        method:'POST',
        body: JSON.stringify({ action:'google_calendar_events', maxResults:100, timeMin:from.toISOString(), timeMax:to.toISOString() })
      });
      state.calendar.checked = true;
      state.calendar.connected = true;
      const matches = (payload.events || []).filter(event => event?.status !== 'cancelled'
        && /(^|\b)(l\s*10|level\s*10|leadership)(\b|$)/i.test(clean(event?.summary))
        && calendarEventDate(event));
      const results = await Promise.all(matches.map(event => leadershipAction('sync_calendar_meeting', {
        calendarEventId:event.id,
        title:event.summary,
        meetingDate:calendarEventDate(event),
        calendarHtmlUrl:event.htmlLink || '',
        startsAt:event.start?.dateTime || '',
        endsAt:event.end?.dateTime || '',
        calendarStatus:event.status || 'scheduled',
        sourceUpdatedAt:event.updated || ''
      })));
      state.calendar.imported = results.filter(result => result.changed).length;
      if (state.calendar.imported) await refreshData();
    } catch {
      state.calendar.checked = true;
      state.calendar.connected = false;
      state.calendar.imported = 0;
    }
  }

  async function savePlan(form) {
    if (state.saving) return;
    state.saving = true;
    const submit = form.querySelector('[type="submit"]');
    const fields = formObject(form);
    const plan = state.leadership?.plan || {};
    const payload = {
      coreValues: plan.core_values || [],
      coreFocus: plan.core_focus || '',
      tenYearTarget: plan.ten_year_target || '',
      threeYearPicture: plan.three_year_picture || '',
      oneYearPlan: plan.one_year_plan || '',
      quarterlyFocus: plan.quarterly_focus || '',
      targetMarket: plan.target_market || '',
      threeUniques: plan.three_uniques || [],
      provenProcess: plan.proven_process || '',
      guarantee: plan.guarantee || ''
    };
    if (form.dataset.planForm === 'marketing') {
      payload.targetMarket = fields.targetMarket;
      payload.threeUniques = [fields.unique1, fields.unique2, fields.unique3].filter(Boolean);
      payload.provenProcess = fields.provenProcess;
      payload.guarantee = fields.guarantee;
    } else {
      payload.coreValues = clean(fields.coreValues).split(/\r?\n/).map(clean).filter(Boolean);
      payload.coreFocus = fields.coreFocus;
      payload.tenYearTarget = fields.tenYearTarget;
      payload.threeYearPicture = fields.threeYearPicture;
      payload.oneYearPlan = fields.oneYearPlan;
      payload.quarterlyFocus = fields.quarterlyFocus;
    }
    try {
      if (submit) { submit.disabled = true; submit.textContent = 'Saving…'; }
      await leadershipAction('save_plan', payload);
      await refreshData();
      render();
      showToast('Leadership plan saved.');
    } catch (error) {
      showToast(error.message);
    } finally {
      state.saving = false;
      if (submit) { submit.disabled = false; submit.textContent = 'Save'; }
    }
  }

  async function saveMetricEntry(form) {
    if (state.saving) return;
    state.saving = true;
    const submit = form.querySelector('[type="submit"]');
    try {
      submit.disabled = true;
      submit.textContent = 'Saving…';
      const fields = formObject(form);
      await leadershipAction('save_metric_entry', {
        metricId:form.dataset.metricEntryForm,
        weekStart:fields.weekStart,
        value:fields.value,
        source:'manual'
      });
      await refreshData();
      render();
      showToast('Weekly scorecard value saved.');
    } catch (error) {
      showToast(error.message);
    } finally {
      state.saving = false;
      if (submit) { submit.disabled = false; submit.textContent = 'Save'; }
    }
  }

  function bind() {
    document.querySelector('[data-retry-leadership]')?.addEventListener('click', load);
    document.querySelectorAll('[data-lead-tab]').forEach(button => button.addEventListener('click', () => {
      state.tab = button.dataset.leadTab;
      render();
    }));
    document.querySelectorAll('[data-new-meeting]').forEach(button => button.addEventListener('click', () => openModal('meeting')));
    document.querySelectorAll('[data-new-metric]').forEach(button => button.addEventListener('click', () => openModal('metric')));
    document.querySelectorAll('[data-new-issue]').forEach(button => button.addEventListener('click', () => openModal('issue')));
    document.querySelectorAll('[data-new-todo]').forEach(button => button.addEventListener('click', () => openModal('todo')));
    document.querySelectorAll('[data-new-rock]').forEach(button => button.addEventListener('click', () => openModal('rock')));
    document.querySelectorAll('[data-edit-meeting]').forEach(button => button.addEventListener('click', () => openModal('meeting', state.leadership.meetings.find(item => item.id === button.dataset.editMeeting))));
    document.querySelectorAll('[data-edit-metric]').forEach(button => button.addEventListener('click', () => openModal('metric', state.leadership.metrics.find(item => item.id === button.dataset.editMetric))));
    document.querySelectorAll('[data-edit-issue]').forEach(button => button.addEventListener('click', () => openModal('issue', state.leadership.issues.find(item => item.id === button.dataset.editIssue))));
    document.querySelectorAll('[data-edit-todo]').forEach(button => button.addEventListener('click', () => openModal('todo', state.leadership.todos.find(item => item.id === button.dataset.editTodo))));
    document.querySelectorAll('[data-edit-rock]').forEach(button => button.addEventListener('click', () => openModal('rock', state.leadership.rocks.find(item => item.id === button.dataset.editRock))));
    document.querySelector('[data-plan-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      savePlan(event.currentTarget);
    });
    document.querySelectorAll('[data-metric-entry-form]').forEach(form => form.addEventListener('submit', event => {
      event.preventDefault();
      saveMetricEntry(event.currentTarget);
    }));
    const backdrop = document.querySelector('[data-lead-modal]');
    backdrop?.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
  }

  async function load() {
    state.loading = true;
    state.error = null;
    render();
    try {
      await refreshData();
      await syncCalendarMeetings();
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      render();
    }
  }

  load();
})();
