import crypto from 'node:crypto';
import { accountSessionSecret, signSession, verifySession } from './session-utils.js';

const clean=value=>String(value??'').trim();
const AUTH_URL='https://app.clickup.com/api';
const TOKEN_URL='https://api.clickup.com/api/v2/oauth/token';
const API_BASE='https://api.clickup.com/api/v2';

export function clickUpConfig(){
  const clientId=clean(process.env.CLICKUP_CLIENT_ID);
  const clientSecret=clean(process.env.CLICKUP_CLIENT_SECRET);
  const redirectUri=clean(process.env.CLICKUP_REDIRECT_URI);
  const encryptionSecret=clean(process.env.CLICKUP_TOKEN_ENCRYPTION_KEY)||accountSessionSecret();
  if(!clientId||!clientSecret||!redirectUri||!encryptionSecret)return null;
  return{clientId,clientSecret,redirectUri,encryptionSecret};
}
function cipherKey(secret){return crypto.createHash('sha256').update(String(secret)).digest()}
export function encryptClickUpToken(value,secret){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',cipherKey(secret),iv),encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return`v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`}
export function decryptClickUpToken(value,secret){const[version,ivRaw,tagRaw,dataRaw]=String(value||'').split('.');if(version!=='v1'||!ivRaw||!tagRaw||!dataRaw)throw new Error('Stored ClickUp token is invalid.');const decipher=crypto.createDecipheriv('aes-256-gcm',cipherKey(secret),Buffer.from(ivRaw,'base64url'));decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8')}
export function createClickUpAuthorizationUrl(accountId){const c=clickUpConfig();if(!c)throw new Error('ClickUp is not configured.');const state=signSession({purpose:'clickup-oauth',accountId},accountSessionSecret(),10*60);const params=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,state});return`${AUTH_URL}?${params.toString()}`}
export function verifyClickUpOAuthState(state,accountId){const payload=verifySession(state,accountSessionSecret());return Boolean(payload?.purpose==='clickup-oauth'&&payload?.accountId===accountId)}
export async function exchangeClickUpCode(code){const c=clickUpConfig();if(!c)throw new Error('ClickUp is not configured.');const response=await fetch(TOKEN_URL,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:c.clientId,client_secret:c.clientSecret,code:clean(code)})});const payload=await response.json().catch(()=>({}));if(!response.ok||!payload?.access_token){const error=new Error(payload?.err||payload?.error||payload?.message||'ClickUp token exchange failed.');error.status=response.status||400;error.payload=payload;throw error}return payload}
async function clickUpJson(path,{accessToken,query}={}){const url=new URL(`${API_BASE}${path.startsWith('/')?path:`/${path}`}`);if(query)Object.entries(query).forEach(([k,v])=>{if(v===undefined||v===null||v==='')return;url.searchParams.set(k,String(v))});const response=await fetch(url,{headers:{Accept:'application/json',Authorization:`Bearer ${accessToken}`}});const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload?.err||payload?.error||payload?.message||'ClickUp API request failed.');error.status=response.status||400;error.payload=payload;throw error}return payload}
export async function listClickUpWorkspaces(accessToken){const p=await clickUpJson('/team',{accessToken});return(p.teams||[]).map(t=>({id:String(t.id||''),name:t.name||'Workspace',color:t.color||'',avatar:t.avatar||'',members:Array.isArray(t.members)?t.members.length:0})).filter(t=>t.id)}
export async function listClickUpSpaces(accessToken,workspaceId){const p=await clickUpJson(`/team/${encodeURIComponent(workspaceId)}/space`,{accessToken,query:{archived:false}});return(p.spaces||[]).map(s=>({id:String(s.id||''),name:s.name||'Space',private:Boolean(s.private),archived:Boolean(s.archived),statuses:Array.isArray(s.statuses)?s.statuses.map(x=>x.status).filter(Boolean):[]})).filter(s=>s.id)}
export async function listClickUpFolders(accessToken,spaceId){const p=await clickUpJson(`/space/${encodeURIComponent(spaceId)}/folder`,{accessToken,query:{archived:false}});return(p.folders||[]).map(f=>({id:String(f.id||''),name:f.name||'Folder',hidden:Boolean(f.hidden),spaceId:String(spaceId)})).filter(f=>f.id)}
function normalizeList(l,extra={}){return{id:String(l.id||''),name:l.name||'List',archived:Boolean(l.archived),status:l.status?.status||l.status||'',taskCount:Number(l.task_count||0),...extra}}
export async function listClickUpFolderlessLists(accessToken,spaceId){const p=await clickUpJson(`/space/${encodeURIComponent(spaceId)}/list`,{accessToken,query:{archived:false}});return(p.lists||[]).map(l=>normalizeList(l,{spaceId})).filter(l=>l.id)}
export async function listClickUpFolderLists(accessToken,folderId){const p=await clickUpJson(`/folder/${encodeURIComponent(folderId)}/list`,{accessToken,query:{archived:false}});return(p.lists||[]).map(l=>normalizeList(l,{folderId})).filter(l=>l.id)}
export async function listClickUpTasks(accessToken,listId,{page=0}={}){const p=await clickUpJson(`/list/${encodeURIComponent(listId)}/task`,{accessToken,query:{archived:false,include_closed:true,subtasks:true,page}});return(p.tasks||[]).map(t=>({id:String(t.id||''),name:t.name||'Task',status:t.status?.status||'',statusType:t.status?.type||'',dueDate:t.due_date||null,startDate:t.start_date||null,dateCreated:t.date_created||null,dateUpdated:t.date_updated||null,timeEstimate:Number(t.time_estimate||0),timeSpent:Number(t.time_spent||0),priority:t.priority?.priority||'',assignees:Array.isArray(t.assignees)?t.assignees.map(a=>({id:String(a.id||''),name:a.username||a.email||'User',email:a.email||''})):[],url:t.url||'',listId:String(listId)}))}
