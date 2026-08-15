import { accountSessionSecret, clearSessionCookie, parseCookies, setSessionCookie, signSession, verifyPassword, verifySession } from './session-utils.js';
const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=v=>String(v??'').trim();const lower=v=>clean(v).toLowerCase();
function cfg(){const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);return url&&key?{url,key}:null}
async function db(c,path,options={}){const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers:{apikey:c.key,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let p=null;try{p=t?JSON.parse(t):null}catch{p=t}if(!r.ok){const e=new Error(p?.message||p?.hint||'Database request failed.');e.status=r.status;throw e}return p}
const SELECT='id,name,email,agency_url,agency_name,journey,source,archetype_result,report_data,diagnostic_state,password_hash,created_at,updated_at';
function pub(a){return a?{id:a.id,name:a.name,email:a.email,agency_url:a.agency_url,agency_name:a.agency_name,journey:a.journey,source:a.source,archetype_result:a.archetype_result||{},report_data:a.report_data||{},diagnostic_state:a.diagnostic_state||{},created_at:a.created_at,updated_at:a.updated_at}:null}
async function findById(c,id){const rows=await db(c,`accounts?select=${SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`);return Array.isArray(rows)?rows[0]:null}
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});
  const c=cfg();const secret=accountSessionSecret();if(!c||!secret)return json(res,503,{error:'Account authentication is not configured.'});
  try{
    if(req.method==='DELETE'){clearSessionCookie(res,'cc_account_session');return json(res,200,{success:true})}
    if(req.method==='GET'){
      const session=verifySession(parseCookies(req).cc_account_session,secret);
      if(!session?.accountId)return json(res,401,{authenticated:false});
      const account=await findById(c,session.accountId);if(!account)return json(res,401,{authenticated:false});
      return json(res,200,{authenticated:true,account:pub(account)});
    }
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
    const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const email=lower(b.email),password=clean(b.password);
    if(!email||!password)return json(res,422,{error:'Email and password are required.'});
    const rows=await db(c,`accounts?select=${SELECT}&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
    if(!account||!account.password_hash||!verifyPassword(password,account.password_hash))return json(res,401,{error:'Invalid email or password.'});
    const token=signSession({role:'account',accountId:account.id,email:account.email},secret,30*24*60*60);setSessionCookie(res,'cc_account_session',token,30*24*60*60);
    return json(res,200,{authenticated:true,account:pub(account)});
  }catch(e){console.error('account auth error',e);return json(res,500,{error:'Unable to sign in right now.'})}
}
