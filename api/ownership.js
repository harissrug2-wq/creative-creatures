import crypto from 'node:crypto';
import { requireAccountSession } from '../lib/account-api-access.js';
import { hashPassword } from '../lib/session-utils.js';
import { sendEmail, escapeHtml } from '../lib/email-service.js';

const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=v=>String(v??'').trim();
const lower=v=>clean(v).toLowerCase();
const allDepartments=['leadership','marketing','sales','billing','onboarding','service-delivery','client-success','talent-acquisition','finance','communication','systems','sops'];

function cfg(){const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);return url&&key?{url,key}:null}
async function db(c,path,options={}){const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers:{apikey:c.key,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let p=null;try{p=t?JSON.parse(t):null}catch{p=t}if(!r.ok){const e=new Error(p?.message||p?.hint||'Database request failed.');e.status=r.status;e.payload=p;throw e}return p}
function origin(req){const proto=clean(req.headers?.['x-forwarded-proto'])||'https';const host=clean(req.headers?.['x-forwarded-host']||req.headers?.host)||'app.creativecreatures.org';return `${proto}://${host}`}

async function accountForSession(c,session){
  const rows=await db(c,`accounts?select=id,name,email,agency_name,archetype_result,diagnostic_state,created_at&id=eq.${encodeURIComponent(session.accountId)}&limit=1`);
  return Array.isArray(rows)?rows[0]||null:null;
}
async function actorForSession(c,session,account){
  if(session.role==='admin'||session.isAdmin)return{role:'admin',name:session.username||'Admin'};
  if(!session.memberId)return{role:'owner',name:account?.name||'Agency Owner'};
  const rows=await db(c,`account_members?select=id,name,email,role,status&account_id=eq.${encodeURIComponent(session.accountId)}&id=eq.${encodeURIComponent(session.memberId)}&limit=1`);
  const member=Array.isArray(rows)?rows[0]:null;
  return member?.status==='active'?{role:member.role||'member',name:member.name||member.email||'Member'}:null;
}
function requirePrimary(actor){
  if(!actor||!['owner','admin'].includes(actor.role))throw Object.assign(new Error('Only the primary agency owner or Creative Creatures admin can change ownership.'),{status:403});
}
function publicOwner(row){return row?{
  id:row.id,memberId:row.member_id||null,name:row.name,email:row.email||'',title:row.title||'',
  ownershipPercent:Number(row.ownership_percent||0),isPrimary:row.is_primary===true,status:row.status||'active',
  effectiveFrom:row.effective_from||null,effectiveTo:row.effective_to||null,
  ownerIdentityStatus:row.owner_identity_status||'not_started',
  ownerIdentityResult:row.owner_identity_result||{},dependencyProfile:row.dependency_profile||{}
}:null}
async function listOwners(c,accountId){
  const rows=await db(c,`agency_owners?select=*&account_id=eq.${encodeURIComponent(accountId)}&order=is_primary.desc,created_at.asc`);
  return(Array.isArray(rows)?rows:[]).map(publicOwner);
}
async function bootstrapOwner(c,account){
  const existing=await listOwners(c,account.id);if(existing.length)return existing;
  const now=new Date().toISOString().slice(0,10);
  const rows=await db(c,'agency_owners?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    account_id:account.id,name:account.name||'Agency Owner',email:account.email||null,email_normalized:lower(account.email)||null,
    title:'Owner',ownership_percent:100,is_primary:true,status:'active',effective_from:now,
    owner_identity_status:Object.keys(account.archetype_result||{}).length?'complete':'not_started'
  })});
  return(Array.isArray(rows)?rows:[]).map(publicOwner);
}
function structureForSnapshot(owners){return owners.filter(o=>o.status==='active').map(o=>({
  id:o.id||null,name:o.name,email:o.email||'',title:o.title||'',ownershipPercent:Number(o.ownershipPercent||0),
  isPrimary:o.isPrimary===true,ownerIdentityStatus:o.ownerIdentityStatus||'not_started'
}))}
function sameStructure(a,b){
  const normalize=rows=>rows.map(o=>[lower(o.email)||lower(o.name),Number(o.ownershipPercent||0).toFixed(2),clean(o.title),Boolean(o.isPrimary)]).sort((x,y)=>x[0].localeCompare(y[0]));
  return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
}
async function latestSnapshot(c,accountId){
  const rows=await db(c,`agency_ownership_snapshots?select=*&account_id=eq.${encodeURIComponent(accountId)}&order=effective_at.desc&limit=1`);
  return Array.isArray(rows)?rows[0]||null:null;
}
async function attachLegacyScorecardToSnapshot(c,accountId,snapshot) {
  if(!snapshot?.id)return;
  try{
    const runs=await db(c,`diagnostic_runs?select=id&account_id=eq.${encodeURIComponent(accountId)}&is_current=eq.true&limit=1`);
    const run=Array.isArray(runs)?runs[0]:null;if(!run?.id)return;
    const cards=await db(c,`scorecards?select=id,report_data,ownership_snapshot_id&diagnostic_run_id=eq.${encodeURIComponent(run.id)}&limit=1`);
    const card=Array.isArray(cards)?cards[0]:null;if(!card?.id||card.ownership_snapshot_id)return;
    const report={...(card.report_data||{}),ownership:{snapshotId:snapshot.id,asOf:snapshot.effective_at,owners:snapshot.structure||[]}};
    await db(c,`scorecards?id=eq.${encodeURIComponent(card.id)}`,{method:'PATCH',body:JSON.stringify({ownership_snapshot_id:snapshot.id,report_data:report,updated_at:new Date().toISOString()})});
  }catch(error){console.error('Legacy Scorecard ownership snapshot link skipped',error?.message||error)}
}

async function saveSnapshot(c,accountId,owners,reason,actor){
  const rows=await db(c,'agency_ownership_snapshots?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    account_id:accountId,reason:clean(reason)||'ownership_update',structure:structureForSnapshot(owners),created_by:actor?.name||actor?.role||'owner'
  })});
  return Array.isArray(rows)?rows[0]||null:null;
}
async function ensurePartnerMember(c,req,account,owner){
  const email=lower(owner.email);if(!email||email===lower(account.email))return{memberId:null,emailSent:false};
  const primaryAccounts=await db(c,`accounts?select=id,email&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);
  const otherPrimary=Array.isArray(primaryAccounts)?primaryAccounts[0]:null;
  if(otherPrimary&&otherPrimary.id!==account.id)throw Object.assign(new Error('This email already owns another Creative Creatures agency. Multi-agency memberships are not enabled yet.'),{status:409});
  const found=await db(c,`account_members?select=id,account_id,role,status&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);
  let member=Array.isArray(found)?found[0]:null;
  if(member&&member.account_id!==account.id)throw Object.assign(new Error('This email already belongs to another Creative Creatures agency workspace.'),{status:409});
  if(member&&member.id){
    if(member.role!=='partner'||member.status!=='active')await db(c,`account_members?id=eq.${encodeURIComponent(member.id)}`,{method:'PATCH',body:JSON.stringify({role:'partner',status:'active',departments:allDepartments,updated_at:new Date().toISOString()})});
    return{memberId:member.id,emailSent:false};
  }
  const temporaryPassword=`CC-${crypto.randomBytes(8).toString('base64url')}!`;
  const rows=await db(c,'account_members?select=id,name,email,role,status',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    account_id:account.id,name:owner.name,email,email_normalized:email,password_hash:hashPassword(temporaryPassword),
    role:'partner',departments:allDepartments,status:'active'
  })});
  member=Array.isArray(rows)?rows[0]:null;
  let emailSent=false;
  try{
    const login=`${origin(req)}/login/`;
    await sendEmail({
      to:email,
      subject:`You've been added as a partner of ${account.agency_name||'your agency'}`,
      text:`Hi ${owner.name},\n\nYou've been added as an agency partner in Creative Creatures.\n\nSign in: ${login}\nTemporary password: ${temporaryPassword}\n\nYour agency-level Diagnostic is shared, while Owner Identity and owner-dependency information can be tracked for each partner.`,
      html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171820"><h2>You've been added as an agency partner</h2><p>Hi ${escapeHtml(owner.name)},</p><p>You've been added as a partner of <strong>${escapeHtml(account.agency_name||'your agency')}</strong> in Creative Creatures.</p><p><strong>Sign in:</strong> <a href="${escapeHtml(login)}">${escapeHtml(login)}</a><br><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p><p>Your agency-level Diagnostic is shared, while partner-specific Owner Identity and dependency information can be tracked separately.</p></div>`
    });emailSent=true;
  }catch(error){console.error('partner invite email failed',error)}
  return{memberId:member?.id||null,emailSent};
}
async function patchDiagnosticState(c,account,snapshot,changed,hadSnapshot){
  const current=account.diagnostic_state&&typeof account.diagnostic_state==='object'?account.diagnostic_state:{};
  const next={...current,
    ownershipConfirmedAt:new Date().toISOString(),
    ownershipSnapshotId:snapshot?.id||current.ownershipSnapshotId||null,
    ownerCount:Array.isArray(snapshot?.structure)?snapshot.structure.length:current.ownerCount||1,
    ownershipChangedAt:changed&&hadSnapshot?new Date().toISOString():current.ownershipChangedAt||null,
    ownerIndependenceNeedsReview:changed&&hadSnapshot?true:Boolean(current.ownerIndependenceNeedsReview),
    scorecardNeedsRefresh:changed&&hadSnapshot&&current.reportReady===true?true:Boolean(current.scorecardNeedsRefresh)
  };
  if(changed&&hadSnapshot){
    const indexes={...(next.indexes||{})};
    indexes.independence={...(indexes.independence||{}),needsReassessment:true,ownershipChangedAt:next.ownershipChangedAt};
    next.indexes=indexes;
  }
  await db(c,`accounts?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',body:JSON.stringify({diagnostic_state:next,updated_at:new Date().toISOString()})});
  return next;
}

export default async function handler(req,res){
  if(req.method==='OPTIONS')return json(res,204,{});
  if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
  const c=cfg();if(!c)return json(res,503,{error:'Ownership database is not configured.'});
  try{
    const session=requireAccountSession(req);
    const account=await accountForSession(c,session);if(!account)return json(res,404,{error:'Agency account not found.'});
    const actor=await actorForSession(c,session,account);if(!actor)return json(res,401,{error:'Your agency access is no longer active.'});
    const owners=await bootstrapOwner(c,account);
    const latest=await latestSnapshot(c,account.id);
    if(req.method==='GET'){
      const history=await db(c,`agency_ownership_snapshots?select=id,effective_at,reason,structure,created_by&account_id=eq.${encodeURIComponent(account.id)}&order=effective_at.desc&limit=20`);
      return json(res,200,{ok:true,account:{id:account.id,agencyName:account.agency_name||'',primaryName:account.name,primaryEmail:account.email},owners,history:Array.isArray(history)?history:[],needsConfirmation:!latest,reassessment:{ownerIndependenceNeedsReview:account.diagnostic_state?.ownerIndependenceNeedsReview===true,scorecardNeedsRefresh:account.diagnostic_state?.scorecardNeedsRefresh===true,ownershipChangedAt:account.diagnostic_state?.ownershipChangedAt||null}});
    }
    requirePrimary(actor);
    const body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});
    if(clean(body.action)!=='save_ownership')return json(res,422,{error:'Unsupported ownership action.'});
    const submitted=Array.isArray(body.owners)?body.owners:[];
    if(!submitted.length||submitted.length>10)return json(res,422,{error:'Add between 1 and 10 active owners.'});
    const normalized=submitted.map((row,index)=>({
      id:clean(row.id)||null,name:clean(row.name),email:lower(row.email),title:clean(row.title)||'Partner',
      ownershipPercent:Number(row.ownershipPercent),isPrimary:row.isPrimary===true||index===0,
      ownerIdentityStatus:clean(row.ownerIdentityStatus)||'not_started',invite:row.invite!==false
    }));
    if(normalized.some(row=>!row.name||!Number.isFinite(row.ownershipPercent)||row.ownershipPercent<0||row.ownershipPercent>100))return json(res,422,{error:'Every owner needs a name and an ownership percentage between 0 and 100.'});
    const total=normalized.reduce((sum,row)=>sum+row.ownershipPercent,0);
    if(Math.abs(total-100)>0.01)return json(res,422,{error:`Ownership must total 100%. Current total is ${total.toFixed(2)}%.`});
    if(normalized.filter(row=>row.isPrimary).length!==1)return json(res,422,{error:'Choose exactly one primary owner.'});
    const emails=normalized.map(row=>row.email).filter(Boolean);if(new Set(emails).size!==emails.length)return json(res,422,{error:'Each partner email must be unique.'});

    const previousActive=owners.filter(o=>o.status==='active');
    let previousSnapshot=latest;
    if(!previousSnapshot&&account.diagnostic_state?.reportReady===true){
      previousSnapshot=await saveSnapshot(c,account.id,previousActive,'legacy_baseline',actor);
      await attachLegacyScorecardToSnapshot(c,account.id,previousSnapshot);
    }
    const invites=[];
    const savedOwners=[];
    const submittedIds=new Set(normalized.map(row=>row.id).filter(Boolean));
    for(const row of normalized){
      let memberId=null;
      if(row.email&&row.email!==lower(account.email)&&row.invite){
        const invite=await ensurePartnerMember(c,req,account,row);memberId=invite.memberId;invites.push({email:row.email,emailSent:invite.emailSent});
      }
      const payload={account_id:account.id,member_id:memberId||null,name:row.name,email:row.email||null,email_normalized:row.email||null,title:row.title,ownership_percent:row.ownershipPercent,is_primary:row.isPrimary,status:'active',effective_to:null,owner_identity_status:row.ownerIdentityStatus,updated_at:new Date().toISOString()};
      let saved;
      if(row.id){
        const rows=await db(c,`agency_owners?id=eq.${encodeURIComponent(row.id)}&account_id=eq.${encodeURIComponent(account.id)}&select=*`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});saved=Array.isArray(rows)?rows[0]:null;
      }else{
        const rows=await db(c,'agency_owners?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({...payload,effective_from:new Date().toISOString().slice(0,10)})});saved=Array.isArray(rows)?rows[0]:null;
      }
      if(saved)savedOwners.push(publicOwner(saved));
    }
    for(const previous of previousActive){
      if(submittedIds.has(previous.id))continue;
      if(normalized.some(row=>row.email&&lower(previous.email)===row.email))continue;
      await db(c,`agency_owners?id=eq.${encodeURIComponent(previous.id)}&account_id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',body:JSON.stringify({status:'former',effective_to:new Date().toISOString().slice(0,10),updated_at:new Date().toISOString()})});
    }
    const active=await listOwners(c,account.id);
    const changed=!sameStructure(previousActive,active.filter(o=>o.status==='active'));
    const snapshot=await saveSnapshot(c,account.id,active,previousSnapshot?'ownership_update':'ownership_confirmed',actor);
    const diagnosticState=await patchDiagnosticState(c,account,snapshot,changed,Boolean(previousSnapshot));
    return json(res,200,{ok:true,owners:active,ownershipSnapshot:snapshot,changed,invites,reassessment:{ownerIndependenceNeedsReview:diagnosticState.ownerIndependenceNeedsReview===true,scorecardNeedsRefresh:diagnosticState.scorecardNeedsRefresh===true}});
  }catch(error){console.error('ownership api error',error);const status=[400,401,403,404,409,422,503].includes(Number(error.status))?Number(error.status):500;return json(res,status,{error:error.message||'Unable to update agency ownership.'})}
}
