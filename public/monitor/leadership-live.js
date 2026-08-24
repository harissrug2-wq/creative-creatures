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
    error: null
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
      ${pill(meeting.status)}
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
      <div class="lead-source-notice"><span>Native</span><div><strong>Leadership meeting workspace</strong><p>Create meetings, store notes, assign to-dos, and record the meeting rating. Automatic note-taker import is not connected, so no transcript or agenda is invented.</p></div></div>
      <div class="lead-section-head"><div><span>Meeting cadence</span><h2>Weekly leadership meetings</h2></div><button type="button" class="lead-primary" data-new-meeting>＋ New meeting</button></div>
      <section class="lead-card">${meetingRows()}</section>
      <div class="lead-section-head"><div><span>Follow-through</span><h2>Leadership to-dos</h2></div><button type="button" class="lead-secondary" data-new-todo>＋ Add to-do</button></div>
      <section class="lead-card">${todoRows()}</section>
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

  function openModal(type, item = null) {
    const backdrop = document.querySelector('[data-lead-modal]');
    const target = document.querySelector('[data-lead-modal-content]');
    if (!backdrop || !target) return;
    const today = new Date().toISOString().slice(0,10);
    let title = '';
    let fields = '';

    if (type === 'meeting') {
      title = item ? 'Edit leadership meeting' : 'New leadership meeting';
      fields = `<input type="hidden" name="id" value="${esc(item?.id || '')}">
        <label><span>Meeting title</span><input name="title" required maxlength="220" value="${esc(item?.title || '')}" placeholder="Weekly Leadership Meeting"></label>
        <div class="lead-modal-grid"><label><span>Date</span><input type="date" name="meetingDate" required value="${esc(item?.meeting_date || today)}"></label><label><span>Status</span><select name="status">${['planned','in_progress','completed'].map(value => `<option value="${value}" ${item?.status === value ? 'selected':''}>${esc(statusLabel(value))}</option>`).join('')}</select></label></div>
        <div class="lead-modal-grid"><label><span>Facilitator</span><input name="facilitatorName" maxlength="160" value="${esc(item?.facilitator_name || '')}" placeholder="Name"></label><label><span>Rating (0–10)</span><input type="number" min="0" max="10" step="0.1" name="rating" value="${esc(item?.rating ?? '')}"></label></div>
        <label><span>Transcript URL <small>optional</small></span><input type="url" name="transcriptUrl" value="${esc(item?.transcript_url || '')}" placeholder="https://…"></label>
        <label><span>Meeting notes</span><textarea name="notes" rows="7" placeholder="Segue, KPI review, Rock check-in, to-dos and IDS notes…">${esc(item?.notes || '')}</textarea></label>`;
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

    target.innerHTML = `<form data-lead-modal-form="${type}"><div class="lead-modal-head"><h3>${esc(title)}</h3><button type="button" data-close-lead-modal aria-label="Close">×</button></div><div class="lead-modal-fields">${fields}</div><div class="lead-modal-actions"><button type="button" class="lead-secondary" data-close-lead-modal>Cancel</button><button type="submit" class="lead-primary">Save</button></div><p class="lead-form-error" data-form-error></p></form>`;
    backdrop.hidden = false;
    bindModal();
    target.querySelector('input:not([type="hidden"]),textarea,select')?.focus();
  }

  function closeModal() {
    const modal = document.querySelector('[data-lead-modal]');
    if (modal) modal.hidden = true;
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
      if (submit) { submit.disabled = false; submit.textContent = 'Save'; }
    }
  }

  function bindModal() {
    document.querySelectorAll('[data-close-lead-modal]').forEach(button => button.addEventListener('click', closeModal));
    document.querySelector('[data-lead-modal-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      handleModalSubmit(event.currentTarget);
    });
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

  function bind() {
    document.querySelector('[data-retry-leadership]')?.addEventListener('click', load);
    document.querySelectorAll('[data-lead-tab]').forEach(button => button.addEventListener('click', () => {
      state.tab = button.dataset.leadTab;
      render();
    }));
    document.querySelectorAll('[data-new-meeting]').forEach(button => button.addEventListener('click', () => openModal('meeting')));
    document.querySelectorAll('[data-new-issue]').forEach(button => button.addEventListener('click', () => openModal('issue')));
    document.querySelectorAll('[data-new-todo]').forEach(button => button.addEventListener('click', () => openModal('todo')));
    document.querySelectorAll('[data-new-rock]').forEach(button => button.addEventListener('click', () => openModal('rock')));
    document.querySelectorAll('[data-edit-meeting]').forEach(button => button.addEventListener('click', () => openModal('meeting', state.leadership.meetings.find(item => item.id === button.dataset.editMeeting))));
    document.querySelectorAll('[data-edit-issue]').forEach(button => button.addEventListener('click', () => openModal('issue', state.leadership.issues.find(item => item.id === button.dataset.editIssue))));
    document.querySelectorAll('[data-edit-todo]').forEach(button => button.addEventListener('click', () => openModal('todo', state.leadership.todos.find(item => item.id === button.dataset.editTodo))));
    document.querySelectorAll('[data-edit-rock]').forEach(button => button.addEventListener('click', () => openModal('rock', state.leadership.rocks.find(item => item.id === button.dataset.editRock))));
    document.querySelector('[data-plan-form]')?.addEventListener('submit', event => {
      event.preventDefault();
      savePlan(event.currentTarget);
    });
    const backdrop = document.querySelector('[data-lead-modal]');
    backdrop?.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
  }

  async function load() {
    state.loading = true;
    state.error = null;
    render();
    try {
      await refreshData();
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      render();
    }
  }

  load();
})();
