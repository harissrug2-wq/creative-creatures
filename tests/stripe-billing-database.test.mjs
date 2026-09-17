import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
let PGlite;try{({PGlite}=await import('@electric-sql/pglite'));}catch{}
test('atomic billing lifecycle and compatibility protection', {skip: !PGlite}, async()=>{
const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create role service_role;
create table accounts(id uuid primary key default gen_random_uuid(),name text,name_normalized text,email text,email_normalized text unique,agency_url text,agency_url_normalized text unique,agency_name text,journey text,access_plan text,source text,archetype_answers jsonb,archetype_result jsonb,report_data jsonb,diagnostic_state jsonb default '{}',password_hash text,password_reset_token_hash text,password_reset_expires_at timestamptz,updated_at timestamptz);
create table owner_archetype_leads(id uuid primary key default gen_random_uuid(),name text,name_normalized text,email text,email_normalized text,agency_url text,agency_url_normalized text,agency_name text,archetype_answers jsonb,archetype_result jsonb,report_data jsonb,converted_account_id uuid,converted_at timestamptz,payment_completed_at timestamptz,updated_at timestamptz);
insert into owner_archetype_leads(name,name_normalized,email,email_normalized,agency_url,agency_url_normalized,agency_name) values('Test Owner','test owner','owner@example.com','owner@example.com','example.com','example.com','Test');`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260917010000_stripe_billing.sql',import.meta.url),'utf8'));
const begin=await db.query(`select cc_stripe_begin('owner@example.com','platform',null) o`);const id=begin.rows[0].o.id;
const res=await db.query(`select cc_stripe_fulfill($1,'cs_test_paid','cus_test','sub_test','active','scrypt-test','hash-test') o`,[id]);const a=res.rows[0].o.account_id;
await db.query(`select cc_stripe_fulfill($1,'cs_test_paid','cus_test','sub_test','active','other-hash','other-reset')`,[id]);
assert.equal((await db.query('select count(*)::int n from accounts')).rows[0].n,1);
assert.equal((await db.query('select access_plan from accounts')).rows[0].access_plan,'platform');
await db.query(`select cc_stripe_subscription('sub_test','canceled',100)`);
assert.equal((await db.query('select access_plan from accounts')).rows[0].access_plan,'owner_archetype');
await db.query(`select cc_stripe_subscription('sub_test','active',99)`);
assert.equal((await db.query('select access_plan from accounts')).rows[0].access_plan,'owner_archetype');
console.log('SQL passed: migration, fulfillment, replay, cancellation and stale subscription event.');

// Older browser compatibility saves must not restore canceled subscription access.
await db.query(`update accounts set access_plan='fractional_coo',diagnostic_state='{"purchasedPlans":["fractional_coo"],"paymentComplete":true}' where id=$1`,[a]);
assert.equal((await db.query('select access_plan from accounts')).rows[0].access_plan,'owner_archetype');
assert.deepEqual((await db.query('select diagnostic_state from accounts')).rows[0].diagnostic_state.purchasedPlans,['owner_archetype']);
// An existing account requires an authenticated owner ID before another purchase.
assert.ok((await db.query(`select cc_stripe_begin('owner@example.com','diagnostic',null) o`)).rows[0].o.error);
const d=(await db.query(`select cc_stripe_begin('owner@example.com','diagnostic',$1) o`,[a])).rows[0].o;
const repeated=(await db.query(`select cc_stripe_begin('owner@example.com','diagnostic',$1) o`,[a])).rows[0].o;
assert.equal(d.id,repeated.id);
await db.query(`select cc_stripe_fulfill($1,'cs_diagnostic','cus_test','','','unused','unused')`,[d.id]);
assert.equal((await db.query('select access_plan from accounts')).rows[0].access_plan,'diagnostic');
assert.equal((await db.query('select password_hash from accounts')).rows[0].password_hash,'scrypt-test');

}finally{await db.close();}
});
