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
    const key=current.accountId||current.email||current.agencyUrl||'';
    return key?`cc_goals_cache:${key}`:'';
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
    const current = requireIdentity();
    if(options.fresh!==true){
      const saved=readSession(current);
      if(saved){cached=saved;return cached}
      if(loadPromise)return loadPromise;
    }
    const params = new URLSearchParams();
    if (current.accountId) params.set('accountId', current.accountId);
    if (current.email) params.set('email', current.email);
    if (current.agencyUrl) params.set('agencyUrl', current.agencyUrl);
    loadPromise = request(`${API_BASE}?${params.toString()}`).then(payload => {
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
    const current = requireIdentity();
    const payload = await request(API_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...current, action: actionName, ...fields })
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
  const complete = () => action('complete');
  const clear = () => { cached = null; loadPromise = null; clearSession(); };

  window.CCGoals = { load, saveTarget, saveTargets, saveProgress, saveDepartment, createRocks, updateRock, complete, clear };
})();
