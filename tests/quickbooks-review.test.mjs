import test from 'node:test';
import assert from 'node:assert/strict';
import {quickBooksApiRequest,refreshQuickBooksTokens,withQuickBooksRecovery,createQuickBooksAuthorizationUrl,verifyQuickBooksOAuthState,quickBooksConfig} from '../lib/quickbooks.js';
import financial from '../api/financial-evidence.js';
import diagnostic from '../api/diagnostic-state.js';
import accounts from '../api/accounts.js';
import {signSession} from '../lib/session-utils.js';
Object.assign(process.env,{ACCOUNT_SESSION_SECRET:'test-only',SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',QUICKBOOKS_CLIENT_ID:'client-test',QUICKBOOKS_CLIENT_SECRET:'secret-test',QUICKBOOKS_REDIRECT_URI:'https://example.invalid/callback',QUICKBOOKS_ENVIRONMENT:'production'});
async function mocked(fetcher,run){const old=globalThis.fetch,log=console.error;globalThis.fetch=fetcher;console.error=()=>{};try{return await run();}finally{globalThis.fetch=old;console.error=log;}}
test('401 refreshes once and retries using the renewed token',async()=>{let refreshes=0;const seen=[];const result=await withQuickBooksRecovery('old',async()=>{refreshes++;return 'new';},async access=>{seen.push(access);if(access==='old')throw Object.assign(new Error(),{status:401});return 'ok';});assert.equal(result,'ok');assert.equal(refreshes,1);assert.deepEqual(seen,['old','new']);});
test('a second 401 requires reconnection without an infinite retry',async()=>{let count=0;await assert.rejects(withQuickBooksRecovery('old',async()=>'new',async()=>{count++;throw Object.assign(new Error(),{status:401});}),{code:'QUICKBOOKS_RECONNECT_REQUIRED'});assert.equal(count,2);});
test('validation failures do not refresh credentials',async()=>{let refreshed=false;await assert.rejects(withQuickBooksRecovery('old',async()=>{refreshed=true;},async()=>{throw Object.assign(new Error(),{status:400});}),{status:400});assert.equal(refreshed,false);});
test('provider errors capture intuit_tid without sensitive payloads',async()=>mocked(async()=>new Response(JSON.stringify({Fault:{Error:[{code:'2010',Detail:'PRIVATE FINANCIAL DATA'}]}}),{status:400,headers:{intuit_tid:'trace-123'}}),async()=>{await assert.rejects(quickBooksApiRequest({realmId:'r',accessToken:'secret',path:'reports/ProfitAndLoss'}),e=>e.intuitTid==='trace-123'&&e.code==='2010'&&!JSON.stringify(e).includes('PRIVATE')&&!e.message.includes('PRIVATE')&&!e.payload);}));
test('invalid grant is preserved but provider descriptions are not disclosed',async()=>mocked(async()=>new Response(JSON.stringify({error:'invalid_grant',error_description:'SENSITIVE'}),{status:400}),async()=>{await assert.rejects(refreshQuickBooksTokens('refresh-secret'),e=>e.code==='invalid_grant'&&!e.message.includes('SENSITIVE'));}));
test('malformed successful report is rejected rather than scored',async()=>mocked(async()=>new Response('not json',{status:200}),async()=>{await assert.rejects(quickBooksApiRequest({realmId:'r',accessToken:'t',path:'reports/ProfitAndLoss'}),{status:502});}));

test('production QuickBooks always uses the Creative Creatures canonical callback',()=>{
  process.env.QUICKBOOKS_ENVIRONMENT='production';
  process.env.QUICKBOOKS_REDIRECT_URI='https://wrong.example/callback';
  assert.equal(quickBooksConfig().redirectUri,'https://app.creativecreatures.org/integrations/quickbooks/callback/');
  assert.equal(new URL(createQuickBooksAuthorizationUrl('a')).searchParams.get('redirect_uri'),'https://app.creativecreatures.org/integrations/quickbooks/callback/');
});
test('OAuth state is bound to its agency and rejects tampering',()=>{const state=new URL(createQuickBooksAuthorizationUrl('a')).searchParams.get('state');assert.equal(verifyQuickBooksOAuthState(state,'a'),true);assert.equal(verifyQuickBooksOAuthState(state,'b'),false);assert.equal(verifyQuickBooksOAuthState(state+'x','a'),false);});
const cookie=(extra={})=>'cc_account_session='+signSession({role:'account',accountId:'a',...extra},process.env.ACCOUNT_SESSION_SECRET);
async function invoke(handler,{method='POST',headers={},body={},query={}}={}){const res={setHeader(){},end(raw){this.data=JSON.parse(raw);}};await handler({method,headers,body,query},res);return res;}
for(const [name,handler] of [['financial evidence',financial],['diagnostic state',diagnostic]]){
 test(`${name}: anonymous requests cannot reach database`,async()=>mocked(async()=>{assert.fail('database accessed');},async()=>assert.equal((await invoke(handler)).statusCode,401)));
 test(`${name}: another account ID is rejected`,async()=>mocked(async()=>{assert.fail('database accessed');},async()=>assert.equal((await invoke(handler,{headers:{cookie:cookie()},body:{accountId:'b'}})).statusCode,403)));
 test(`${name}: cross-site requests are rejected`,async()=>mocked(async()=>{assert.fail('database accessed');},async()=>assert.equal((await invoke(handler,{headers:{cookie:cookie(),'sec-fetch-site':'cross-site'}})).statusCode,403)));
}
test('public lookup excludes stored report and diagnostic data',async()=>mocked(async()=>new Response(JSON.stringify([{id:'a',email:'a@example.invalid',report_data:{secret:'private'},diagnostic_state:{secret:'private'}}])),async()=>{const res=await invoke(accounts,{method:'GET',query:{email:'a@example.invalid'}});assert.equal(res.statusCode,200);assert.equal(res.data.account.report_data,undefined);assert.equal(res.data.account.diagnostic_state,undefined);}));
test('financial evidence owner read is scoped to signed account, ignoring foreign email',async()=>{const urls=[];await mocked(async url=>{const u=new URL(url);urls.push(u);let data=[];if(u.pathname.endsWith('/accounts'))data=[{id:'a',email:'a@example.invalid'}];if(u.pathname.endsWith('/diagnostic_runs'))data=[{id:'run-a',account_id:'a'}];return new Response(JSON.stringify(data));},async()=>{const res=await invoke(financial,{method:'GET',headers:{cookie:cookie()},query:{email:'foreign@example.invalid'}});assert.equal(res.statusCode,200);assert.ok(urls.filter(u=>u.pathname.endsWith('/accounts')).every(u=>u.searchParams.get('id')==='eq.a'));assert.ok(urls.some(u=>u.pathname.endsWith('/financial_evidence')&&u.searchParams.get('diagnostic_run_id')==='eq.run-a'));});});

test('public account updates require authentication for existing accounts',async()=>mocked(async()=>new Response(JSON.stringify([{id:'a'}])),async()=>{const res=await invoke(accounts,{body:{name:'Changed',email:'a@example.invalid',agencyUrl:'https://agency.invalid'}});assert.equal(res.statusCode,401);}));
test('account PATCH rejects a foreign agency',async()=>mocked(async()=>{assert.fail('database accessed');},async()=>{assert.equal((await invoke(accounts,{method:'PATCH',headers:{cookie:cookie()},body:{id:'b',reportData:{}}})).statusCode,403);}));

test('sync persists reconnect state when a refresh grant is rejected',async()=>{
 const {default:handler}=await import('../api/account-auth.js');
 const {encryptQuickBooksToken}=await import('../lib/quickbooks.js');
 const patches=[];
 const row={id:'qb-a',account_id:'a',realm_id:'realm',status:'connected',access_token_expires_at:'2020-01-01',refresh_token_encrypted:encryptQuickBooksToken('refresh','test-only')};
 await mocked(async(url,options={})=>{
  const u=new URL(url);
  if(u.hostname==='oauth.platform.intuit.com')return new Response(JSON.stringify({error:'invalid_grant'}),{status:400});
  if(u.pathname.endsWith('/accounts'))return new Response(JSON.stringify([{id:'a',journey:'diagnostic',access_plan:'diagnostic',diagnostic_state:{}}]));
  if(u.pathname.endsWith('/quickbooks_connections')){if(options.method==='PATCH')patches.push(JSON.parse(options.body));return new Response(JSON.stringify([row]));}
  throw new Error('Unexpected request '+u.pathname);
 },async()=>{
  const res=await invoke(handler,{headers:{cookie:cookie()},body:{action:'quickbooks_sync'}});
  assert.equal(res.statusCode,401);assert.equal(res.data.code,'QUICKBOOKS_RECONNECT_REQUIRED');assert.equal(patches[0].status,'error');assert.match(patches[0].last_sync_error,/Reconnect QuickBooks/);
 });
});
