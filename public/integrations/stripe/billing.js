(() => {
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let connection, view = 'customers', records = [], hasMore = false, busy = false, editing = null, sending = null, pendingKey = '';
  const money = (amount, currency) => new Intl.NumberFormat(undefined, { style:'currency', currency:currency || 'USD' }).format((amount || 0) / 100);
  function error(message = '') { $('error').textContent = message; $('error').hidden = !message; }
  function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
  async function api(action, data) {
    const r = await fetch(`/api/agency-stripe/?action=${encodeURIComponent(action)}`, data === undefined ? {} : { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(data) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(body.error || 'Billing request failed.'), { status:r.status });
    return body;
  }
  function pending() { try { return JSON.parse(sessionStorage.getItem(pendingKey)); } catch { return null; } }
  function setPending(value) { if (value) sessionStorage.setItem(pendingKey, JSON.stringify(value)); else sessionStorage.removeItem(pendingKey); }
  function showPending() {
    const old = $('resume'); if (old) old.remove();
    if (!pending()) return;
    const b = document.createElement('button'); b.id = 'resume'; b.className = 'secondary'; b.textContent = 'Resume unfinished billing request'; b.onclick = () => openEditor(pending());
    $('workspace').prepend(b);
    notice('An unfinished request is saved in this browser tab. Resume it before creating another customer or invoice.');
  }
  async function start() {
    try {
      error(); const result = await api('status'); connection = result.connection;
      $('connect').hidden = connection.connected || !connection.configured;
      $('workspace').hidden = !connection.connected; $('disconnect').hidden = !connection.connected; $('refresh').hidden = !connection.connected;
      $('connection').textContent = !connection.configured ? 'Stripe setup required' : connection.connected ? `${connection.name} · ${connection.environment === 'test' ? 'TEST MODE' : 'Live'} · ${connection.stripeAccountId}` : 'No Stripe account connected';
      if (!connection.configured) notice('Agency Stripe billing has not been enabled. Contact Creative Creatures support.');
      if (connection.connected) { pendingKey = `ccAgencyStripe:${connection.environment}:${connection.stripeAccountId}`; await load(); showPending(); }
    } catch (e) { error(e.message); $('connection').textContent = 'Billing unavailable'; }
  }
  async function load(more = false) {
    if (busy) return; busy = true; $('more').disabled = true;
    try {
      error(); const r = await api(view, { cursor:more ? records.at(-1)?.id : '' });
      records = more ? records.concat(r.records) : r.records; hasMore = r.hasMore; render();
    } catch (e) { error(e.message); }
    finally { busy = false; $('more').disabled = false; }
  }
  function render() {
    $('listTitle').textContent = view === 'customers' ? 'Customers' : 'Invoices';
    $('more').hidden = !hasMore;
    $('records').innerHTML = records.length ? records.map(r => view === 'customers' ? `<article class="record"><div><strong>${esc(r.name || r.email || r.id)}</strong><p>${esc(r.email)}</p><p>${esc(r.phone)}</p></div><div class="actions"><button class="secondary" data-edit="${esc(r.id)}">Edit</button><button data-invoice="${esc(r.id)}">New invoice</button></div></article>` : `<article class="record"><div><strong>${esc(r.number)}</strong> <span class="tag">${esc(r.status)}</span><p>${esc(r.customerName || r.customerEmail || r.customerId)}</p><p>${esc(r.description)}</p><strong>${esc(money(r.total, r.currency))}</strong>${r.dueDate ? `<p>Due ${esc(new Date(r.dueDate * 1000).toLocaleDateString())}</p>` : ''}</div><div class="actions">${r.hostedUrl ? `<a href="${esc(r.hostedUrl)}" target="_blank" rel="noopener noreferrer">View invoice ↗</a>` : ''}${r.manageable && ['draft','open'].includes(r.status) ? `<button data-send="${esc(r.id)}">Review &amp; send</button>` : ''}</div></article>`).join('') : '<div class="empty">No records found in this Stripe account.</div>';
  }
  async function switchView(next) { if (busy) return; view = next; records = []; render(); await load(); }
  function beginEditor(kind, item = {}) {
    if (pending()) { showPending(); return; }
    const body = kind === 'customer' ? { id:item.id || '', name:item.name || '', email:item.email || '', phone:item.phone || '' } : { customerId:item.id, customerName:item.name || item.email, description:'', amount:'', currency:'usd', daysUntilDue:30 };
    openEditor({ kind, body });
  }
  function openEditor(value) {
    editing = value; $('formError').textContent = '';
    const b = value.body, locked = !!b.requestId;
    $('editorTitle').textContent = value.kind === 'customer' ? (b.id ? 'Edit customer' : 'New customer') : 'Create draft invoice';
    $('fields').innerHTML = value.kind === 'customer' ? `<label>Name<input name="name" maxlength="200" required value="${esc(b.name)}"></label><label>Email<input name="email" type="email" maxlength="254" required value="${esc(b.email)}"></label><label>Phone<input name="phone" maxlength="40" value="${esc(b.phone)}"></label>` : `<p>Customer: <strong>${esc(b.customerName || b.customerId)}</strong></p><label>Description<textarea name="description" maxlength="500" required>${esc(b.description)}</textarea></label><label>Amount<input name="amount" inputmode="decimal" pattern="[0-9]{1,6}(\\.[0-9]{1,2})?" required value="${esc(b.amount)}"></label><label>Currency<select name="currency">${['usd','gbp','eur','cad','aud'].map(c => `<option value="${c}" ${b.currency === c ? 'selected' : ''}>${c.toUpperCase()}</option>`).join('')}</select></label><label>Payment due in days<input name="daysUntilDue" type="number" min="1" max="90" required value="${esc(b.daysUntilDue)}"></label><p class="muted">A draft is created first. Review the final total before sending. Stripe customer balances, discounts, and tax settings can affect that total.</p>`;
    $('fields').querySelectorAll('input,textarea,select').forEach(el => el.disabled = locked);
    $('save').textContent = locked ? 'Retry saved request' : value.kind === 'customer' ? 'Save customer' : 'Create draft';
    $('editor').showModal();
  }
  $('editorForm').onsubmit = async e => {
    e.preventDefault(); const button = $('save'); if (button.disabled) return; button.disabled = true; $('cancel').disabled = true; $('formError').textContent = '';
    try {
      if (!editing.body.requestId) {
        const data = Object.fromEntries(new FormData(e.currentTarget));
        editing.body = { ...editing.body, ...data, requestId:crypto.randomUUID() }; setPending(editing);
      }
      $('fields').querySelectorAll('input,textarea,select').forEach(el => el.disabled = true);
      const result = await api(editing.kind === 'customer' ? 'save_customer' : 'create_invoice', editing.body);
      setPending(null); showPending(); $('editor').close(); notice(result.invoice ? `Draft ${result.invoice.number} created. Review it before sending.` : 'Customer saved.');
      await switchView(result.invoice ? 'invoices' : 'customers');
    } catch (err) {
      $('formError').textContent = err.message;
      if (err.status === 422) { setPending(null); delete editing.body.requestId; $('fields').querySelectorAll('input,textarea,select').forEach(el => el.disabled = false); }
      else { $('save').textContent = 'Retry saved request'; }
    } finally { button.disabled = false; $('cancel').disabled = false; }
  };
  $('editor').addEventListener('cancel', e => { if ($('save').disabled) e.preventDefault(); });
  $('cancel').onclick = () => { $('editor').close(); showPending(); };
  $('records').onclick = e => {
    const edit = e.target.closest('[data-edit]'), invoice = e.target.closest('[data-invoice]'), send = e.target.closest('[data-send]');
    if (edit) beginEditor('customer', records.find(r => r.id === edit.dataset.edit));
    if (invoice) beginEditor('invoice', records.find(r => r.id === invoice.dataset.invoice));
    if (send) {
      sending = records.find(r => r.id === send.dataset.send); $('sendError').textContent = '';
      $('sendSummary').textContent = `${sending.number}: ${money(sending.total, sending.currency)} to ${sending.customerEmail || '(no email)'}`;
      $('confirmSend').textContent = sending.status === 'draft' ? 'Finalize and send' : 'Send invoice'; $('sendDialog').showModal();
    }
  };
  $('sendForm').onsubmit = async e => {
    e.preventDefault(); if ($('confirmSend').disabled) return; $('confirmSend').disabled = true; $('cancelSend').disabled = true;
    try {
      await api('send_invoice', { id:sending.id, total:sending.total, currency:sending.currency, email:sending.customerEmail, confirm:true });
      $('sendDialog').close(); notice(connection.environment === 'test' ? 'Stripe accepted the test send. Test mode does not deliver invoice emails.' : 'Stripe accepted the invoice send request.'); await load();
    } catch (err) { $('sendError').textContent = err.message; }
    finally { $('confirmSend').disabled = false; $('cancelSend').disabled = false; }
  };
  $('sendDialog').addEventListener('cancel', e => { if ($('confirmSend').disabled) e.preventDefault(); });
  $('cancelSend').onclick = () => $('sendDialog').close();
  $('newCustomer').onclick = () => beginEditor('customer');
  $('newInvoice').onclick = async () => { await switchView('customers'); notice('Choose “New invoice” beside the customer you want to bill.'); };
  $('customersTab').onclick = () => switchView('customers'); $('invoicesTab').onclick = () => switchView('invoices');
  $('refresh').onclick = () => load(); $('more').onclick = () => load(true);
  $('connect').onclick = async () => { $('connect').disabled = true; try { const r = await api('connect', {}); const url = new URL(r.authorizationUrl); if (url.origin !== 'https://connect.stripe.com') throw new Error('Unexpected Stripe address.'); location.assign(url); } catch (e) { error(e.message); $('connect').disabled = false; } };
  $('disconnect').onclick = async () => { if (!confirm('Disconnect this agency’s Stripe account? Existing invoices and subscriptions will continue in Stripe.')) return; $('disconnect').disabled = true; try { await api('disconnect', {}); notice('Stripe disconnected.'); await start(); } catch (e) { error(e.message); } finally { $('disconnect').disabled = false; } };
  start();
})();
