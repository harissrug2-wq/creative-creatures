import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const api=fs.readFileSync(new URL('../api/goals.js',import.meta.url),'utf8');
const createCode=api.slice(api.indexOf('function normalizeSourceKey('),api.indexOf('async function updateRock('));
function creator(existing=[],returned){
 const writes=[];
 const fn=vm.runInNewContext(createCode+';createRocks',{
  clean:v=>String(v??'').trim(),lower:v=>String(v??'').trim().toLowerCase(),
  getRocks:async(_config,id)=>{assert.equal(id,'account-a');return existing;},
  supabaseRequest:async(_config,path,options)=>{writes.push({path,...options});const records=JSON.parse(options.body);return returned??records;}
 });return {writes,run:items=>fn({},'account-a','scorecard-a',items)};
}
const issue={sourceKey:'issue:strength:systems',sourceType:'issue',title:'Systems',description:'Issue: undocumented\n\nOpportunity: document playbooks'};
test('issue and opportunity for one capability create one account-scoped Rock',async()=>{
 const c=creator();const r=await c.run([issue,{...issue,sourceType:'opportunity',sourceKey:'opportunity:strength:systems'}]);
 assert.equal(r.added,1);const rows=JSON.parse(c.writes[0].body);assert.equal(rows.length,1);assert.equal(rows[0].account_id,'account-a');assert.equal(rows[0].description,issue.description);assert.equal(rows[0].source_key,issue.sourceKey);
 assert.equal(c.writes[0].headers.Prefer,'resolution=ignore-duplicates,return=representation');
});
test('legacy issue or opportunity is preserved without another write',async()=>{
 for(const key of [issue.sourceKey,'opportunity:strength:systems']){const c=creator([{source_key:key,status:'Complete',owner_name:'Existing owner'}]);assert.equal((await c.run([issue])).added,0);assert.equal(c.writes.length,0);}
});
test('concurrent duplicate is not reported as added',async()=>{const c=creator([],[]);assert.equal((await c.run([issue])).added,0);});
test('same capability in different indexes stays distinct',async()=>{const c=creator();assert.equal((await c.run([issue,{...issue,sourceKey:'issue:performance:systems'}])).added,2);});
const ui=fs.readFileSync(new URL('../public/portal/scorecard.js',import.meta.url),'utf8');
const pairCode=ui.slice(ui.indexOf('  const capabilityKey ='),ui.indexOf('  const perf ='));
test('one checkbox pairs by capability and index, not array position',()=>{
 const issueSource=[{index:'strength',capability:'Systems',score:40,description:'Issue A'},{index:'performance',capability:'Systems',score:50,description:'Issue B'}];
 const opportunitySource=[{index:'performance',capability:'Systems',recommendation:'Action B'},{index:'strength',capability:'Systems',recommendation:'Action A'}];
 const rockCandidates={};const html=vm.runInNewContext(pairCode+';issueRows',{issueSource,opportunitySource,rockCandidates,existingRockKeys:new Set(['opportunity:strength:systems']),model:{reports:{}},esc:v=>String(v??'')});
 assert.equal((html.match(/type="checkbox"/g)||[]).length,2);assert.equal((html.match(/disabled/g)||[]).length,1);assert.match(rockCandidates['issue-0'].description,/Issue A[\s\S]*Action A/);assert.match(rockCandidates['issue-1'].description,/Issue B[\s\S]*Action B/);
});
