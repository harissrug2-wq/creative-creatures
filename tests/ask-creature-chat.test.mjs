import test from 'node:test';
import assert from 'node:assert/strict';
import { readChat,sendChat,scope,generateAnswer } from '../lib/ask-creature-chat.js';
import { TOPICS,REFUSAL,pageTopic } from '../lib/ask-creature-knowledge.js';
const account={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',name:'Test agency'},owner={role:'owner'},member={role:'member',memberId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',departments:['sales']};
const id='cccccccc-cccc-cccc-cccc-cccccccccccc',rid='dddddddd-dddd-dddd-dddd-dddddddddddd';
const input={message:'Hi',conversationId:id,requestId:rid,messageCount:0,currentPath:'/leadership/'};
test('owner and member histories always carry both identity filters',async()=>{
 for(const actor of [owner,member]){const queries=[];await readChat(async path=>{queries.push(path);return[];},account,actor,{});assert.ok(queries[0].includes('account_id=eq.'+account.id));assert.ok(queries[0].includes(actor===owner?'member_id=is.null':'member_id=eq.'+member.memberId));}
 assert.throws(()=>scope(account,{role:'member'}),/Sign in/);
});
test('missing or foreign thread is not read',async()=>{let n=0;await assert.rejects(readChat(async()=>{n++;return[];},account,member,{conversationId:id}),/not found/);assert.equal(n,1);});
test('history pages remain ordered chronologically and can load older messages',async()=>{
 const rows=Array.from({length:51},(_,i)=>({id:String(i),role:'user',content:String(i)}));const r=await readChat(async p=>p.startsWith('ask_creature_conversations')?[{id,message_count:80}]:rows,account,owner,{conversationId:id,offset:'50'});assert.equal(r.messages.length,50);assert.equal(r.messages[0].content,'49');assert.equal(r.hasMore,true);assert.equal(r.nextOffset,100);
});
test('new greeting saves one atomic turn without AI or context/history reads',async()=>{
 const calls=[];const r=await sendChat(async(p,o)=>{calls.push(p);if(p.startsWith('rpc/')){const b=JSON.parse(o.body);assert.equal(b.p_member_id,null);assert.equal(b.p_conversation_id,id);return {conversationId:id,answer:b.p_answer,messageCount:2};}return[];},account,owner,input,{answer:()=>assert.fail('No AI')});assert.equal(r.messageCount,2);assert.equal(calls.length,3);
});
test('page FAQs differ and matching FAQ bypasses AI',async()=>{
 assert.notDeepEqual(TOPICS.leadership.faqs,TOPICS.integrations.faqs);assert.notEqual(TOPICS.sales.faqs[0].question,TOPICS.finance.faqs[0].question);assert.equal(pageTopic('/leadership/?tab=rocks'),'leadership');
 const q=TOPICS.leadership.faqs[0];let saved;
 await sendChat(async(p,o)=>{if(p.startsWith('rpc/')){saved=JSON.parse(o.body);return{};}return[];},account,owner,{...input,message:q.question},{answer:()=>assert.fail('No AI')});assert.equal(saved.p_answer,q.answer);
});
test('rate limit applies to greetings before save',async()=>{await assert.rejects(sendChat(async p=>p.startsWith('ask_creature_conversations')?[]:Array(20).fill({}),account,owner,input,{answer:()=>assert.fail()}),e=>e.status===429);});
test('save failure never reports a successful answer',async()=>{await assert.rejects(sendChat(async p=>{if(p.startsWith('rpc/'))throw Error('offline');return[];},account,owner,input),/could not be saved/);});
test('member answers do not load agency-wide diagnostic records',async()=>{
 await sendChat(async p=>{assert.ok(!p.startsWith('accounts?'));return p.startsWith('rpc/')?{}:[];},account,member,{...input,message:'Explain my report'},{answer:async c=>{assert.equal(c.diagnostic,undefined);assert.deepEqual(c.departments,['sales']);return 'Share the permitted result.';}});
});
test('retry returns persisted answer even with old message count and no second AI call',async()=>{
 const r=await sendChat(async p=>p.startsWith('ask_creature_conversations')?[{id,message_count:2}]:[{role:'user',content:'Hi'},{role:'assistant',content:'Saved answer'}],account,owner,input,{answer:()=>assert.fail()});assert.equal(r.answer,'Saved answer');assert.equal(r.messageCount,2);
});
test('stale tab must reopen thread before appending',async()=>{await assert.rejects(sendChat(async p=>p.startsWith('ask_creature_conversations')?[{id,message_count:8}]:[],account,owner,input),e=>e.status===409);});
test('structured off-topic reply is replaced with fixed scope response',async()=>{
 process.env.OPENAI_API_KEY='test';const result=await generateAnswer({},[],'Write a football poem',async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.text.format.strict,true);assert.ok(body.instructions.includes('Unrelated trivia'));return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({in_scope:false,answer:'This must never be displayed'})}]}]})};});assert.equal(result,REFUSAL);
});
test('malformed model output fails closed',async()=>{await assert.rejects(generateAnswer({},[],'hello',async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'not json'}]}]})})),/incomplete/);});
