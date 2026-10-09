(() => {
  const API_BASE = '/api/goals';
  let cached = null;
  let loadPromise = null;
  const SESSION_TTL = 20000;

  const safeJson = (value, fallback = null) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };

  const account = () => window.CCAccount?.getAccount?.()
    || safeJson(localStorage.getItem('cc_account'), null)
    || safeJson(localStorage.getItem('ccUserAccount'), null);

  function identity() {
    const current = account() || {};
    const params = new URLSearchParams(location.search);
    const tenant = params.get('tenant') || params.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
    return {
      accountId: tenant || (current.id && !String(current.id).startsWith('local-') ? current.id : ''),
      email: tenant ? '' : (current.email || localStorage.getItem('ccOwnerEmail') || ''),
      agencyUrl: tenant ? '' : (current.agency_url || current.agencyUrl || localStorage.getItem('ccAgencyWebsite') || '')
    };
  }

  function sessionKey(current=identity()){
    const key=current.accountId||current.email||current.agencyUrl||'session';
    return `cc_goals_cache:${key}`;
  }
  function readSession(current){
    try{
      const key=sessionKey(current);if(!key)return null;
      const row=safeJson(sessionStorage.getItem(key),null);
      if(!row||Date.now()-Number(row.at||0)>SESSION_TTL)return null;
      return row.goals||null;
    }catch{return null}
  }
  function writeSession(current,value){
    try{const key=sessionKey(current);if(key)sessionStorage.setItem(key,JSON.stringify({at:Date.now(),goals:value}))}catch{}
  }
  function clearSession(){
    try{const key=sessionKey();if(key)sessionStorage.removeItem(key)}catch{}
  }

  function requireIdentity() {
    const current = identity();
    if (!current.accountId && !current.email && !current.agencyUrl) {
      const error = new Error('Sign in to load Agency Goals.');
      error.code = 'ACCOUNT_REQUIRED';
      throw error;
    }
    return current;
  }

  const FALLBACK_DEPARTMENTS = ['Leadership','Marketing','Sales','Onboarding','Billing','Service Delivery','Client Success'];
  const FALLBACK_METRICS = [
    { id:'ownerDelivery', group:'Owner Dependency', label:'Owner Time in Delivery (%)', unit:'%' },
    { id:'ownerSales', group:'Owner Dependency', label:'Owner Time in Sales (%)', unit:'%' },
    { id:'revenue', group:'Financial', label:'Revenue (TTM)', unit:'
  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  async function load(options = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      cached = window.CCDemo.goals;
      return cached;
    }
    if (cached && options.fresh !== true) return cached;

    try { await window.CCAccount?.ready; } catch {}
    const current = identity();

    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){cached=saved;return cached}
      if(loadPromise)return loadPromise;
    }

    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const params = new URLSearchParams();
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) {
        params.set('admin','1');
        params.set('tenant',tenant);
        params.set('accountId',tenant);
      }
    }

    // Normal workspace access is authorized entirely by the signed account
    // session cookie. Do not send localStorage account/email/url selectors:
    // member logins can differ from the agency owner identity and stale browser
    // values otherwise cause ACCOUNT_ACCESS_DENIED.
    const query = params.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    loadPromise = request(url).then(payload => {
      cached = payload.goals || null;
      writeSession(current,cached);
      return cached;
    }).catch(async error => {
      console.warn('Agency Goals API failed; loading generated Scorecard fallback.', error);
      cached = await loadScorecardFallback();
      writeSession(current,cached);
      return cached;
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function action(actionName, fields = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      const model = window.CCDemo.goals;
      if(actionName==='set_target'){
        model.targets[fields.metricId]={type:fields.targetType,value:Number(fields.targetValue),resolvedValue:Number(fields.targetValue),baselineValue:model.metrics.find(m=>m.id===fields.metricId)?.actualValue??null,notes:fields.targetNotes||''};
      } else if(actionName==='bulk_set_targets'&&Array.isArray(fields.targets)){
        fields.targets.forEach(t=>{model.targets[t.metricId]={type:t.targetType,value:Number(t.targetValue),resolvedValue:Number(t.targetValue),baselineValue:model.metrics.find(m=>m.id===t.metricId)?.actualValue??null,notes:t.targetNotes||''}});
      } else if(actionName==='save_progress'){
        const metric=model.metrics.find(m=>m.id===fields.metricId);if(metric){metric.actualValue=Number(fields.actualValue);metric.actualDisplay=String(fields.actualValue)}
      } else if(actionName==='save_department'){
        const row=model.departments.find(d=>d.name===fields.department);if(row)Object.assign(row,{goal:fields.goal||row.goal,owner:fields.owner||fields.ownerName||row.owner,status:fields.status||row.status,done:fields.done||fields.doneLooksLike||row.done,completionDate:fields.completionDate||row.completionDate});
      } else if(actionName==='create_rocks'&&Array.isArray(fields.rocks)){
        fields.rocks.forEach((r,i)=>model.rocks.push({id:`demo-rock-${Date.now()}-${i}`,title:r.title||'Priority',description:r.description||'',owner:r.owner||'Agency Owner',dueDate:r.dueDate||'',status:r.status||'Not started',sourceType:'manual'}));
      } else if(actionName==='update_rock'){
        const rock=model.rocks.find(r=>r.id===fields.id);if(rock)Object.assign(rock,fields);
      } else if(actionName==='complete'){
        model.goalsComplete=true;model.goalsCompletedAt=new Date().toISOString();
      }
      cached=model;
      return {success:true,goals:model,demo:true};
    }
    try { await window.CCAccount?.ready; } catch {}
    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const selector = {};
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) Object.assign(selector, { admin:'1', tenant, accountId:tenant });
    }

    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...selector, action: actionName, ...fields })
    });
    cached = null;
    loadPromise = null;
    clearSession();
    return payload;
  }

  const saveTarget = (metricId, targetType, targetValue, targetNotes = '', targetDirection = 'increase') =>
    action('set_target', { metricId, targetType, targetValue, targetNotes, targetDirection });
  const saveTargets = targets => action('bulk_set_targets', { targets });

  const saveProgress = (metricId, actualValue, note = '') => action('save_progress', { metricId, actualValue, note });
  const saveDepartment = department => action('save_department', department);
  const createRocks = rocks => action('create_rocks', { rocks });
  const updateRock = rock => action('update_rock', rock);
  const saveCardLayout = (metricIds, departmentNames) => action('save_card_layout', { metricIds, departmentNames });
  const complete = () => action('complete');
  const clear = () => { cached = null; loadPromise = null; clearSession(); };

  window.CCGoals = { load, loadScorecardFallback, saveTarget, saveTargets, saveProgress, saveDepartment, createRocks, updateRock, saveCardLayout, complete, clear };
})();
 },
    { id:'cogs', group:'Financial', label:'COGS % of Revenue', unit:'%' },
    { id:'margin', group:'Financial', label:'Net (Profit) Margin', unit:'%' },
    { id:'sde', group:'Financial', label:'SDE', unit:'
  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  async function load(options = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      cached = window.CCDemo.goals;
      return cached;
    }
    if (cached && options.fresh !== true) return cached;

    try { await window.CCAccount?.ready; } catch {}
    const current = identity();

    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){cached=saved;return cached}
      if(loadPromise)return loadPromise;
    }

    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const params = new URLSearchParams();
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) {
        params.set('admin','1');
        params.set('tenant',tenant);
        params.set('accountId',tenant);
      }
    }

    // Normal workspace access is authorized entirely by the signed account
    // session cookie. Do not send localStorage account/email/url selectors:
    // member logins can differ from the agency owner identity and stale browser
    // values otherwise cause ACCOUNT_ACCESS_DENIED.
    const query = params.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    loadPromise = request(url).then(payload => {
      cached = payload.goals || null;
      writeSession(current,cached);
      return cached;
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function action(actionName, fields = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      const model = window.CCDemo.goals;
      if(actionName==='set_target'){
        model.targets[fields.metricId]={type:fields.targetType,value:Number(fields.targetValue),resolvedValue:Number(fields.targetValue),baselineValue:model.metrics.find(m=>m.id===fields.metricId)?.actualValue??null,notes:fields.targetNotes||''};
      } else if(actionName==='bulk_set_targets'&&Array.isArray(fields.targets)){
        fields.targets.forEach(t=>{model.targets[t.metricId]={type:t.targetType,value:Number(t.targetValue),resolvedValue:Number(t.targetValue),baselineValue:model.metrics.find(m=>m.id===t.metricId)?.actualValue??null,notes:t.targetNotes||''}});
      } else if(actionName==='save_progress'){
        const metric=model.metrics.find(m=>m.id===fields.metricId);if(metric){metric.actualValue=Number(fields.actualValue);metric.actualDisplay=String(fields.actualValue)}
      } else if(actionName==='save_department'){
        const row=model.departments.find(d=>d.name===fields.department);if(row)Object.assign(row,{goal:fields.goal||row.goal,owner:fields.owner||fields.ownerName||row.owner,status:fields.status||row.status,done:fields.done||fields.doneLooksLike||row.done,completionDate:fields.completionDate||row.completionDate});
      } else if(actionName==='create_rocks'&&Array.isArray(fields.rocks)){
        fields.rocks.forEach((r,i)=>model.rocks.push({id:`demo-rock-${Date.now()}-${i}`,title:r.title||'Priority',description:r.description||'',owner:r.owner||'Agency Owner',dueDate:r.dueDate||'',status:r.status||'Not started',sourceType:'manual'}));
      } else if(actionName==='update_rock'){
        const rock=model.rocks.find(r=>r.id===fields.id);if(rock)Object.assign(rock,fields);
      } else if(actionName==='complete'){
        model.goalsComplete=true;model.goalsCompletedAt=new Date().toISOString();
      }
      cached=model;
      return {success:true,goals:model,demo:true};
    }
    try { await window.CCAccount?.ready; } catch {}
    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const selector = {};
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) Object.assign(selector, { admin:'1', tenant, accountId:tenant });
    }

    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...selector, action: actionName, ...fields })
    });
    cached = null;
    loadPromise = null;
    clearSession();
    return payload;
  }

  const saveTarget = (metricId, targetType, targetValue, targetNotes = '', targetDirection = 'increase') =>
    action('set_target', { metricId, targetType, targetValue, targetNotes, targetDirection });
  const saveTargets = targets => action('bulk_set_targets', { targets });

  const saveProgress = (metricId, actualValue, note = '') => action('save_progress', { metricId, actualValue, note });
  const saveDepartment = department => action('save_department', department);
  const createRocks = rocks => action('create_rocks', { rocks });
  const updateRock = rock => action('update_rock', rock);
  const saveCardLayout = (metricIds, departmentNames) => action('save_card_layout', { metricIds, departmentNames });
  const complete = () => action('complete');
  const clear = () => { cached = null; loadPromise = null; clearSession(); };

  window.CCGoals = { load, saveTarget, saveTargets, saveProgress, saveDepartment, createRocks, updateRock, saveCardLayout, complete, clear };
})();
 },
    { id:'leadership', group:'Operational', label:'Leadership Maturity Level', unit:'level' },
    { id:'aofi', group:'Operational', label:'Agency Owner Freedom Index (AOFI) Score', unit:'score' },
    { id:'valuation', group:'Agency Value', label:'Enterprise Valuation', unit:'
  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  async function load(options = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      cached = window.CCDemo.goals;
      return cached;
    }
    if (cached && options.fresh !== true) return cached;

    try { await window.CCAccount?.ready; } catch {}
    const current = identity();

    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){cached=saved;return cached}
      if(loadPromise)return loadPromise;
    }

    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const params = new URLSearchParams();
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) {
        params.set('admin','1');
        params.set('tenant',tenant);
        params.set('accountId',tenant);
      }
    }

    // Normal workspace access is authorized entirely by the signed account
    // session cookie. Do not send localStorage account/email/url selectors:
    // member logins can differ from the agency owner identity and stale browser
    // values otherwise cause ACCOUNT_ACCESS_DENIED.
    const query = params.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    loadPromise = request(url).then(payload => {
      cached = payload.goals || null;
      writeSession(current,cached);
      return cached;
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function action(actionName, fields = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      const model = window.CCDemo.goals;
      if(actionName==='set_target'){
        model.targets[fields.metricId]={type:fields.targetType,value:Number(fields.targetValue),resolvedValue:Number(fields.targetValue),baselineValue:model.metrics.find(m=>m.id===fields.metricId)?.actualValue??null,notes:fields.targetNotes||''};
      } else if(actionName==='bulk_set_targets'&&Array.isArray(fields.targets)){
        fields.targets.forEach(t=>{model.targets[t.metricId]={type:t.targetType,value:Number(t.targetValue),resolvedValue:Number(t.targetValue),baselineValue:model.metrics.find(m=>m.id===t.metricId)?.actualValue??null,notes:t.targetNotes||''}});
      } else if(actionName==='save_progress'){
        const metric=model.metrics.find(m=>m.id===fields.metricId);if(metric){metric.actualValue=Number(fields.actualValue);metric.actualDisplay=String(fields.actualValue)}
      } else if(actionName==='save_department'){
        const row=model.departments.find(d=>d.name===fields.department);if(row)Object.assign(row,{goal:fields.goal||row.goal,owner:fields.owner||fields.ownerName||row.owner,status:fields.status||row.status,done:fields.done||fields.doneLooksLike||row.done,completionDate:fields.completionDate||row.completionDate});
      } else if(actionName==='create_rocks'&&Array.isArray(fields.rocks)){
        fields.rocks.forEach((r,i)=>model.rocks.push({id:`demo-rock-${Date.now()}-${i}`,title:r.title||'Priority',description:r.description||'',owner:r.owner||'Agency Owner',dueDate:r.dueDate||'',status:r.status||'Not started',sourceType:'manual'}));
      } else if(actionName==='update_rock'){
        const rock=model.rocks.find(r=>r.id===fields.id);if(rock)Object.assign(rock,fields);
      } else if(actionName==='complete'){
        model.goalsComplete=true;model.goalsCompletedAt=new Date().toISOString();
      }
      cached=model;
      return {success:true,goals:model,demo:true};
    }
    try { await window.CCAccount?.ready; } catch {}
    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const selector = {};
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) Object.assign(selector, { admin:'1', tenant, accountId:tenant });
    }

    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...selector, action: actionName, ...fields })
    });
    cached = null;
    loadPromise = null;
    clearSession();
    return payload;
  }

  const saveTarget = (metricId, targetType, targetValue, targetNotes = '', targetDirection = 'increase') =>
    action('set_target', { metricId, targetType, targetValue, targetNotes, targetDirection });
  const saveTargets = targets => action('bulk_set_targets', { targets });

  const saveProgress = (metricId, actualValue, note = '') => action('save_progress', { metricId, actualValue, note });
  const saveDepartment = department => action('save_department', department);
  const createRocks = rocks => action('create_rocks', { rocks });
  const updateRock = rock => action('update_rock', rock);
  const saveCardLayout = (metricIds, departmentNames) => action('save_card_layout', { metricIds, departmentNames });
  const complete = () => action('complete');
  const clear = () => { cached = null; loadPromise = null; clearSession(); };

  window.CCGoals = { load, saveTarget, saveTargets, saveProgress, saveDepartment, createRocks, updateRock, saveCardLayout, complete, clear };
})();
 }
  ];

  function metricDisplay(definition, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    if (definition.unit === '
  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  async function load(options = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      cached = window.CCDemo.goals;
      return cached;
    }
    if (cached && options.fresh !== true) return cached;

    try { await window.CCAccount?.ready; } catch {}
    const current = identity();

    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){cached=saved;return cached}
      if(loadPromise)return loadPromise;
    }

    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const params = new URLSearchParams();
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) {
        params.set('admin','1');
        params.set('tenant',tenant);
        params.set('accountId',tenant);
      }
    }

    // Normal workspace access is authorized entirely by the signed account
    // session cookie. Do not send localStorage account/email/url selectors:
    // member logins can differ from the agency owner identity and stale browser
    // values otherwise cause ACCOUNT_ACCESS_DENIED.
    const query = params.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    loadPromise = request(url).then(payload => {
      cached = payload.goals || null;
      writeSession(current,cached);
      return cached;
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function action(actionName, fields = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      const model = window.CCDemo.goals;
      if(actionName==='set_target'){
        model.targets[fields.metricId]={type:fields.targetType,value:Number(fields.targetValue),resolvedValue:Number(fields.targetValue),baselineValue:model.metrics.find(m=>m.id===fields.metricId)?.actualValue??null,notes:fields.targetNotes||''};
      } else if(actionName==='bulk_set_targets'&&Array.isArray(fields.targets)){
        fields.targets.forEach(t=>{model.targets[t.metricId]={type:t.targetType,value:Number(t.targetValue),resolvedValue:Number(t.targetValue),baselineValue:model.metrics.find(m=>m.id===t.metricId)?.actualValue??null,notes:t.targetNotes||''}});
      } else if(actionName==='save_progress'){
        const metric=model.metrics.find(m=>m.id===fields.metricId);if(metric){metric.actualValue=Number(fields.actualValue);metric.actualDisplay=String(fields.actualValue)}
      } else if(actionName==='save_department'){
        const row=model.departments.find(d=>d.name===fields.department);if(row)Object.assign(row,{goal:fields.goal||row.goal,owner:fields.owner||fields.ownerName||row.owner,status:fields.status||row.status,done:fields.done||fields.doneLooksLike||row.done,completionDate:fields.completionDate||row.completionDate});
      } else if(actionName==='create_rocks'&&Array.isArray(fields.rocks)){
        fields.rocks.forEach((r,i)=>model.rocks.push({id:`demo-rock-${Date.now()}-${i}`,title:r.title||'Priority',description:r.description||'',owner:r.owner||'Agency Owner',dueDate:r.dueDate||'',status:r.status||'Not started',sourceType:'manual'}));
      } else if(actionName==='update_rock'){
        const rock=model.rocks.find(r=>r.id===fields.id);if(rock)Object.assign(rock,fields);
      } else if(actionName==='complete'){
        model.goalsComplete=true;model.goalsCompletedAt=new Date().toISOString();
      }
      cached=model;
      return {success:true,goals:model,demo:true};
    }
    try { await window.CCAccount?.ready; } catch {}
    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const selector = {};
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) Object.assign(selector, { admin:'1', tenant, accountId:tenant });
    }

    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...selector, action: actionName, ...fields })
    });
    cached = null;
    loadPromise = null;
    clearSession();
    return payload;
  }

  const saveTarget = (metricId, targetType, targetValue, targetNotes = '', targetDirection = 'increase') =>
    action('set_target', { metricId, targetType, targetValue, targetNotes, targetDirection });
  const saveTargets = targets => action('bulk_set_targets', { targets });

  const saveProgress = (metricId, actualValue, note = '') => action('save_progress', { metricId, actualValue, note });
  const saveDepartment = department => action('save_department', department);
  const createRocks = rocks => action('create_rocks', { rocks });
  const updateRock = rock => action('update_rock', rock);
  const saveCardLayout = (metricIds, departmentNames) => action('save_card_layout', { metricIds, departmentNames });
  const complete = () => action('complete');
  const clear = () => { cached = null; loadPromise = null; clearSession(); };

  window.CCGoals = { load, saveTarget, saveTargets, saveProgress, saveDepartment, createRocks, updateRock, saveCardLayout, complete, clear };
})();
) return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
    if (definition.unit === '%') return `${Number.isInteger(n)?n:n.toFixed(1)}%`;
    if (definition.unit === 'level') return `${Number.isInteger(n)?n:n.toFixed(1)} / 5`;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  async function loadScorecardFallback() {
    const response = await fetch('/api/scorecard', {
      cache:'no-store',
      credentials:'same-origin',
      headers:{Accept:'application/json'}
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.scorecard) {
      const error = new Error(payload.error || 'Agency Goals could not load the generated Scorecard.');
      error.status = response.status;
      error.code = payload.code || 'SCORECARD_FALLBACK_FAILED';
      throw error;
    }

    const scorecard = payload.scorecard || {};
    const report = scorecard && typeof scorecard === 'object' ? scorecard : {};
    const valuation = report.valuation && typeof report.valuation === 'object' ? report.valuation : {};
    const perf = report.reports?.performance || {};
    const accountRow = account() || {};
    const values = {
      sde: Number.isFinite(Number(valuation.adjustedSDE)) ? Number(valuation.adjustedSDE) : null,
      aofi: Number.isFinite(Number(report.score)) ? Number(report.score) : null,
      valuation: Number.isFinite(Number(valuation.enterpriseValue)) ? Number(valuation.enterpriseValue) : null
    };
    const metrics = FALLBACK_METRICS.map(definition => {
      const value = values[definition.id] ?? null;
      return {
        ...definition,
        available:value !== null,
        evidenceAvailable:value !== null,
        actualValue:value,
        actualDisplay:metricDisplay(definition,value),
        source:value !== null ? 'Generated Agency Scorecard' : 'Data not available',
        currentSourceType:value !== null ? 'scorecard' : null,
        actualUpdatedAt:report.generatedAt || null
      };
    });

    const departments = FALLBACK_DEPARTMENTS.map(name => ({
      name, goal:'', owner:'', status:'Needs Definition', done:'', completion:'', completionDate:'', suggestion:null
    }));

    const model = {
      fallback:true,
      account:{
        id:accountRow.id || payload.accountId || '',
        name:accountRow.name || '',
        email:accountRow.email || '',
        agencyName:accountRow.agency_name || accountRow.agencyName || '',
        accessPlan:accountRow.accessPlan || accountRow.access_plan || 'platform',
        journey:accountRow.journey || 'platform'
      },
      hasMonitorAccess:true,
      canManageTeam:false,
      memberCount:0,
      members:[],
      cardLayout:{metricIds:FALLBACK_METRICS.map(x=>x.id),departmentNames:[]},
      diagnosticRun:{id:payload.diagnosticRunId || '',status:'generated'},
      scorecard:{id:payload.scorecardId || '',aofiScore:values.aofi,generatedAt:report.generatedAt || null},
      metrics,targets:{},progress:{},progressHistory:{},departments,rocks:[],
      readiness:{
        targetCount:0,targetTotal:FALLBACK_METRICS.length,
        definedDepartmentCount:0,departmentTotal:departments.length,
        rockCount:0,
        evidenceGaps:metrics.filter(x=>!x.available).map(x=>({metricId:x.id,label:x.label,reason:'Data not available'})),
        partialDepartments:[],incompleteRocks:[],canComplete:false
      },
      goalsComplete:Boolean(accountRow.diagnostic_state?.goalsComplete),
      goalsCompletedAt:accountRow.diagnostic_state?.goalsCompletedAt || null
    };
    return model;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Agency Goals request failed.');
      error.status = response.status;
      error.code = payload.code;
      throw error;
    }
    return payload;
  }

  async function load(options = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      cached = window.CCDemo.goals;
      return cached;
    }
    if (cached && options.fresh !== true) return cached;

    try { await window.CCAccount?.ready; } catch {}
    const current = identity();

    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){cached=saved;return cached}
      if(loadPromise)return loadPromise;
    }

    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const params = new URLSearchParams();
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) {
        params.set('admin','1');
        params.set('tenant',tenant);
        params.set('accountId',tenant);
      }
    }

    // Normal workspace access is authorized entirely by the signed account
    // session cookie. Do not send localStorage account/email/url selectors:
    // member logins can differ from the agency owner identity and stale browser
    // values otherwise cause ACCOUNT_ACCESS_DENIED.
    const query = params.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;

    loadPromise = request(url).then(payload => {
      cached = payload.goals || null;
      writeSession(current,cached);
      return cached;
    }).finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function action(actionName, fields = {}) {
    if (window.CCDemo?.enabled && window.CCDemo?.goals) {
      const model = window.CCDemo.goals;
      if(actionName==='set_target'){
        model.targets[fields.metricId]={type:fields.targetType,value:Number(fields.targetValue),resolvedValue:Number(fields.targetValue),baselineValue:model.metrics.find(m=>m.id===fields.metricId)?.actualValue??null,notes:fields.targetNotes||''};
      } else if(actionName==='bulk_set_targets'&&Array.isArray(fields.targets)){
        fields.targets.forEach(t=>{model.targets[t.metricId]={type:t.targetType,value:Number(t.targetValue),resolvedValue:Number(t.targetValue),baselineValue:model.metrics.find(m=>m.id===t.metricId)?.actualValue??null,notes:t.targetNotes||''}});
      } else if(actionName==='save_progress'){
        const metric=model.metrics.find(m=>m.id===fields.metricId);if(metric){metric.actualValue=Number(fields.actualValue);metric.actualDisplay=String(fields.actualValue)}
      } else if(actionName==='save_department'){
        const row=model.departments.find(d=>d.name===fields.department);if(row)Object.assign(row,{goal:fields.goal||row.goal,owner:fields.owner||fields.ownerName||row.owner,status:fields.status||row.status,done:fields.done||fields.doneLooksLike||row.done,completionDate:fields.completionDate||row.completionDate});
      } else if(actionName==='create_rocks'&&Array.isArray(fields.rocks)){
        fields.rocks.forEach((r,i)=>model.rocks.push({id:`demo-rock-${Date.now()}-${i}`,title:r.title||'Priority',description:r.description||'',owner:r.owner||'Agency Owner',dueDate:r.dueDate||'',status:r.status||'Not started',sourceType:'manual'}));
      } else if(actionName==='update_rock'){
        const rock=model.rocks.find(r=>r.id===fields.id);if(rock)Object.assign(rock,fields);
      } else if(actionName==='complete'){
        model.goalsComplete=true;model.goalsCompletedAt=new Date().toISOString();
      }
      cached=model;
      return {success:true,goals:model,demo:true};
    }
    try { await window.CCAccount?.ready; } catch {}
    const pageParams = new URLSearchParams(location.search);
    const adminView =
      pageParams.get('admin') === '1' ||
      sessionStorage.getItem('cc_admin_mode') === '1';

    const selector = {};
    if (adminView) {
      const tenant = pageParams.get('tenant') || pageParams.get('accountId') || sessionStorage.getItem('cc_admin_tenant') || '';
      if (tenant) Object.assign(selector, { admin:'1', tenant, accountId:tenant });
    }

    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...selector, action: actionName, ...fields })
    });
    cached = null;
    loadPromise = null;
    clearSession();
    return payload;
  }

  const saveTarget = (metricId, targetType, targetValue, targetNotes = '', targetDirection = 'increase') =>
    action('set_target', { metricId, targetType, targetValue, targetNotes, targetDirection });
  const saveTargets = targets => action('bulk_set_targets', { targets });

  const saveProgress = (metricId, actualValue, note = '') => action('save_progress', { metricId, actualValue, note });
  const saveDepartment = department => action('save_department', department);
  const createRocks = rocks => action('create_rocks', { rocks });
  const updateRock = rock => action('update_rock', rock);
  const saveCardLayout = (metricIds, departmentNames) => action('save_card_layout', { metricIds, departmentNames });
  const complete = () => action('complete');
  const clear = () => { cached = null; loadPromise = null; clearSession(); };

  window.CCGoals = { load, saveTarget, saveTargets, saveProgress, saveDepartment, createRocks, updateRock, saveCardLayout, complete, clear };
})();
