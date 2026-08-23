import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean=value=>String(value??'').trim();
const AUTH_URL='https://www.teamwork.com/launchpad/login/';
const TOKEN_URL='https://www.teamwork.com/launchpad/v1/token.json';
const USERINFO_URL='https://www.teamwork.com/launchpad/v1/userinfo.json';

export function teamworkConfig(){
  const clientId=clean(process.env.TEAMWORK_CLIENT_ID);
  const clientSecret=clean(process.env.TEAMWORK_CLIENT_SECRET);
  const redirectUri=clean(process.env.TEAMWORK_REDIRECT_URI);
  const encryptionSecret=clean(process.env.TEAMWORK_TOKEN_ENCRYPTION_KEY)||accountSessionSecret();
  if(!clientId||!clientSecret||!redirectUri||!encryptionSecret)return null;
  return{clientId,clientSecret,redirectUri,encryptionSecret};
}

function cipherKey(secret){return crypto.createHash('sha256').update(String(secret)).digest()}
export function encryptTeamworkToken(value,secret){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',cipherKey(secret),iv);
  const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return`v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}
export function decryptTeamworkToken(value,secret){
  const[version,ivRaw,tagRaw,dataRaw]=String(value||'').split('.');
  if(version!=='v1'||!ivRaw||!tagRaw||!dataRaw)throw new Error('Stored Teamwork token is invalid.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',cipherKey(secret),Buffer.from(ivRaw,'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8');
}

export function createTeamworkAuthorizationUrl(accountId){
  const c=teamworkConfig();
  if(!c)throw new Error('Teamwork is not configured.');
  const state=signSession({purpose:'teamwork-oauth',accountId},accountSessionSecret(),10*60);
  const params=new URLSearchParams({redirect_uri:c.redirectUri,client_id:c.clientId,state});
  return`${AUTH_URL}?${params.toString()}`;
}
export function verifyTeamworkOAuthState(state,accountId){
  const payload=verifySession(state,accountSessionSecret());
  return Boolean(payload?.purpose==='teamwork-oauth'&&payload?.accountId===accountId);
}

export async function exchangeTeamworkCode(code){
  const c=teamworkConfig();
  if(!c)throw new Error('Teamwork is not configured.');
  const response=await fetch(TOKEN_URL,{
    method:'POST',
    headers:{Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify({client_id:c.clientId,client_secret:c.clientSecret,code:clean(code),redirect_uri:c.redirectUri})
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok||!payload?.access_token){
    const error=new Error(payload?.message||payload?.status||'Teamwork token exchange failed.');
    error.status=response.status||400;error.payload=payload;throw error;
  }
  return payload;
}

export async function getTeamworkUserInfo(accessToken){
  const response=await fetch(USERINFO_URL,{headers:{Accept:'application/json',Authorization:`Bearer ${accessToken}`}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload?.message||payload?.status||'Teamwork user lookup failed.');
    error.status=response.status||400;error.payload=payload;throw error;
  }
  return payload;
}

function apiBase(endpoint){
  const raw=clean(endpoint);
  if(!raw)throw new Error('Teamwork API endpoint is missing.');
  return raw.endsWith('/')?raw:`${raw}/`;
}
async function teamworkJson(apiEndpoint,path,{accessToken,query}={}){
  const url=new URL(String(path||'').replace(/^\/+/,''),apiBase(apiEndpoint));
  if(query)Object.entries(query).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value))});
  const response=await fetch(url,{headers:{Accept:'application/json',Authorization:`Bearer ${accessToken}`}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=new Error(payload?.message||payload?.status||payload?.error||'Teamwork API request failed.');
    error.status=response.status||400;error.payload=payload;throw error;
  }
  return payload;
}
function collection(payload,...keys){
  for(const key of keys){
    if(Array.isArray(payload?.[key]))return payload[key];
    if(Array.isArray(payload?.data?.[key]))return payload.data[key];
  }
  return Array.isArray(payload?.data)?payload.data:[];
}
const id=v=>String(v??'').trim();

export async function listTeamworkProjects(accessToken,apiEndpoint){
  const p=await teamworkJson(apiEndpoint,'projects/api/v3/projects.json',{accessToken,query:{pageSize:250,page:1,include:'companies'}});
  return collection(p,'projects').map(x=>({
    id:id(x.id),name:x.name||x.projectName||'Project',status:x.status||'',startDate:x.startDate||x.start_date||null,endDate:x.endDate||x.end_date||null,
    companyId:id(x.companyId||x.company?.id),companyName:x.company?.name||x.companyName||'',ownerId:id(x.projectOwnerId||x.ownerId||x.owner?.id),
    categoryName:x.category?.name||x.categoryName||'',health:x.health||x.projectHealth||'',updatedAt:x.updatedAt||x.updated_at||null
  })).filter(x=>x.id);
}

export async function listTeamworkTasks(accessToken,apiEndpoint){
  const p=await teamworkJson(apiEndpoint,'projects/api/v3/tasks.json',{accessToken,query:{pageSize:250,page:1,includeCompletedTasks:true,includeTasksWithoutDueDates:true,includeAssigneeCompanies:true,includeAssigneeTeams:true}});
  return collection(p,'tasks').map(x=>{
    const assignees=Array.isArray(x.assignees)?x.assignees:Array.isArray(x.responsibleParties)?x.responsibleParties:Array.isArray(x.responsiblePartyNames)?x.responsiblePartyNames.map(name=>({name})):[];
    return{
      id:id(x.id),name:x.name||x.content||x.taskName||'Task',status:x.status||x.taskStatus||(x.completed?'completed':''),completed:Boolean(x.completed||x.completedAt||x.dateCompleted),
      priority:x.priority||'',dueDate:x.dueAt||x.dueDate||x.due_date||null,startDate:x.startAt||x.startDate||x.start_date||null,projectId:id(x.projectId||x.project?.id),
      projectName:x.project?.name||x.projectName||'',taskListId:id(x.taskListId||x.tasklistId||x.taskList?.id),taskListName:x.taskList?.name||x.tasklistName||x.taskListName||'',
      estimatedMinutes:Number(x.estimatedMinutes||x.estimatedTime||0),assignees:assignees.map(a=>({id:id(a?.id||a?.userId),name:a?.name||[a?.firstName,a?.lastName].filter(Boolean).join(' ')||a?.username||a?.email||String(a||''),email:a?.email||''})).filter(a=>a.name||a.id),updatedAt:x.updatedAt||x.updated_at||null
    };
  }).filter(x=>x.id);
}

export async function listTeamworkPeople(accessToken,apiEndpoint){
  const p=await teamworkJson(apiEndpoint,'projects/api/v3/people.json',{accessToken,query:{pageSize:250,page:1,includeCollaborators:true}});
  return collection(p,'people','users').map(x=>({
    id:id(x.id),name:x.name||[x.firstName,x.lastName].filter(Boolean).join(' ')||x.email||'Person',firstName:x.firstName||'',lastName:x.lastName||'',email:x.email||'',title:x.title||'',
    companyId:id(x.companyId||x.company?.id),companyName:x.company?.name||x.companyName||'',type:x.type||x.userType||'',isAdmin:Boolean(x.isAdmin),isClientUser:Boolean(x.isClientUser)
  })).filter(x=>x.id);
}

export async function listTeamworkTimeEntries(accessToken,apiEndpoint){
  const p=await teamworkJson(apiEndpoint,'projects/api/v3/time.json',{accessToken,query:{pageSize:250,page:1,orderBy:'date',orderMode:'desc'}});
  return collection(p,'timelogs','timeEntries','time').map(x=>({
    id:id(x.id),minutes:Number(x.minutes||x.minutesLogged||0),description:x.description||'',timeLogged:x.timeLogged||x.date||x.loggedAt||null,billable:Boolean(x.billable),
    userId:id(x.userId||x.user?.id),userName:x.user?.name||[x.user?.firstName,x.user?.lastName].filter(Boolean).join(' ')||x.userName||'',taskId:id(x.taskId||x.task?.id),
    taskName:x.task?.name||x.task?.content||x.taskName||'',projectId:id(x.projectId||x.project?.id),projectName:x.project?.name||x.projectName||''
  })).filter(x=>x.id);
}
