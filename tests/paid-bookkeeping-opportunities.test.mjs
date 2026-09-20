import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const auth=read('api/account-auth.js');
const ctx=vm.createContext({});
vm.runInContext(auth.slice(auth.indexOf('const PLAN_FEATURES='),auth.indexOf('function publicMember'))+auth.slice(auth.indexOf('function integrationFeature('),auth.indexOf('function publicAccess(')),ctx);
test('all paid plans permit bookkeeping; free plans do not',()=>{
 for(const plan of ['diagnostic','accelerator','platform','fractional_coo'])assert.doesNotThrow(()=>ctx.requireFeature({access_plan:plan},'bookkeeping'));
 assert.throws(()=>ctx.requireFeature({access_plan:'owner_archetype'},'bookkeeping'),/not included/);
 for(const plan of ['diagnostic','accelerator'])assert.throws(()=>ctx.requireFeature({access_plan:plan},'integrations'),/not included/);
});
test('bookkeeping lifecycle uses narrow feature and unrelated actions retain their restriction',()=>{
 for(const provider of ['quickbooks','freshbooks'])for(const action of ['connect','status','callback','sync','disconnect'])assert.equal(ctx.integrationFeature(`${provider}_${action}`),'bookkeeping');
 for(const action of ['jira_connect','freshbooks_save_client','freshbooks_archive_client','quickbooks_unknown'])assert.equal(ctx.integrationFeature(action),'integrations');
 assert.ok(auth.includes('integrationFeature(action)'));
 assert.ok(auth.includes('integrationFeature(bodyAction)'));
});
const html=read('account/upgrade/index.html');
async function upgrade(access){
 const elements={};const document={querySelector:key=>elements[key]||=( {})};
 vm.runInNewContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],{window:{CCWorkspace:{getAccess:()=>Promise.resolve(access)}},document});
 await new Promise(resolve=>setImmediate(resolve));return elements['#upgradeGrid'].innerHTML;
}
test('diagnostic and accelerator exclude each other using full purchase history',async()=>{
 const owner={role:'owner'};
 let output=await upgrade({plan:'diagnostic',actor:owner,features:[]});
 assert.ok(!output.includes('plan=accelerator'));assert.ok(output.includes('plan=platform'));
 output=await upgrade({plan:'accelerator',actor:owner,features:[]});assert.ok(!output.includes('plan=diagnostic'));
 output=await upgrade({plan:'platform',purchasedPlans:['diagnostic'],actor:owner,features:[]});assert.ok(!output.includes('plan=accelerator'));
});
const score=read('api/scorecard.js');
function model(scores){
 const context=vm.createContext({clamp:v=>Number(v),finiteOrNull:v=>Number.isFinite(v)?v:null,UI_VALIDATION:{},normalizeValidation:()=>'',worstValidation:()=>'',buildValuationSnapshot:()=>({}),withValuationReportData:m=>m});
 vm.runInContext(score.slice(score.indexOf('const strengthCategoryNames'),score.indexOf('function ownerArchetype')),context);
 vm.runInContext(score.slice(score.indexOf('function scorecardPriorities'),score.indexOf('function buildModel')),context);
 const start=score.indexOf('  const reports =',score.indexOf('function buildModel'));
 const end=score.indexOf('  const valuation =',start);
 context.map=Object.fromEntries(Object.entries(scores).map(([id,categories])=>[id,{index_type:id,score:60,category_scores:categories}]));
 vm.runInContext('(()=>{'+score.slice(start,end)+';globalThis.output={issues,opportunities};})();',context);return context.output;
}
test('different stored scores change issues and each opportunity matches its own category',()=>{
 const a=model({performance:{cash:10,profitability:20,capital:30},strength:{people:40},independence:{decision:50}});
 assert.equal(a.issues[0].capability,'Cash Performance');
 assert.match(a.opportunities[0].recommendation,/cash reserves/);
 assert.match(a.opportunities[1].recommendation,/gross margin/);
 const b=model({performance:{cash:90,profitability:80,capital:70},strength:{people:5},independence:{decision:10}});
 assert.equal(b.issues[0].capability,'People Infrastructure');assert.match(b.opportunities[0].recommendation,/hiring/);
 const empty=model({performance:{},strength:{},independence:{}});assert.equal(empty.issues.length,0);
});
const ui=read('public/performance/performance.js');
test('provider buttons only show configured bookkeeping providers and use local logos',()=>{
 const context=vm.createContext({});
 const start=ui.indexOf('  const bookkeepingProviders');const end=ui.indexOf('  const host=',start);
 vm.runInContext(ui.slice(start,end)+";bookkeepingStatus={quickbooks:{available:true},freshbooks:{available:false}};globalThis.buttons=bookkeepingButtons();",context);
 assert.match(context.buttons,/logos\/quickbooks.svg/);assert.ok(!context.buttons.includes('freshbooks'));
 assert.ok(!ui.includes('showBookkeepingModal'));assert.ok(ui.includes('location.assign(payload.authorizationUrl)'));
});

test('OAuth callbacks return Performance users to Performance and reject arbitrary return URLs',async()=>{
 for(const provider of ['quickbooks','freshbooks'])for(const stored of ['/agency-performance-index/','https://example.com/']){
  let destination='';const elements={};
  const code=read(`integrations/${provider}/callback/index.html`).match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(code,{URLSearchParams,sessionStorage:{getItem:()=>stored,removeItem:()=>{}},location:{search:'?code=test&state=test&realmId=test',replace:v=>destination=v},document:{querySelector:k=>elements[k]||={style:{},classList:{add:()=>{}}}},fetch:async()=>({ok:true,json:async()=>({})})});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(destination,(stored==='/agency-performance-index/'?stored:'/integrations/')+`?${provider}=connected`);
 }
});
