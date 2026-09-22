import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let PGlite;try{({PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite'));}catch{}
test('Connect migration: private tables, account uniqueness, atomic claims and mode separation',{skip:!PGlite},async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create table accounts(id uuid primary key);insert into accounts values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260922010000_agency_stripe_connect.sql',import.meta.url),'utf8'));
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const claim=async(id,live,stripe)=>(await db.query('select agency_stripe_claim($1,$2,$3,$4) r',[id,live,stripe,'Agency'])).rows[0].r;
  assert.equal((await claim(a,false,'acct_first')).status,'connected');
  assert.ok((await claim(a,false,'acct_other')).error);
  await assert.rejects(claim(b,false,'acct_first'),/unique/);
  assert.equal((await claim(a,true,'acct_live')).status,'connected');
  await db.query('update agency_stripe_connections set status=$1 where account_id=$2 and livemode=false',['disconnected',a]);
  assert.equal((await claim(a,false,'acct_new')).stripe_account_id,'acct_new');
  for(const table of ['agency_stripe_connections','agency_stripe_oauth_states','agency_stripe_operations']){
   assert.equal((await db.query('select relrowsecurity from pg_class where relname=$1',[table])).rows[0].relrowsecurity,true);
   assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',['authenticated',table,'SELECT'])).rows[0].allowed,false);
   assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed',['service_role',table,'SELECT'])).rows[0].allowed,true);
  }
  assert.equal((await db.query("select has_function_privilege('anon','agency_stripe_claim(uuid,boolean,text,text)','EXECUTE') allowed")).rows[0].allowed,false);
  await db.query('delete from accounts where id=$1',[a]);assert.equal((await db.query('select count(*)::int n from agency_stripe_connections')).rows[0].n,0);
 }finally{await db.close()}
});
