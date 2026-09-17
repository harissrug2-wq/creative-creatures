import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/owner-archetype-leads.js';
import { signSession } from '../lib/session-utils.js';
process.env.ADMIN_SESSION_SECRET='test-only-secret';
process.env.SUPABASE_URL='https://database.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-key';
const id='12345678-1234-1234-1234-123456789abc';
async function call(body,admin=true){
 const req={method:'DELETE',body,headers:admin?{cookie:`cc_admin_session=${signSession({role:'admin'},process.env.ADMIN_SESSION_SECRET,60)}`}:{}};
 const res={setHeader(){},end(v){this.body=JSON.parse(v)}};
 await handler(req,res);return res;
}
test('unauthenticated deletion never calls database',async()=>{
 global.fetch=()=>{throw new Error('unexpected database access')};
 assert.equal((await call({id,confirm:true},false)).statusCode,401);
});
test('confirmation and exact UUID required',async()=>{
 global.fetch=()=>{throw new Error('unexpected database access')};
 for(const body of [{id},{id:'account:'+id,confirm:true},{id:'*',confirm:true}])assert.equal((await call(body)).statusCode,422);
});
test('deletes only specified lead, never a paid account',async()=>{
 const calls=[];global.fetch=async(url,opts)=>{calls.push({url,opts});return{ok:true,text:async()=>JSON.stringify([{id}])}};
 const r=await call({id,confirm:true});assert.equal(r.statusCode,200);assert.equal(r.body.deleted,true);
 assert.equal(calls.length,1);assert.equal(calls[0].opts.method,'DELETE');
 assert.equal(calls[0].url,`https://database.invalid/rest/v1/owner_archetype_leads?id=eq.${id}&select=id`);
});
test('missing record returns 404, not false success',async()=>{
 global.fetch=async()=>({ok:true,text:async()=>'[]'});assert.equal((await call({id,confirm:true})).statusCode,404);
});
