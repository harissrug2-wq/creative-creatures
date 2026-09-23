import test from 'node:test';
import assert from 'node:assert/strict';
import {generateAnswer,sendChat} from '../lib/ask-creature-chat.js';
import {REFUSAL} from '../lib/ask-creature-knowledge.js';
process.env.OPENAI_API_KEY='test-only';
const completed=(answer='Your diagnostic results show the next priorities.')=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({in_scope:true,answer})}]}]});
const response=p=>({ok:true,json:async()=>p});
test('token exhaustion retries once with larger budget and same deadline',async()=>{
 const calls=[];const result=await generateAnswer({},[],'my diagnostic?',async(_,opts)=>{calls.push(opts);return response(calls.length===1?{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]}:completed());});
 assert.match(result,/diagnostic/);assert.equal(calls.length,2);assert.equal(calls[0].signal,calls[1].signal);
 assert.deepEqual(calls.map(c=>JSON.parse(c.body).max_output_tokens),[4000,8000]);
 assert.equal(JSON.parse(calls[0].body).reasoning.effort,'low');
});
test('incomplete output is rejected even if its JSON looks valid',async()=>{
 let calls=0;await assert.rejects(generateAnswer({},[],'my report',async()=>{calls++;return response({...completed('partial'),status:'incomplete',incomplete_details:{reason:'max_output_tokens'}});}),/could not finish/);assert.equal(calls,2);
});
test('content filter is not retried and refusal does not expose provider text',async()=>{
 let calls=0;await assert.rejects(generateAnswer({},[],'question',async()=>{calls++;return response({status:'incomplete',incomplete_details:{reason:'content_filter'}});}),/could not finish/);assert.equal(calls,1);
 assert.equal(await generateAnswer({},[],'question',async()=>response({status:'completed',output:[{content:[{type:'refusal',refusal:'provider text'}]}]})),REFUSAL);
});
test('invalid JSON and null fail closed; provider failure is not retried',async()=>{
 for(const text of ['{','null','[]'])await assert.rejects(generateAnswer({},[],'question',async()=>response({status:'completed',output:[{content:[{type:'output_text',text}]}]})),e=>e.status===502);
 let calls=0;await assert.rejects(generateAnswer({},[],'question',async()=>{calls++;return {ok:false,json:async()=>({error:{message:'private'}})};}),/could not respond/);assert.equal(calls,1);
});
test('failed generation never saves a conversation turn',async()=>{
 const paths=[];await assert.rejects(sendChat(async p=>{paths.push(p);return[];},{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},{role:'owner'},{message:'my diagnostic?',conversationId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',requestId:'cccccccc-cccc-cccc-cccc-cccccccccccc',messageCount:0,currentPath:'/diagnostic/'},{answer:async()=>{throw new Error('provider incomplete');}}),/provider incomplete/);assert.ok(paths.every(p=>!p.startsWith('rpc/')));
});

test('sendChat supplies authorized connected integration data to the answer generator',async()=>{
 const captured=[];const account={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',agency_name:'Example Agency'};
 const actor={role:'owner',departments:['leadership']};
 const db=async(path,options)=>{
  if(path.startsWith('ask_creature_conversations'))return[];
  if(path.startsWith('ask_creature_messages'))return[];
  if(path.startsWith('accounts?'))return[];
  if(path==='rpc/cc_ask_save_turn')return{conversationId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',answer:'You have one meeting today.',messageCount:2};
  return[];
 };
 const liveContext={retrievedAt:'2026-09-23T12:00:00.000Z',sources:{googleCalendar:{connected:true,events:[{summary:'Client call',start:{dateTime:'2026-09-23T14:00:00Z'}}]}}};
 const result=await sendChat(db,account,actor,{message:'Do I have meetings today?',conversationId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',requestId:'cccccccc-cccc-cccc-cccc-cccccccccccc',messageCount:0,currentPath:'/integrations/'},{liveContext,answer:async(context)=>{captured.push(context);return'You have one meeting today.';}});
 assert.equal(result.answer,'You have one meeting today.');
 assert.equal(captured[0].connectedData.sources.googleCalendar.connected,true);
 assert.equal(captured[0].connectedData.sources.googleCalendar.events[0].summary,'Client call');
});
