import { boundedCreatureHistory,compactCreatureData,isCreatureGreeting } from './ask-creature-performance.js';
import { TOPICS,pageTopic,instructions,REFUSAL } from './ask-creature-knowledge.js';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v||'');
export function scope(account,actor){
 if(!account?.id||!['owner','member'].includes(actor?.role)||actor.role==='member'&&!actor.memberId)throw fail(401,'Sign in to use Ask Creature.');
 return `account_id=eq.${encodeURIComponent(account.id)}&member_id=${actor.role==='member'?`eq.${encodeURIComponent(actor.memberId)}`:'is.null'}`;
}
const offsetOf=v=>Math.max(0,Math.min(1000000,Number.parseInt(v,10)||0));
async function thread(db,account,actor,id){
 if(!uuid(id))throw fail(422,'Invalid conversation.');
 return (await db(`ask_creature_conversations?select=*&id=eq.${id}&${scope(account,actor)}&limit=1`))?.[0]||null;
}
export async function readChat(db,account,actor,query){
 const s=scope(account,actor),offset=offsetOf(query.offset);
 if(query.action==='ask_creature_faqs'){
  const topic=pageTopic(query.path);return {topic:TOPICS[topic].title,questions:TOPICS[topic].faqs.map(f=>f.question)};
 }
 if(!query.conversationId){
  const rows=await db(`ask_creature_conversations?select=id,title,page_path,updated_at,message_count&${s}&order=updated_at.desc,id.desc&limit=31&offset=${offset}`);
  return {conversations:(rows||[]).slice(0,30),hasMore:(rows||[]).length>30,nextOffset:offset+30};
 }
 const t=await thread(db,account,actor,query.conversationId);if(!t)throw fail(404,'Conversation not found.');
 const rows=await db(`ask_creature_messages?select=id,role,content,created_at&conversation_id=eq.${t.id}&${s}&order=created_at.desc,id.desc&limit=51&offset=${offset}`);
 return {conversationId:t.id,title:t.title,messageCount:t.message_count,messages:(rows||[]).slice(0,50).reverse(),hasMore:(rows||[]).length>50,nextOffset:offset+50};
}
export async function generateAnswer(context,history,message,fetcher=fetch){
 const key=String(process.env.OPENAI_API_KEY||'').trim();if(!key)throw fail(503,'Ask Creature is not configured.');
 const model=process.env.OPENAI_MODEL||'gpt-5-mini';
 const request={
  model,instructions:instructions()+' Keep answers concise, usually under 250 words.',
  ...(/^(gpt-5(?:$|-|\.)|o[134](?:$|-))/.test(model)?{reasoning:{effort:'low'}}:{}),
  input:[...boundedCreatureHistory(history),{role:'user',content:JSON.stringify({context,question:message})}],
  text:{format:{type:'json_schema',name:'creature_answer',strict:true,schema:{type:'object',properties:{in_scope:{type:'boolean'},answer:{type:'string'}},required:['in_scope','answer'],additionalProperties:false}}}
 };
 // Both attempts share one deadline. Never display or persist truncated output.
 const signal=AbortSignal.timeout(45000);
 let result;
 for(let attempt=0;attempt<2;attempt++){
  let r;
  try{r=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal,body:JSON.stringify({...request,max_output_tokens:attempt?8000:4000})});}
  catch{throw fail(502,'Ask Creature could not finish responding. Please retry.');}
  const p=await r.json().catch(()=>null);
  if(!r.ok)throw fail(502,'Ask Creature could not respond. Please retry.');
  if(p?.status==='incomplete'){
   if(attempt===0&&p.incomplete_details?.reason==='max_output_tokens')continue;
   throw fail(502,'Ask Creature could not finish responding. Please retry with a more specific question.');
  }
  if(p?.status&&p.status!=='completed')throw fail(502,'Ask Creature could not respond. Please retry.');
  const parts=(p?.output||[]).flatMap(o=>o.content||[]);
  if(parts.some(c=>c.type==='refusal'))return REFUSAL;
  const text=parts.filter(c=>c.type==='output_text').map(c=>c.text).join('');
  try{result=JSON.parse(text);}catch{throw fail(502,'Ask Creature returned an incomplete answer. Please retry.');}
  if(!result||Array.isArray(result)||typeof result!=='object')throw fail(502,'Ask Creature returned an invalid answer.');
  break;
 }
 if(result.in_scope===false)return REFUSAL;
 if(result.in_scope!==true||typeof result.answer!=='string'||!result.answer.trim()||result.answer.length>12000)throw fail(502,'Ask Creature returned an invalid answer.');
 return result.answer.trim();
}
export async function sendChat(db,account,actor,input,{answer=generateAnswer}={}){
 const s=scope(account,actor),message=String(input.message||'').trim();
 if(!message||message.length>4000)throw fail(422,'Enter a question up to 4,000 characters.');
 const id=input.conversationId,requestId=input.requestId;
 if(!uuid(id)||!uuid(requestId))throw fail(422,'Refresh the page to start a new chat.');
 const t=await thread(db,account,actor,id);
 // A filtered lookup cannot reveal another account's thread; the save RPC also checks ownership.
 const expected=Number(input.messageCount);
 if(t){const old=await db(`ask_creature_messages?select=role,content&conversation_id=eq.${id}&request_id=eq.${requestId}&${s}`);const saved=old?.find(m=>m.role==='assistant');if(saved){if(old.find(m=>m.role==='user')?.content!==message)throw fail(409,'Start a new request for a different question.');return {conversationId:id,answer:saved.content,messageCount:t.message_count};}}
 if(!Number.isInteger(expected)||expected<0||expected!==(t?.message_count||0))throw fail(409,'This chat changed. Open it from History before sending again.');
 const since=new Date(Date.now()-600000).toISOString();
 const recent=await db(`ask_creature_messages?select=id&${s}&role=eq.user&created_at=gte.${encodeURIComponent(since)}&limit=20`);
 if((recent||[]).length>=20)throw fail(429,'You have reached the short-term message limit. Try again in a few minutes.');
 const topic=pageTopic(input.currentPath),faq=TOPICS[topic].faqs.find(f=>f.question===message);
 let response=isCreatureGreeting(message)?'Hello! I’m Ask Creature. Ask me about Creative Creatures or choose a question for this page.':faq?.answer;
 if(!response){
  const history=t?await db(`ask_creature_messages?select=role,content,created_at&conversation_id=eq.${id}&${s}&order=created_at.desc,id.desc&limit=12`):[];
  const needsData=actor.role==='owner'&&/\b(my|our|report|result|score|diagnostic|priority|strength|weakness)\b/i.test(message);
  const details=needsData?(await db(`accounts?select=diagnostic_state,report_data&id=eq.${encodeURIComponent(account.id)}&limit=1`))?.[0]:null;
  response=await answer({agency:account.agency_name||account.name,actorRole:actor.role,departments:actor.departments||[],page:topic,diagnostic:details?compactCreatureData(details.diagnostic_state||{},5000):undefined,report:details?compactCreatureData(details.report_data||{},5000):undefined},history,message);
 }
 try{return await db('rpc/cc_ask_save_turn',{method:'POST',body:JSON.stringify({p_account_id:account.id,p_member_id:actor.role==='member'?actor.memberId:null,p_conversation_id:id,p_request_id:requestId,p_page_path:`/${topic}/`,p_message:message,p_answer:response,p_expected_count:expected})});}
 catch{throw fail(409,'Your answer could not be saved. Open History to check this conversation before retrying.');}
}
