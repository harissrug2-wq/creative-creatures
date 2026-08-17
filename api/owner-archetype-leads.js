import { requireAdmin } from '../lib/session-utils.js';
const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=v=>String(v??'').trim();const lower=v=>clean(v).toLowerCase();
const SELECT='id,name,email,agency_url,agency_url_normalized,agency_name,journey,source,archetype_result,report_data,converted_account_id,converted_at,payment_completed_at,created_at,updated_at';
function normalizeUrl(value){const raw=clean(value);if(!raw)return'';try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);const host=u.hostname.toLowerCase().replace(/^www\./,'');const path=u.pathname.replace(/\/+$/,'');return`${host}${path==='/'?'':path}`.toLowerCase()}catch{return raw.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/+$/,'')}}
function deriveName(url){const h=normalizeUrl(url).split('/')[0].split(':')[0];return(h.split('.')[0]||'Agency').split(/[-_]/).filter(Boolean).map(x=>x[0].toUpperCase()+x.slice(1)).join(' ')}
function cfg(){const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);return url&&key?{url,key}:null}
async function db(c,path,options={}){const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers:{apikey:c.key,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let p=null;try{p=t?JSON.parse(t):null}catch{p=t}if(!r.ok){const e=new Error(p?.message||p?.hint||'Database request failed.');e.status=r.status;throw e}return p}
function pub(r,accountIds=null){const accountExists=Boolean(r?.converted_account_id&&(accountIds?accountIds.has(r.converted_account_id):true));return r?{id:r.id,name:r.name,email:r.email,agency_url:r.agency_url,agency_url_normalized:r.agency_url_normalized,agency_name:r.agency_name,journey:r.journey,source:r.source,archetype_result:r.archetype_result||{},report_data:r.report_data||{},converted_account_id:r.converted_account_id,converted_at:r.converted_at,payment_completed_at:r.payment_completed_at,account_exists:accountExists,is_paid:accountExists&&Boolean(r.payment_completed_at||r.converted_at),created_at:r.created_at,updated_at:r.updated_at}:null}
async function attachAccountState(c,rows){const list=Array.isArray(rows)?rows:[];const ids=[...new Set(list.map(r=>r.converted_account_id).filter(Boolean))];if(!ids.length)return list.map(r=>pub(r,new Set()));const filter=encodeURIComponent(`(${ids.join(',')})`);const accounts=await db(c,`accounts?select=id&id=in.${filter}`);const accountIds=new Set((Array.isArray(accounts)?accounts:[]).map(a=>a.id));return list.map(r=>pub(r,accountIds))}
async function loadAdminHistory(c){
  // Use an explicit non-null primary-key filter instead of ilike.*. Every
  // persisted lead has an id, so this reliably returns the complete table
  // while still using the same PostgREST endpoint that public lookup uses.
  const leadRows=await db(c,`owner_archetype_leads?select=${SELECT}&id=not.is.null&order=created_at.desc&limit=1000`);

  // Account history is supplemental. A problem reading converted accounts
  // must never hide valid Owner Archetype lead rows from the admin table.
  let accountRows=[];
  try{
    const rows=await db(c,'accounts?select=id,name,email,agency_url,agency_url_normalized,agency_name,journey,source,archetype_result,report_data,diagnostic_state,created_at,updated_at&source=eq.owner-archetype&order=created_at.desc');
    accountRows=Array.isArray(rows)?rows:[];
  }catch(error){
    console.warn('Owner Archetype admin account merge skipped:',error?.message||error);
  }
  const history=new Map();
  for(const account of (Array.isArray(accountRows)?accountRows:[])){
    const state=account?.diagnostic_state||{};
    const paid=state.paymentComplete===true||state.integrationsComplete===true||state.reportReady===true||state.allComplete===true||Number(state.count||0)>0;
    const row={
      id:`account:${account.id}`,
      name:account.name,email:account.email,agency_url:account.agency_url,agency_url_normalized:account.agency_url_normalized,
      agency_name:account.agency_name,journey:account.journey,source:account.source,archetype_result:account.archetype_result||{},report_data:account.report_data||{},
      converted_account_id:account.id,converted_at:paid?(account.updated_at||account.created_at):null,payment_completed_at:paid?(account.updated_at||account.created_at):null,
      created_at:account.created_at,updated_at:account.updated_at,account_exists:true,is_paid:paid
    };
    const key=lower(account.email)||`account:${account.id}`;
    history.set(key,row);
  }
  for(const lead of (Array.isArray(leadRows)?leadRows:[])){
    const key=lower(lead.email)||`lead:${lead.id}`;
    const existing=history.get(key);
    const row=pub(lead);
    history.set(key,existing?{...existing,...row,account_exists:Boolean(existing.account_exists||row.account_exists),is_paid:Boolean(existing.is_paid||row.is_paid),converted_account_id:row.converted_account_id||existing.converted_account_id,converted_at:row.converted_at||existing.converted_at,payment_completed_at:row.payment_completed_at||existing.payment_completed_at}:row);
  }
  return [...history.values()].sort((a,b)=>new Date(b.created_at||b.updated_at||0)-new Date(a.created_at||a.updated_at||0));
}
export default async function handler(req,res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');if(req.method==='OPTIONS')return json(res,204,{});const c=cfg();if(!c)return json(res,503,{error:'Lead database is not configured.'});try{
 if(req.method==='GET'){
   const all=req.query?.all==='true'||req.query?.all==='1';
   if(all){
     if(!requireAdmin(req))return json(res,401,{error:'Admin authentication required.'});
     const leads=await loadAdminHistory(c);
     return json(res,200,{leads,count:leads.length,source:'admin_history'});
   }
   const email=lower(req.query?.email),url=normalizeUrl(req.query?.agencyUrl||req.query?.agency_url),name=lower(req.query?.name);
   if(!email&&!url&&!name)return json(res,422,{error:'Enter a name, email address, or agency URL.'});
   const filters=[];if(email)filters.push(`email_normalized.eq.${email}`);if(url)filters.push(`agency_url_normalized.eq.${url}`);if(name)filters.push(`name_normalized.ilike.*${name.replace(/[,*()]/g,'')}*`);
   const or=encodeURIComponent(`(${filters.join(',')})`);const rows=await db(c,`owner_archetype_leads?select=${SELECT}&or=${or}&order=created_at.desc&limit=20`);
   const leads=await attachAccountState(c,rows);
   return json(res,200,{leads});
 }
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
 if(b.action==='admin_history'){
   if(!requireAdmin(req))return json(res,401,{error:'Admin authentication required.'});
   const leads=await loadAdminHistory(c);
   return json(res,200,{leads,count:leads.length,source:'admin_history'});
 }const name=clean(b.name||`${b.firstName||''} ${b.lastName||''}`);const email=lower(b.email);const agencyUrl=clean(b.agencyUrl||b.agency_url);const normalized=normalizeUrl(agencyUrl);if(!name||!email||!normalized)return json(res,422,{error:'Name, email, and agency URL are required.'});if(!/^\S+@\S+\.\S+$/.test(email))return json(res,422,{error:'Enter a valid email address.'});
 const accountRows=await db(c,`accounts?select=id,name,email,agency_url,agency_name,diagnostic_state&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);const existingAccount=Array.isArray(accountRows)?accountRows[0]:null;const s=existingAccount?.diagnostic_state||{};if(existingAccount&&(s.paymentComplete===true||s.integrationsComplete===true||s.reportReady===true||s.allComplete===true||Number(s.count||0)>0))return json(res,200,{alreadyActivated:true,account:existingAccount});
 const record={name,name_normalized:lower(name),email,email_normalized:email,agency_url:agencyUrl,agency_url_normalized:normalized,agency_name:clean(b.agencyName||b.agency_name)||deriveName(agencyUrl),journey:'diagnostic',source:'owner-archetype',archetype_answers:b.archetypeAnswers||b.archetype_answers||{},archetype_result:b.archetypeResult||b.archetype_result||{},report_data:b.reportData||b.report_data||{},converted_account_id:null,converted_at:null,payment_completed_at:null,updated_at:new Date().toISOString()};
 const old=await db(c,`owner_archetype_leads?select=id&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);let rows;if(Array.isArray(old)&&old[0])rows=await db(c,`owner_archetype_leads?id=eq.${old[0].id}&select=${SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(record)});else rows=await db(c,`owner_archetype_leads?select=${SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(record)});return json(res,200,{lead:pub(Array.isArray(rows)?rows[0]:rows)});
}catch(e){console.error('owner archetype leads API error',e);return json(res,e.status===400?400:500,{error:'The Owner Archetype lead could not be saved or loaded.'})}}
