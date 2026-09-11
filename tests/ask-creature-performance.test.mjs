import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/account-auth.js';
import { signSession } from '../lib/session-utils.js';
import { boundedCreatureHistory, compactCreatureData, workspaceAccount } from '../lib/ask-creature-performance.js';
process.env.SUPABASE_URL='https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
process.env.ACCOUNT_SESSION_SECRET='test-session-secret';
process.env.OPENAI_API_KEY='test-openai-key';
const originalFetch=globalThis.fetch;
const originalInfo=console.info;
const originalError=console.error;
test.after(()=>{globalThis.fetch=originalFetch;console.info=originalInfo;console.error=originalError});
console.info=()=>{};console.error=()=>{};
let calls=[],modelBody,savedRows,plan='platform',purchased=[],completed=false,memberStatus='active',limit=0,failSave=false;
function reset(){calls=[];modelBody=null;savedRows=null;plan='platform';purchased=[];completed=false;memberStatus='active';limit=0;failSave=false}
globalThis.fetch=async(url,options={})=>{
 const u=new URL(url);calls.push({u,options});
 if(u.host==='api.openai.com'){
   modelBody=JSON.parse(options.body);
   return Response.json({output:[{content:[{type:'output_text',text:'Test answer'}]}]});
 }
 if(u.pathname.endsWith('/accounts')){
   const select=u.searchParams.get('select');
   assert.ok(!select.includes('password_hash'));
   if(select==='diagnostic_state,report_data')return Response.json([{diagnostic_state:{large:'x'.repeat(30000)},report_data:{summary:'y'.repeat(30000)}}]);
   assert.ok(select.includes('purchased_plans:diagnostic_state->purchasedPlans'));
   assert.ok(select.includes('accelerator_completed:diagnostic_state->acceleratorCompleted'));
   return Response.json([{id:'account-a',name:'Owner',email:'owner@example.invalid',agency_name:'Agency',journey:'diagnostic',access_plan:plan,purchased_plans:purchased,accelerator_completed:completed}]);
 }
 if(u.pathname.endsWith('/account_members'))return Response.json([{id:'member-a',account_id:'account-a',name:'Member',email:'member@example.invalid',departments:['sales'],status:memberStatus}]);
 if(u.pathname.endsWith('/ask_creature_messages')){
   assert.equal(u.searchParams.get('account_id')||'eq.account-a','eq.account-a');
   if(options.method==='POST'){
     savedRows=JSON.parse(options.body);
     if(failSave)return Response.json({message:'Test persistence failure'},{status:503});
     return new Response(null,{status:201});
   }
   if(u.searchParams.get('role')==='eq.user'){
     assert.equal(u.searchParams.get('limit'),'20');
     return Response.json(Array.from({length:limit},(_,i)=>({id:i})));
   }
   assert.equal(u.searchParams.get('order'),'created_at.desc,id.desc');
   const n=Number(u.searchParams.get('limit'));
   return Response.json(Array.from({length:n},(_,i)=>({role:i%2?'user':'assistant',content:`message ${100-i}`,created_at:new Date(1700000000000-i*1000).toISOString()})));
 }
 throw Error(`Unexpected request: ${u.pathname}`);
};
async function call(action,{message='hello',member=false,authenticated=true,method='GET'}={}){
 const cookie=authenticated?'cc_account_session='+signSession({role:'account',accountId:'account-a',...(member?{memberId:'member-a'}:{})},process.env.ACCOUNT_SESSION_SECRET):'';
 const headers={};let result;
 const res={setHeader(k,v){headers[k]=v},end(raw){result=JSON.parse(raw)},statusCode:0};
 await handler({method,headers:{cookie},query:method==='GET'?{action}:{},body:{action,message,currentPath:'/platform/'}},res);
 return{status:res.statusCode,result,headers};
}

test('purchased plans and completed Accelerator retain feature access',async()=>{
 reset();plan='owner_archetype';purchased=['platform'];let r=await call('workspace_access');
 assert.equal(r.status,200);assert.ok(r.result.access.features.includes('leadership'));assert.ok(r.result.access.features.includes('users'));
 assert.equal('diagnostic_state' in r.result.account,false);
 assert.match(r.headers['Server-Timing'],/account;dur=/);
 reset();plan='accelerator';completed=true;r=await call('workspace_access');assert.ok(r.result.access.features.includes('integrations'));
 reset();plan='accelerator';r=await call('workspace_access');assert.equal(r.result.access.features.includes('integrations'),false);
});
test('greeting is authenticated, rate limited, and saved without calling AI or loading history/context',async()=>{
 reset();const r=await call('ask_creature',{method:'POST'});assert.equal(r.status,200);assert.match(r.result.answer,/Hello/);
 assert.equal(modelBody,null);assert.equal(calls.length,3);assert.equal(savedRows.length,2);
 assert.ok(savedRows[0].created_at<savedRows[1].created_at);
 assert.match(r.headers['Server-Timing'],/save;dur=/);
 reset();const denied=await call('ask_creature',{method:'POST',authenticated:false});assert.equal(denied.status,401);assert.equal(calls.length,0);
 reset();plan='owner_archetype';assert.equal((await call('ask_creature',{method:'POST'})).status,403);assert.equal(savedRows,null);
 reset();limit=20;assert.equal((await call('ask_creature',{method:'POST'})).status,429);assert.equal(savedRows,null);
});
test('normal question uses bounded context and persists result',async()=>{
 reset();const r=await call('ask_creature',{method:'POST',message:'What should our agency focus on?'});assert.equal(r.status,200);
 assert.ok(modelBody);const contextText=modelBody.input.at(-1).content;
 assert.ok(contextText.length<13000);assert.ok(modelBody.input.length<=13);assert.equal(savedRows[1].content,'Test answer');
 assert.match(r.headers['Server-Timing'],/openai;dur=/);
});
test('member remains isolated; disabled member cannot use chat',async()=>{
 reset();assert.equal((await call('ask_creature',{method:'POST',member:true,message:'Help me with sales'})).status,200);
 assert.equal(calls.filter(c=>c.u.pathname.endsWith('/accounts')).length,1);
 for(const c of calls.filter(c=>c.u.pathname.endsWith('/ask_creature_messages')&&c.options.method!=='POST'))assert.equal(c.u.searchParams.get('member_id'),'eq.member-a');
 assert.equal(savedRows[0].member_id,'member-a');assert.doesNotMatch(modelBody.input.at(-1).content,/"diagnostic"|"report"/);
 reset();memberStatus='disabled';assert.equal((await call('ask_creature',{method:'POST',member:true})).status,401);assert.equal(savedRows,null);
});
test('drawer receives newest 50 messages chronologically',async()=>{
 reset();const r=await call('ask_creature_history');assert.equal(r.status,200);assert.equal(r.result.messages.length,50);
 assert.equal(r.result.messages[0].content,'message 51');assert.equal(r.result.messages.at(-1).content,'message 100');
});
test('save failure cannot be reported as a successful answer',async()=>{
 reset();failSave=true;const r=await call('ask_creature',{method:'POST'});assert.equal(r.status,503);assert.equal(r.result.success,undefined);assert.match(r.headers['Server-Timing'],/save;dur=/);
});
test('context limits handle large/deep objects and keep JSON valid',()=>{
 for(const v of [{a:'x'.repeat(100000)},Array.from({length:1000},()=>({a:'\\"'.repeat(1000)})),{a:{b:{c:{d:{e:{f:{g:'nested'}}}}}}}]){
   const result=JSON.stringify(compactCreatureData(v,6000));assert.ok(result.length<=6000);JSON.parse(result);
 }
 assert.equal(workspaceAccount(null),null);
 assert.equal(workspaceAccount({accelerator_completed:'true'}).diagnostic_state.acceleratorCompleted,false);
 const history=boundedCreatureHistory([{role:'assistant',content:'new'},{role:'user',content:'older'},{role:'assistant',content:'too long'}],8);
 assert.deepEqual(history.map(x=>x.content),['older','new']);
});
