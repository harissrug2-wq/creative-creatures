import crypto from 'node:crypto';
import { sendEmail, escapeHtml } from '../lib/email-service.js';
import { accountSessionSecret, clearSessionCookie, hashPassword, parseCookies, setSessionCookie, signSession, verifyPassword, verifySession } from '../lib/session-utils.js';
import {
  createMondayAuthorizationUrl,
  decryptMondayToken,
  encryptMondayToken,
  exchangeMondayCode,
  getMondayIdentity,
  listMondayBoardItems,
  listMondayBoards,
  listMondayUsers,
  listMondayWorkspaces,
  mondayAccessExpiry,
  mondayConfig,
  refreshMondayTokens,
  revokeMondayToken,
  verifyMondayOAuthState
} from '../lib/monday.js';

import {
  createTeamworkAuthorizationUrl,
  decryptTeamworkToken,
  encryptTeamworkToken,
  exchangeTeamworkCode,
  getTeamworkUserInfo,
  listTeamworkPeople,
  listTeamworkProjects,
  listTeamworkTasks,
  listTeamworkTimeEntries,
  teamworkConfig,
  verifyTeamworkOAuthState
} from '../lib/teamwork.js';

import {
  clickUpConfig,
  createClickUpAuthorizationUrl,
  decryptClickUpToken,
  encryptClickUpToken,
  exchangeClickUpCode,
  listClickUpFolders,
  listClickUpFolderlessLists,
  listClickUpFolderLists,
  listClickUpSpaces,
  listClickUpTasks,
  listClickUpWorkspaces,
  verifyClickUpOAuthState
} from '../lib/clickup.js';

import {
  createSlackAuthorizationUrl,
  decryptSlackToken,
  encryptSlackToken,
  exchangeSlackCode,
  listSlackChannels,
  listSlackUsers,
  revokeSlackToken,
  slackAuthTest,
  slackConfig,
  verifySlackOAuthState
} from '../lib/slack.js';
import {
  createHubSpotAuthorizationUrl,
  decryptHubSpotToken,
  encryptHubSpotToken,
  exchangeHubSpotCode,
  getHubSpotAccountDetails,
  hubSpotConfig,
  introspectHubSpotToken,
  listHubSpotCompanies,
  listHubSpotContacts,
  listHubSpotDealPipelines,
  listHubSpotDeals,
  refreshHubSpotTokens,
  revokeHubSpotToken,
  verifyHubSpotOAuthState
} from '../lib/hubspot.js';
import {
  createGoogleDriveAuthorizationUrl,
  decryptGoogleDriveToken,
  encryptGoogleDriveToken,
  exchangeGoogleDriveCode,
  getGoogleDriveAbout,
  getGoogleDriveFiles,
  googleDriveConfig,
  refreshGoogleDriveTokens,
  revokeGoogleDriveToken,
  verifyGoogleDriveOAuthState
} from '../lib/google-drive.js';
import {
  createGoogleCalendarAuthorizationUrl,
  createGoogleCalendarEvent,
  decryptGoogleCalendarToken,
  deleteGoogleCalendarEvent,
  encryptGoogleCalendarToken,
  exchangeGoogleCalendarCode,
  googleCalendarConfig,
  listGoogleCalendarEvents,
  listGoogleCalendars,
  refreshGoogleCalendarTokens,
  revokeGoogleCalendarToken,
  updateGoogleCalendarEvent,
  verifyGoogleCalendarOAuthState
} from '../lib/google-calendar.js';
import {
  createQuickBooksAuthorizationUrl,
  decryptQuickBooksToken,
  encryptQuickBooksToken,
  exchangeQuickBooksCode,
  fetchArAgingEvidence,
  fetchBalanceSheetEvidence,
  fetchClientRevenueEvidence,
  fetchProfitLossEvidence,
  fetchServiceRevenueEvidence,
  getQuickBooksCompanyInfo,
  quickBooksConfig,
  refreshQuickBooksTokens,
  revokeQuickBooksToken,
  verifyQuickBooksOAuthState
} from '../lib/quickbooks.js';

const json=(res,status,payload)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload))};
const clean=v=>String(v??'').trim();const lower=v=>clean(v).toLowerCase();
function cfg(){const url=clean(process.env.SUPABASE_URL).replace(/\/+$/,'');const key=clean(process.env.SUPABASE_SERVICE_ROLE_KEY);return url&&key?{url,key}:null}
async function db(c,path,options={}){const r=await fetch(`${c.url}/rest/v1/${path}`,{...options,headers:{apikey:c.key,'Content-Type':'application/json',...(options.headers||{})}});const t=await r.text();let p=null;try{p=t?JSON.parse(t):null}catch{p=t}if(!r.ok){const e=new Error(p?.message||p?.hint||'Database request failed.');e.status=r.status;e.payload=p;throw e}return p}
const SELECT='id,name,email,agency_url,agency_name,journey,source,archetype_result,report_data,diagnostic_state,password_hash,password_reset_token_hash,password_reset_expires_at,created_at,updated_at';
function pub(a){return a?{id:a.id,name:a.name,email:a.email,agency_url:a.agency_url,agency_name:a.agency_name,journey:a.journey,source:a.source,archetype_result:a.archetype_result||{},report_data:a.report_data||{},diagnostic_state:a.diagnostic_state||{},created_at:a.created_at,updated_at:a.updated_at}:null}
async function findById(c,id){const rows=await db(c,`accounts?select=${SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`);return Array.isArray(rows)?rows[0]:null}

function currentSession(req, secret){
  const session=verifySession(parseCookies(req).cc_account_session,secret);
  return session?.role==='account'&&session?.accountId?session:null;
}

const QB_SELECT='id,account_id,realm_id,company_name,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,refresh_token_expires_at,scope,status,last_synced_at,last_sync_error,created_at,updated_at';
async function getQuickBooksConnection(c,accountId){const rows=await db(c,`quickbooks_connections?select=${QB_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicQuickBooksConnection(row){return row?{connected:row.status==='connected',realmId:row.realm_id,companyName:row.company_name||'',status:row.status||'connected',lastSyncedAt:row.last_synced_at||null,lastSyncError:row.last_sync_error||'',updatedAt:row.updated_at||null}: {connected:false,status:'disconnected',realmId:null,companyName:'',lastSyncedAt:null,lastSyncError:''}}
async function saveQuickBooksConnection(c,accountId,patch){
  const existing=await getQuickBooksConnection(c,accountId);const now=new Date().toISOString();
  if(existing){const rows=await db(c,`quickbooks_connections?id=eq.${encodeURIComponent(existing.id)}&select=${QB_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}
  const rows=await db(c,`quickbooks_connections?select=${QB_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null
}
async function deleteQuickBooksConnection(c,accountId){await db(c,`quickbooks_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}

function tokenDates(tokens){const now=Date.now();return{access_token_expires_at:new Date(now+(Number(tokens.expires_in)||3600)*1000).toISOString(),refresh_token_expires_at:tokens.x_refresh_token_expires_in?new Date(now+Number(tokens.x_refresh_token_expires_in)*1000).toISOString():null}}
async function ensureQuickBooksAccess(c,connection){
  const qbc=quickBooksConfig();if(!qbc)throw new Error('QuickBooks is not configured.');
  const expiresAt=Date.parse(connection.access_token_expires_at||'');
  if(Number.isFinite(expiresAt)&&expiresAt>Date.now()+120000){return{connection,accessToken:decryptQuickBooksToken(connection.access_token_encrypted,qbc.encryptionSecret)}}
  const refreshToken=decryptQuickBooksToken(connection.refresh_token_encrypted,qbc.encryptionSecret);
  const tokens=await refreshQuickBooksTokens(refreshToken);
  const updated=await saveQuickBooksConnection(c,connection.account_id,{access_token_encrypted:encryptQuickBooksToken(tokens.access_token,qbc.encryptionSecret),refresh_token_encrypted:encryptQuickBooksToken(tokens.refresh_token||refreshToken,qbc.encryptionSecret),...tokenDates(tokens),scope:tokens.scope||connection.scope||'com.intuit.quickbooks.accounting',status:'connected',last_sync_error:null});
  return{connection:updated,accessToken:tokens.access_token};
}


const GC_SELECT='id,account_id,calendar_id,calendar_summary,connected_email,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,scope,status,last_error,created_at,updated_at';
async function getGoogleCalendarConnection(c,accountId){const rows=await db(c,`google_calendar_connections?select=${GC_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicGoogleCalendarConnection(row){return row?{connected:row.status==='connected',calendarId:row.calendar_id||'primary',calendarSummary:row.calendar_summary||'',connectedEmail:row.connected_email||'',status:row.status||'connected',lastError:row.last_error||'',updatedAt:row.updated_at||null}:{connected:false,status:'disconnected',calendarId:'primary',calendarSummary:'',connectedEmail:'',lastError:''}}
async function saveGoogleCalendarConnection(c,accountId,patch){
  const existing=await getGoogleCalendarConnection(c,accountId);const now=new Date().toISOString();
  if(existing){const rows=await db(c,`google_calendar_connections?id=eq.${encodeURIComponent(existing.id)}&select=${GC_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}
  const rows=await db(c,`google_calendar_connections?select=${GC_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,calendar_id:'primary',status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null
}
async function deleteGoogleCalendarConnection(c,accountId){await db(c,`google_calendar_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
function googleTokenDates(tokens){const now=Date.now();return{access_token_expires_at:new Date(now+(Number(tokens.expires_in)||3600)*1000).toISOString()}}
async function ensureGoogleCalendarAccess(c,connection){
  const gcc=googleCalendarConfig();if(!gcc)throw new Error('Google Calendar is not configured.');
  const expiresAt=Date.parse(connection.access_token_expires_at||'');
  if(Number.isFinite(expiresAt)&&expiresAt>Date.now()+120000){return{connection,accessToken:decryptGoogleCalendarToken(connection.access_token_encrypted,gcc.encryptionSecret)}}
  if(!connection.refresh_token_encrypted)throw Object.assign(new Error('Google Calendar access expired. Reconnect Google Calendar.'),{status:401});
  const refreshToken=decryptGoogleCalendarToken(connection.refresh_token_encrypted,gcc.encryptionSecret);
  const tokens=await refreshGoogleCalendarTokens(refreshToken);
  const updated=await saveGoogleCalendarConnection(c,connection.account_id,{access_token_encrypted:encryptGoogleCalendarToken(tokens.access_token,gcc.encryptionSecret),refresh_token_encrypted:connection.refresh_token_encrypted,...googleTokenDates(tokens),scope:tokens.scope||connection.scope||gcc.scopes.join(' '),status:'connected',last_error:null});
  return{connection:updated,accessToken:tokens.access_token};
}
async function googleConnectionAccess(c,accountId){const connection=await getGoogleCalendarConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect Google Calendar first.'),{status:409});return ensureGoogleCalendarAccess(c,connection)}



const GD_SELECT='id,account_id,connected_email,connected_name,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,scope,selected_items,status,last_refreshed_at,last_error,created_at,updated_at';
async function getGoogleDriveConnection(c,accountId){const rows=await db(c,`google_drive_connections?select=${GD_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicGoogleDriveConnection(row){return row?{connected:row.status==='connected',connectedEmail:row.connected_email||'',connectedName:row.connected_name||'',selectedItems:Array.isArray(row.selected_items)?row.selected_items:[],selectedCount:Array.isArray(row.selected_items)?row.selected_items.length:0,status:row.status||'connected',lastRefreshedAt:row.last_refreshed_at||null,lastError:row.last_error||'',updatedAt:row.updated_at||null}:{connected:false,connectedEmail:'',connectedName:'',selectedItems:[],selectedCount:0,status:'disconnected',lastRefreshedAt:null,lastError:''}}
async function saveGoogleDriveConnection(c,accountId,patch){
  const existing=await getGoogleDriveConnection(c,accountId);const now=new Date().toISOString();
  if(existing){const rows=await db(c,`google_drive_connections?id=eq.${encodeURIComponent(existing.id)}&select=${GD_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}
  const rows=await db(c,`google_drive_connections?select=${GD_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',selected_items:[],...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null
}
async function deleteGoogleDriveConnection(c,accountId){await db(c,`google_drive_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
function googleDriveTokenDates(tokens){return{access_token_expires_at:new Date(Date.now()+(Number(tokens.expires_in)||3600)*1000).toISOString()}}
async function ensureGoogleDriveAccess(c,connection){
  const gdc=googleDriveConfig();if(!gdc)throw new Error('Google Drive is not configured.');
  const expiresAt=Date.parse(connection.access_token_expires_at||'');
  if(Number.isFinite(expiresAt)&&expiresAt>Date.now()+120000){return{connection,accessToken:decryptGoogleDriveToken(connection.access_token_encrypted,gdc.encryptionSecret)}}
  if(!connection.refresh_token_encrypted)throw Object.assign(new Error('Google Drive access expired. Reconnect Google Drive.'),{status:401});
  const refreshToken=decryptGoogleDriveToken(connection.refresh_token_encrypted,gdc.encryptionSecret);const tokens=await refreshGoogleDriveTokens(refreshToken);
  const updated=await saveGoogleDriveConnection(c,connection.account_id,{access_token_encrypted:encryptGoogleDriveToken(tokens.access_token,gdc.encryptionSecret),refresh_token_encrypted:connection.refresh_token_encrypted,...googleDriveTokenDates(tokens),scope:tokens.scope||connection.scope||gdc.scopes.join(' '),status:'connected',last_error:null});
  return{connection:updated,accessToken:tokens.access_token};
}
async function googleDriveConnectionAccess(c,accountId){const connection=await getGoogleDriveConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect Google Drive first.'),{status:409});return ensureGoogleDriveAccess(c,connection)}
function sanitizePickerItems(items){return(Array.isArray(items)?items:[]).map(item=>({id:clean(item?.id),name:clean(item?.name)||'Untitled',mimeType:clean(item?.mimeType),isFolder:Boolean(item?.isFolder||item?.mimeType==='application/vnd.google-apps.folder'),modifiedTime:item?.modifiedTime||null,createdTime:item?.createdTime||null,size:Number.isFinite(Number(item?.size))?Number(item.size):null,webViewLink:clean(item?.webViewLink),iconLink:clean(item?.iconLink),thumbnailLink:clean(item?.thumbnailLink),owners:Array.isArray(item?.owners)?item.owners.map(o=>({displayName:clean(o?.displayName),emailAddress:clean(o?.emailAddress)})):[],parents:Array.isArray(item?.parents)?item.parents.map(clean).filter(Boolean):[],trashed:Boolean(item?.trashed)})).filter(item=>item.id).slice(0,100)}


const MONDAY_SELECT='id,account_id,monday_account_id,monday_account_name,monday_account_slug,monday_user_id,monday_user_name,monday_user_email,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,scope,oauth_mode,status,last_synced_at,last_sync_error,created_at,updated_at';
async function getMondayConnection(c,accountId){const rows=await db(c,`monday_connections?select=${MONDAY_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicMondayConnection(row){return row?{connected:row.status==='connected',accountId:row.monday_account_id||'',accountName:row.monday_account_name||'',accountSlug:row.monday_account_slug||'',userId:row.monday_user_id||'',userName:row.monday_user_name||'',userEmail:row.monday_user_email||'',scope:row.scope||'',oauthMode:row.oauth_mode||'',status:row.status||'connected',lastSyncedAt:row.last_synced_at||null,lastSyncError:row.last_sync_error||'',updatedAt:row.updated_at||null}:{connected:false,accountId:'',accountName:'',accountSlug:'',userId:'',userName:'',userEmail:'',scope:'',oauthMode:'',status:'disconnected',lastSyncedAt:null,lastSyncError:''}}
async function saveMondayConnection(c,accountId,patch){const existing=await getMondayConnection(c,accountId),now=new Date().toISOString();if(existing){const rows=await db(c,`monday_connections?id=eq.${encodeURIComponent(existing.id)}&select=${MONDAY_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}const rows=await db(c,`monday_connections?select=${MONDAY_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null}
async function deleteMondayConnection(c,accountId){await db(c,`monday_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
async function ensureMondayAccess(c,connection){const mc=mondayConfig();if(!mc)throw new Error('monday.com is not configured.');const expiresAt=Date.parse(connection.access_token_expires_at||'');if(!Number.isFinite(expiresAt)||expiresAt>Date.now()+300000)return{connection,accessToken:decryptMondayToken(connection.access_token_encrypted,mc.encryptionSecret)};if(!connection.refresh_token_encrypted)throw Object.assign(new Error('monday.com access expired. Reconnect monday.com.'),{status:401});const refreshToken=decryptMondayToken(connection.refresh_token_encrypted,mc.encryptionSecret),tokens=await refreshMondayTokens(refreshToken),updated=await saveMondayConnection(c,connection.account_id,{access_token_encrypted:encryptMondayToken(tokens.access_token,mc.encryptionSecret),refresh_token_encrypted:encryptMondayToken(tokens.refresh_token,mc.encryptionSecret),access_token_expires_at:mondayAccessExpiry(tokens.access_token,tokens),scope:tokens.scope||connection.scope||'',oauth_mode:'oauth2.1',status:'connected',last_sync_error:null});return{connection:updated,accessToken:tokens.access_token}}
async function mondayConnectionAccess(c,accountId){const connection=await getMondayConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect monday.com first.'),{status:409});return ensureMondayAccess(c,connection)}
async function loadMondayDashboard(c,accountId){const{connection,accessToken}=await mondayConnectionAccess(c,accountId),warnings=[];let identity=null,workspaces=[],boards=[],users=[],items=[];const load=async(label,fn,fallback)=>{try{return await fn()}catch(error){warnings.push(`${label}: ${error.message}`);return fallback}};identity=await load('identity',()=>getMondayIdentity(accessToken),null);workspaces=await load('workspaces',()=>listMondayWorkspaces(accessToken),[]);boards=await load('boards',()=>listMondayBoards(accessToken),[]);users=await load('users',()=>listMondayUsers(accessToken),[]);for(const board of boards.slice(0,25)){if(items.length>=300)break;const batch=await load(`items ${board.name}`,()=>listMondayBoardItems(accessToken,board.id,board.name),[]);items.push(...batch.slice(0,Math.max(0,300-items.length)))}const synced=await saveMondayConnection(c,accountId,{monday_account_id:identity?.accountId||connection.monday_account_id||null,monday_account_name:identity?.accountName||connection.monday_account_name||null,monday_account_slug:identity?.accountSlug||connection.monday_account_slug||null,monday_user_id:identity?.userId||connection.monday_user_id||null,monday_user_name:identity?.userName||connection.monday_user_name||null,monday_user_email:identity?.userEmail||connection.monday_user_email||null,last_synced_at:new Date().toISOString(),last_sync_error:warnings.length?warnings.slice(0,12).join(' | '):null,status:'connected'});return{connection:publicMondayConnection(synced),identity,workspaces,boards,users,items:items.slice(0,300),warnings}}


const TEAMWORK_SELECT='id,account_id,installation_id,site_url,api_endpoint,company_id,company_name,region,connected_email,connected_name,access_token_encrypted,status,last_synced_at,last_sync_error,created_at,updated_at';
async function getTeamworkConnection(c,accountId){const rows=await db(c,`teamwork_connections?select=${TEAMWORK_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicTeamworkConnection(row){return row?{connected:row.status==='connected',installationId:row.installation_id||'',siteUrl:row.site_url||'',apiEndpoint:row.api_endpoint||'',companyId:row.company_id||'',companyName:row.company_name||'',region:row.region||'',connectedEmail:row.connected_email||'',connectedName:row.connected_name||'',status:row.status||'connected',lastSyncedAt:row.last_synced_at||null,lastSyncError:row.last_sync_error||'',updatedAt:row.updated_at||null}:{connected:false,installationId:'',siteUrl:'',apiEndpoint:'',companyId:'',companyName:'',region:'',connectedEmail:'',connectedName:'',status:'disconnected',lastSyncedAt:null,lastSyncError:''}}
async function saveTeamworkConnection(c,accountId,patch){const existing=await getTeamworkConnection(c,accountId),now=new Date().toISOString();if(existing){const rows=await db(c,`teamwork_connections?id=eq.${encodeURIComponent(existing.id)}&select=${TEAMWORK_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}const rows=await db(c,`teamwork_connections?select=${TEAMWORK_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null}
async function deleteTeamworkConnection(c,accountId){await db(c,`teamwork_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
async function teamworkConnectionAccess(c,accountId){const connection=await getTeamworkConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect Teamwork first.'),{status:409});const tc=teamworkConfig();if(!tc)throw new Error('Teamwork is not configured.');return{connection,accessToken:decryptTeamworkToken(connection.access_token_encrypted,tc.encryptionSecret)}}
async function loadTeamworkDashboard(c,accountId){
  const {connection,accessToken}=await teamworkConnectionAccess(c,accountId),warnings=[];
  const load=async(label,fn)=>{try{return await fn()}catch(error){warnings.push(`${label}: ${error.message}`);return[]}};
  const [projects,tasks,people,timeEntries]=await Promise.all([
    load('projects',()=>listTeamworkProjects(accessToken,connection.api_endpoint)),
    load('tasks',()=>listTeamworkTasks(accessToken,connection.api_endpoint)),
    load('people',()=>listTeamworkPeople(accessToken,connection.api_endpoint)),
    load('time',()=>listTeamworkTimeEntries(accessToken,connection.api_endpoint))
  ]);
  const synced=await saveTeamworkConnection(c,accountId,{last_synced_at:new Date().toISOString(),last_sync_error:warnings.length?warnings.slice(0,12).join(' | '):null,status:'connected'});
  return{connection:publicTeamworkConnection(synced),projects:projects.slice(0,250),tasks:tasks.slice(0,250),people:people.slice(0,250),timeEntries:timeEntries.slice(0,250),warnings};
}


const CLICKUP_SELECT='id,account_id,primary_workspace_id,primary_workspace_name,workspace_ids,workspace_names,access_token_encrypted,status,last_synced_at,last_sync_error,created_at,updated_at';
async function getClickUpConnection(c,accountId){const rows=await db(c,`clickup_connections?select=${CLICKUP_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicClickUpConnection(row){return row?{connected:row.status==='connected',primaryWorkspaceId:row.primary_workspace_id||'',primaryWorkspaceName:row.primary_workspace_name||'',workspaceIds:Array.isArray(row.workspace_ids)?row.workspace_ids:[],workspaceNames:Array.isArray(row.workspace_names)?row.workspace_names:[],status:row.status||'connected',lastSyncedAt:row.last_synced_at||null,lastSyncError:row.last_sync_error||'',updatedAt:row.updated_at||null}:{connected:false,primaryWorkspaceId:'',primaryWorkspaceName:'',workspaceIds:[],workspaceNames:[],status:'disconnected',lastSyncedAt:null,lastSyncError:''}}
async function saveClickUpConnection(c,accountId,patch){const existing=await getClickUpConnection(c,accountId),now=new Date().toISOString();if(existing){const rows=await db(c,`clickup_connections?id=eq.${encodeURIComponent(existing.id)}&select=${CLICKUP_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}const rows=await db(c,`clickup_connections?select=${CLICKUP_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null}
async function deleteClickUpConnection(c,accountId){await db(c,`clickup_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
async function clickUpConnectionAccess(c,accountId){const connection=await getClickUpConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect ClickUp first.'),{status:409});const cc=clickUpConfig();if(!cc)throw new Error('ClickUp is not configured.');return{connection,accessToken:decryptClickUpToken(connection.access_token_encrypted,cc.encryptionSecret)}}
async function loadClickUpDashboard(c,accountId){
  const {connection,accessToken}=await clickUpConnectionAccess(c,accountId),warnings=[];
  let workspaces=[];try{workspaces=await listClickUpWorkspaces(accessToken)}catch(error){warnings.push(`workspaces: ${error.message}`)}
  const spaces=[],folders=[],lists=[],tasks=[];
  for(const workspace of workspaces.slice(0,8)){
    let wsSpaces=[];try{wsSpaces=await listClickUpSpaces(accessToken,workspace.id)}catch(error){warnings.push(`spaces ${workspace.name}: ${error.message}`)}
    for(const space of wsSpaces.slice(0,20)){
      spaces.push({...space,workspaceId:workspace.id,workspaceName:workspace.name});
      let fs=[],direct=[];try{fs=await listClickUpFolders(accessToken,space.id)}catch(error){warnings.push(`folders ${space.name}: ${error.message}`)}
      try{direct=await listClickUpFolderlessLists(accessToken,space.id)}catch(error){warnings.push(`lists ${space.name}: ${error.message}`)}
      folders.push(...fs.map(x=>({...x,spaceName:space.name,workspaceName:workspace.name})));
      lists.push(...direct.map(x=>({...x,spaceName:space.name,workspaceId:workspace.id,workspaceName:workspace.name})));
      for(const folder of fs.slice(0,30)){
        let nested=[];try{nested=await listClickUpFolderLists(accessToken,folder.id)}catch(error){warnings.push(`folder lists ${folder.name}: ${error.message}`)}
        lists.push(...nested.map(x=>({...x,folderName:folder.name,spaceName:space.name,workspaceId:workspace.id,workspaceName:workspace.name})));
      }
    }
  }
  for(const list of lists.slice(0,30)){
    if(tasks.length>=250)break;
    try{const batch=await listClickUpTasks(accessToken,list.id,{page:0});tasks.push(...batch.slice(0,Math.max(0,250-tasks.length)).map(x=>({...x,listName:list.name,spaceName:list.spaceName||'',workspaceName:list.workspaceName||''})))}catch(error){warnings.push(`tasks ${list.name}: ${error.message}`)}
  }
  const workspaceIds=workspaces.map(x=>x.id),workspaceNames=workspaces.map(x=>x.name);
  const synced=await saveClickUpConnection(c,accountId,{primary_workspace_id:workspaceIds[0]||connection.primary_workspace_id,primary_workspace_name:workspaceNames[0]||connection.primary_workspace_name,workspace_ids:workspaceIds,workspace_names:workspaceNames,last_synced_at:new Date().toISOString(),last_sync_error:warnings.length?warnings.slice(0,12).join(' | '):null,status:'connected'});
  return{connection:publicClickUpConnection(synced),workspaces,spaces,folders,lists:lists.slice(0,250),tasks:tasks.slice(0,250),warnings};
}


const SLACK_SELECT='id,account_id,team_id,team_name,team_domain,enterprise_id,enterprise_name,bot_user_id,connected_user_id,access_token_encrypted,scopes,status,last_synced_at,last_sync_error,created_at,updated_at';
async function getSlackConnection(c,accountId){const rows=await db(c,`slack_connections?select=${SLACK_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicSlackConnection(row){return row?{connected:row.status==='connected',teamId:row.team_id||'',teamName:row.team_name||'',teamDomain:row.team_domain||'',enterpriseId:row.enterprise_id||'',enterpriseName:row.enterprise_name||'',botUserId:row.bot_user_id||'',connectedUserId:row.connected_user_id||'',scopes:Array.isArray(row.scopes)?row.scopes:[],status:row.status||'connected',lastSyncedAt:row.last_synced_at||null,lastSyncError:row.last_sync_error||'',updatedAt:row.updated_at||null}:{connected:false,teamId:'',teamName:'',teamDomain:'',enterpriseId:'',enterpriseName:'',botUserId:'',connectedUserId:'',scopes:[],status:'disconnected',lastSyncedAt:null,lastSyncError:''}}
async function saveSlackConnection(c,accountId,patch){const existing=await getSlackConnection(c,accountId),now=new Date().toISOString();if(existing){const rows=await db(c,`slack_connections?id=eq.${encodeURIComponent(existing.id)}&select=${SLACK_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}const rows=await db(c,`slack_connections?select=${SLACK_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null}
async function deleteSlackConnection(c,accountId){await db(c,`slack_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
async function slackConnectionAccess(c,accountId){const connection=await getSlackConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect Slack first.'),{status:409});const sc=slackConfig();if(!sc)throw new Error('Slack is not configured.');return{connection,accessToken:decryptSlackToken(connection.access_token_encrypted,sc.encryptionSecret)}}
async function loadSlackDashboard(c,accountId){const {connection,accessToken}=await slackConnectionAccess(c,accountId);const settled=await Promise.allSettled([listSlackUsers({accessToken,limit:200}),listSlackChannels({accessToken,limit:200}),slackAuthTest(accessToken)]),warnings=[];const users=settled[0].status==='fulfilled'?settled[0].value:(warnings.push(`users: ${settled[0].reason?.message||'Unable to load'}`),[]);const channels=settled[1].status==='fulfilled'?settled[1].value:(warnings.push(`channels: ${settled[1].reason?.message||'Unable to load'}`),[]);const auth=settled[2].status==='fulfilled'?settled[2].value:(warnings.push(`workspace: ${settled[2].reason?.message||'Unable to load'}`),{});const synced=await saveSlackConnection(c,accountId,{team_id:clean(auth.team_id)||connection.team_id,team_name:clean(auth.team)||connection.team_name,connected_user_id:clean(auth.user_id)||connection.connected_user_id,last_synced_at:new Date().toISOString(),last_sync_error:warnings.length?warnings.join(' | '):null,status:'connected'});return{connection:publicSlackConnection(synced),users,channels,warnings}}


const HS_SELECT='id,account_id,portal_id,hub_domain,connected_email,account_type,time_zone,company_currency,access_token_encrypted,refresh_token_encrypted,access_token_expires_at,scopes,status,last_synced_at,last_sync_error,created_at,updated_at';
async function getHubSpotConnection(c,accountId){const rows=await db(c,`hubspot_connections?select=${HS_SELECT}&account_id=eq.${encodeURIComponent(accountId)}&limit=1`);return Array.isArray(rows)?rows[0]||null:null}
function publicHubSpotConnection(row){return row?{connected:row.status==='connected',portalId:row.portal_id||null,hubDomain:row.hub_domain||'',connectedEmail:row.connected_email||'',accountType:row.account_type||'',timeZone:row.time_zone||'',companyCurrency:row.company_currency||'',scopes:Array.isArray(row.scopes)?row.scopes:[],status:row.status||'connected',lastSyncedAt:row.last_synced_at||null,lastSyncError:row.last_sync_error||'',updatedAt:row.updated_at||null}:{connected:false,portalId:null,hubDomain:'',connectedEmail:'',accountType:'',timeZone:'',companyCurrency:'',scopes:[],status:'disconnected',lastSyncedAt:null,lastSyncError:''}}
async function saveHubSpotConnection(c,accountId,patch){
  const existing=await getHubSpotConnection(c,accountId);const now=new Date().toISOString();
  if(existing){const rows=await db(c,`hubspot_connections?id=eq.${encodeURIComponent(existing.id)}&select=${HS_SELECT}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:now})});return Array.isArray(rows)?rows[0]||existing:existing}
  const rows=await db(c,`hubspot_connections?select=${HS_SELECT}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'connected',...patch,created_at:now,updated_at:now})});return Array.isArray(rows)?rows[0]||null:null
}
async function deleteHubSpotConnection(c,accountId){await db(c,`hubspot_connections?account_id=eq.${encodeURIComponent(accountId)}`,{method:'DELETE'});}
function hubSpotTokenDates(tokens){return{access_token_expires_at:new Date(Date.now()+(Number(tokens.expires_in)||1800)*1000).toISOString()}}
async function ensureHubSpotAccess(c,connection){
  const hsc=hubSpotConfig();if(!hsc)throw new Error('HubSpot is not configured.');
  const expiresAt=Date.parse(connection.access_token_expires_at||'');
  if(Number.isFinite(expiresAt)&&expiresAt>Date.now()+120000){return{connection,accessToken:decryptHubSpotToken(connection.access_token_encrypted,hsc.encryptionSecret)}}
  if(!connection.refresh_token_encrypted)throw Object.assign(new Error('HubSpot access expired. Reconnect HubSpot.'),{status:401});
  const refreshToken=decryptHubSpotToken(connection.refresh_token_encrypted,hsc.encryptionSecret);const tokens=await refreshHubSpotTokens(refreshToken);
  const updated=await saveHubSpotConnection(c,connection.account_id,{access_token_encrypted:encryptHubSpotToken(tokens.access_token,hsc.encryptionSecret),refresh_token_encrypted:tokens.refresh_token?encryptHubSpotToken(tokens.refresh_token,hsc.encryptionSecret):connection.refresh_token_encrypted,...hubSpotTokenDates(tokens),scopes:Array.isArray(tokens.scopes)?tokens.scopes:(Array.isArray(connection.scopes)?connection.scopes:hsc.scopes),status:'connected',last_sync_error:null});
  return{connection:updated,accessToken:tokens.access_token};
}
async function hubSpotConnectionAccess(c,accountId){const connection=await getHubSpotConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect HubSpot first.'),{status:409});return ensureHubSpotAccess(c,connection)}
async function loadHubSpotDashboard(c,accountId){
  const {connection,accessToken}=await hubSpotConnectionAccess(c,accountId);
  const settled=await Promise.allSettled([listHubSpotContacts({accessToken,limit:50}),listHubSpotCompanies({accessToken,limit:50}),listHubSpotDeals({accessToken,limit:50}),listHubSpotDealPipelines({accessToken})]);
  const names=['contacts','companies','deals','pipelines'];const data={};const warnings=[];
  settled.forEach((result,index)=>{if(result.status==='fulfilled')data[names[index]]=result.value;else{data[names[index]]=[];warnings.push(`${names[index]}: ${result.reason?.message||'Unable to load'}`)}});
  const synced=await saveHubSpotConnection(c,accountId,{last_synced_at:new Date().toISOString(),last_sync_error:warnings.length?warnings.join(' | '):null,status:'connected'});
  return{connection:publicHubSpotConnection(synced),...data,warnings};
}

async function getOrCreateCurrentRun(c,accountId){
  let rows=await db(c,`diagnostic_runs?select=id,account_id,status,is_current&account_id=eq.${encodeURIComponent(accountId)}&is_current=eq.true&limit=1`);
  if(Array.isArray(rows)&&rows[0])return rows[0];
  rows=await db(c,'diagnostic_runs?select=id,account_id,status,is_current',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({account_id:accountId,status:'in_progress',is_current:true})});
  return Array.isArray(rows)?rows[0]:rows;
}
async function saveQuickBooksEvidence(c,runId,evidenceType,data){
  const select='id,diagnostic_run_id,evidence_type,file_name,file_size_bytes,storage_path,mime_type,extraction_status,extraction_model,extraction_error,extracted_at,extracted_data,validation_status,created_at,updated_at';
  const rows=await db(c,`financial_evidence?select=${select}&diagnostic_run_id=eq.${encodeURIComponent(runId)}&evidence_type=eq.${encodeURIComponent(evidenceType)}&order=updated_at.desc&limit=1`);
  const existing=Array.isArray(rows)?rows[0]||null:null;const now=new Date().toISOString();
  const label={profit_loss:'Profit & Loss',balance_sheet:'Balance Sheet',ar_aging:'A/R Aging',client_revenue:'Client Revenue',service_revenue_mix:'Service Revenue Mix'}[evidenceType]||'Financial Evidence';
  const patch={file_name:`QuickBooks Online · ${label}`,file_size_bytes:null,storage_path:null,mime_type:'application/vnd.intuit.quickbooks.report+json',extraction_status:'processed',extraction_model:'quickbooks-online-api',extraction_error:null,extracted_at:now,extracted_data:data||{},validation_status:'verified',updated_at:now};
  if(existing){const updated=await db(c,`financial_evidence?id=eq.${encodeURIComponent(existing.id)}&select=${select}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});return Array.isArray(updated)?updated[0]||existing:existing}
  const created=await db(c,`financial_evidence?select=${select}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({diagnostic_run_id:runId,evidence_type:evidenceType,...patch,created_at:now})});return Array.isArray(created)?created[0]||null:null
}

async function syncQuickBooks(c,accountId){
  const connection=await getQuickBooksConnection(c,accountId);if(!connection||connection.status!=='connected')throw Object.assign(new Error('Connect QuickBooks before syncing.'),{status:409});
  const {connection:refreshed,accessToken}=await ensureQuickBooksAccess(c,connection);const realmId=refreshed.realm_id;
  try{
    const [pnl,balance,ar,clients,services]=await Promise.all([
      fetchProfitLossEvidence({realmId,accessToken}),fetchBalanceSheetEvidence({realmId,accessToken}),fetchArAgingEvidence({realmId,accessToken}),fetchClientRevenueEvidence({realmId,accessToken}),fetchServiceRevenueEvidence({realmId,accessToken})
    ]);
    if(pnl?.monthlyOperatingExpenses!==null&&pnl?.monthlyOperatingExpenses!==undefined&&balance?.monthlyOperatingExpenses==null)balance.monthlyOperatingExpenses=pnl.monthlyOperatingExpenses;
    const run=await getOrCreateCurrentRun(c,accountId);
    const evidence=[];
    evidence.push(await saveQuickBooksEvidence(c,run.id,'profit_loss',pnl));
    evidence.push(await saveQuickBooksEvidence(c,run.id,'balance_sheet',balance));
    evidence.push(await saveQuickBooksEvidence(c,run.id,'ar_aging',ar));
    evidence.push(await saveQuickBooksEvidence(c,run.id,'client_revenue',clients));
    evidence.push(await saveQuickBooksEvidence(c,run.id,'service_revenue_mix',services));
    const synced=await saveQuickBooksConnection(c,accountId,{status:'connected',last_synced_at:new Date().toISOString(),last_sync_error:null});
    return{connection:publicQuickBooksConnection(synced),evidence:evidence.filter(Boolean),warnings:[...(balance?.warnings||[]),...(services?.warnings||[])]};
  }catch(error){await saveQuickBooksConnection(c,accountId,{last_sync_error:error.message||'QuickBooks sync failed.'}).catch(()=>null);throw error}
}

const tokenHash=token=>crypto.createHash('sha256').update(String(token)).digest('hex');
function requestOrigin(req){const proto=clean(req.headers?.['x-forwarded-proto'])||'https';const host=clean(req.headers?.['x-forwarded-host']||req.headers?.host)||'app.creativecreatures.org';return `${proto}://${host}`}
async function beginPasswordReset(c,req,email){
  const rows=await db(c,`accounts?select=id,name,email,email_normalized,password_hash&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
  if(!account||!account.password_hash)return;
  const token=crypto.randomBytes(32).toString('hex');const hash=tokenHash(token);const expiresAt=new Date(Date.now()+60*60*1000).toISOString();
  await db(c,`accounts?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({password_reset_token_hash:hash,password_reset_expires_at:expiresAt,updated_at:new Date().toISOString()})});
  const origin=requestOrigin(req);const link=`${origin}/login/?reset=${encodeURIComponent(token)}&email=${encodeURIComponent(account.email||email)}`;const firstName=clean(account.name).split(/\s+/)[0]||'there';
  await sendEmail({
    to:account.email||email,
    subject:'Reset your Creative Creatures password',
    text:`Hi ${firstName},\n\nUse this secure link to reset your Creative Creatures password. The link expires in 60 minutes:\n${link}\n\nIf you did not request this reset, you can ignore this email.`,
    html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#171820"><h2 style="margin-bottom:12px">Reset your password</h2><p>Hi ${escapeHtml(firstName)},</p><p>Use the button below to choose a new password for your Creative Creatures account.</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2929ed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:700">Reset password</a></p><p style="font-size:13px;color:#667085">This link expires in 60 minutes. If you did not request a reset, you can ignore this email.</p></div>`
  });
}
async function completePasswordReset(c,token,password){
  if(password.length<10)throw Object.assign(new Error('Use at least 10 characters for your new password.'),{status:422});
  const hash=tokenHash(token);const now=new Date().toISOString();
  const rows=await db(c,`accounts?select=${SELECT}&password_reset_token_hash=eq.${encodeURIComponent(hash)}&password_reset_expires_at=gt.${encodeURIComponent(now)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
  if(!account)throw Object.assign(new Error('This password reset link is invalid or has expired.'),{status:400});
  const updated=await db(c,`accounts?id=eq.${encodeURIComponent(account.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({password_hash:hashPassword(password),password_set_at:now,password_reset_token_hash:null,password_reset_expires_at:null,updated_at:now})});
  return Array.isArray(updated)&&updated[0]?updated[0]:account;
}

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return json(res,204,{});
  const c=cfg();const secret=accountSessionSecret();if(!c||!secret)return json(res,503,{error:'Account authentication is not configured.'});
  try{
    if(req.method==='DELETE'){clearSessionCookie(res,'cc_account_session');return json(res,200,{success:true})}
    const session=currentSession(req,secret);
    const action=clean(req.query?.action);
    if(req.method==='GET'){

      if(action==='monday_connect'){if(!session)return json(res,401,{error:'Sign in before connecting monday.com.'});if(!mondayConfig())return json(res,503,{error:'monday.com environment variables are not configured.'});return json(res,200,{authorizationUrl:createMondayAuthorizationUrl(session.accountId)});}
      if(action==='monday_status'){if(!session)return json(res,401,{error:'Sign in before viewing monday.com status.'});const connection=await getMondayConnection(c,session.accountId);return json(res,200,{connection:publicMondayConnection(connection)});}

      if(action==='teamwork_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting Teamwork.'});
        if(!teamworkConfig())return json(res,503,{error:'Teamwork environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createTeamworkAuthorizationUrl(session.accountId)});
      }
      if(action==='teamwork_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing Teamwork status.'});
        const connection=await getTeamworkConnection(c,session.accountId);
        return json(res,200,{connection:publicTeamworkConnection(connection)});
      }

      if(action==='clickup_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting ClickUp.'});
        if(!clickUpConfig())return json(res,503,{error:'ClickUp environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createClickUpAuthorizationUrl(session.accountId)});
      }
      if(action==='clickup_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing ClickUp status.'});
        const connection=await getClickUpConnection(c,session.accountId);
        return json(res,200,{connection:publicClickUpConnection(connection)});
      }

      if(action==='slack_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting Slack.'});
        if(!slackConfig())return json(res,503,{error:'Slack environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createSlackAuthorizationUrl(session.accountId)});
      }
      if(action==='slack_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing Slack status.'});
        const connection=await getSlackConnection(c,session.accountId);
        return json(res,200,{connection:publicSlackConnection(connection)});
      }

      if(action==='hubspot_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting HubSpot.'});
        if(!hubSpotConfig())return json(res,503,{error:'HubSpot environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createHubSpotAuthorizationUrl(session.accountId)});
      }
      if(action==='hubspot_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing HubSpot status.'});
        const connection=await getHubSpotConnection(c,session.accountId);
        return json(res,200,{connection:publicHubSpotConnection(connection)});
      }
      if(action==='quickbooks_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting QuickBooks.'});
        if(!quickBooksConfig())return json(res,503,{error:'QuickBooks environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createQuickBooksAuthorizationUrl(session.accountId)});
      }
      if(action==='quickbooks_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing QuickBooks status.'});
        const connection=await getQuickBooksConnection(c,session.accountId);
        return json(res,200,{connection:publicQuickBooksConnection(connection),environment:quickBooksConfig()?.environment||null});
      }

      if(action==='google_drive_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting Google Drive.'});
        if(!googleDriveConfig())return json(res,503,{error:'Google Drive environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createGoogleDriveAuthorizationUrl(session.accountId)});
      }
      if(action==='google_drive_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing Google Drive status.'});
        const connection=await getGoogleDriveConnection(c,session.accountId);const config=googleDriveConfig();
        return json(res,200,{connection:publicGoogleDriveConnection(connection),picker:connection?.status==='connected'&&config?{apiKey:config.pickerApiKey,appId:config.projectNumber}:null});
      }
      if(action==='google_calendar_connect'){
        if(!session)return json(res,401,{error:'Sign in before connecting Google Calendar.'});
        if(!googleCalendarConfig())return json(res,503,{error:'Google Calendar environment variables are not configured.'});
        return json(res,200,{authorizationUrl:createGoogleCalendarAuthorizationUrl(session.accountId)});
      }
      if(action==='google_calendar_status'){
        if(!session)return json(res,401,{error:'Sign in before viewing Google Calendar status.'});
        const connection=await getGoogleCalendarConnection(c,session.accountId);
        return json(res,200,{connection:publicGoogleCalendarConnection(connection)});
      }
      if(!session)return json(res,401,{authenticated:false});
      const account=await findById(c,session.accountId);if(!account)return json(res,401,{authenticated:false});
      return json(res,200,{authenticated:true,account:pub(account)});
    }
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});
    const b=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});const bodyAction=clean(b.action);

    if(bodyAction==='forgot_password'){
      const email=lower(b.email);if(!email||!/^\S+@\S+\.\S+$/.test(email))return json(res,422,{error:'Enter a valid email address.'});
      try{await beginPasswordReset(c,req,email)}catch(error){console.error('password reset email error',error)}
      return json(res,200,{success:true,message:'If an account exists for that email, a password reset link has been sent.'});
    }
    if(bodyAction==='reset_password'){
      const token=clean(b.token),password=clean(b.password);if(!token||!password)return json(res,422,{error:'Reset token and new password are required.'});
      const account=await completePasswordReset(c,token,password);const sessionToken=signSession({role:'account',accountId:account.id,email:account.email},secret,30*24*60*60);setSessionCookie(res,'cc_account_session',sessionToken,30*24*60*60);
      return json(res,200,{success:true,authenticated:true,account:pub(account)});
    }

    if(bodyAction==='monday_callback'){if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect monday.com.'});const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'monday.com did not return the required authorization values.'});const statePayload=verifyMondayOAuthState(state,session.accountId);if(!statePayload)return json(res,403,{error:'monday.com authorization state is invalid or expired.'});const mc=mondayConfig(),tokens=await exchangeMondayCode(code,statePayload.codeVerifier);if(!tokens.access_token)return json(res,409,{error:'monday.com did not return an access token.'});let identity={};try{identity=await getMondayIdentity(tokens.access_token)}catch{}const saved=await saveMondayConnection(c,session.accountId,{monday_account_id:identity.accountId||null,monday_account_name:identity.accountName||null,monday_account_slug:identity.accountSlug||null,monday_user_id:identity.userId||null,monday_user_name:identity.userName||null,monday_user_email:identity.userEmail||null,access_token_encrypted:encryptMondayToken(tokens.access_token,mc.encryptionSecret),refresh_token_encrypted:tokens.refresh_token?encryptMondayToken(tokens.refresh_token,mc.encryptionSecret):null,access_token_expires_at:mondayAccessExpiry(tokens.access_token,tokens),scope:tokens.scope||'',oauth_mode:tokens.oauth_mode||'legacy',status:'connected',last_sync_error:null});return json(res,200,{connected:true,connection:publicMondayConnection(saved)});}
    if(bodyAction==='monday_dashboard'||bodyAction==='monday_sync'){if(!session)return json(res,401,{error:'Sign in before viewing monday.com data.'});const result=await loadMondayDashboard(c,session.accountId);return json(res,200,{success:true,...result});}
    if(bodyAction==='monday_disconnect'){if(!session)return json(res,401,{error:'Sign in before disconnecting monday.com.'});const connection=await getMondayConnection(c,session.accountId);if(connection){const mc=mondayConfig();if(mc){try{if(connection.refresh_token_encrypted)await revokeMondayToken(decryptMondayToken(connection.refresh_token_encrypted,mc.encryptionSecret),'refresh_token');else if(connection.oauth_mode==='oauth2.1'&&connection.access_token_encrypted)await revokeMondayToken(decryptMondayToken(connection.access_token_encrypted,mc.encryptionSecret),'access_token')}catch{}}}await deleteMondayConnection(c,session.accountId);return json(res,200,{success:true,connection:publicMondayConnection(null)});}

    if(bodyAction==='teamwork_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect Teamwork.'});
      const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'Teamwork did not return the required authorization values.'});
      if(!verifyTeamworkOAuthState(state,session.accountId))return json(res,403,{error:'Teamwork authorization state is invalid or expired.'});
      const tc=teamworkConfig(),tokens=await exchangeTeamworkCode(code);if(!tokens.access_token)return json(res,409,{error:'Teamwork did not return an access token.'});
      const installation=tokens.installation||{},apiEndpoint=clean(installation.apiEndPoint||installation.api_endpoint||installation.url);if(!apiEndpoint)return json(res,409,{error:'Teamwork did not return the customer API endpoint.'});
      let userInfo={};try{userInfo=await getTeamworkUserInfo(tokens.access_token)}catch{}
      const saved=await saveTeamworkConnection(c,session.accountId,{installation_id:clean(installation.id||userInfo.installation_id),site_url:clean(installation.url||userInfo.url||apiEndpoint),api_endpoint:apiEndpoint,company_id:clean(installation.company?.id),company_name:clean(installation.company?.name||installation.name),region:clean(installation.region),connected_email:clean(userInfo.email),connected_name:[userInfo.given_name,userInfo.family_name].filter(Boolean).join(' '),access_token_encrypted:encryptTeamworkToken(tokens.access_token,tc.encryptionSecret),status:'connected',last_sync_error:null});
      return json(res,200,{connected:true,connection:publicTeamworkConnection(saved)});
    }
    if(bodyAction==='teamwork_dashboard'||bodyAction==='teamwork_sync'){
      if(!session)return json(res,401,{error:'Sign in before viewing Teamwork data.'});
      const result=await loadTeamworkDashboard(c,session.accountId);return json(res,200,{success:true,...result});
    }
    if(bodyAction==='teamwork_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting Teamwork.'});
      await deleteTeamworkConnection(c,session.accountId);return json(res,200,{success:true,connection:publicTeamworkConnection(null)});
    }

    if(bodyAction==='clickup_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect ClickUp.'});
      const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'ClickUp did not return the required authorization values.'});
      if(!verifyClickUpOAuthState(state,session.accountId))return json(res,403,{error:'ClickUp authorization state is invalid or expired.'});
      const cc=clickUpConfig(),tokens=await exchangeClickUpCode(code);if(!tokens.access_token)return json(res,409,{error:'ClickUp did not return an access token.'});
      let workspaces=[];try{workspaces=await listClickUpWorkspaces(tokens.access_token)}catch{}
      const saved=await saveClickUpConnection(c,session.accountId,{primary_workspace_id:workspaces[0]?.id||'',primary_workspace_name:workspaces[0]?.name||'',workspace_ids:workspaces.map(x=>x.id),workspace_names:workspaces.map(x=>x.name),access_token_encrypted:encryptClickUpToken(tokens.access_token,cc.encryptionSecret),status:'connected',last_sync_error:null});
      return json(res,200,{connected:true,connection:publicClickUpConnection(saved)});
    }
    if(bodyAction==='clickup_dashboard'||bodyAction==='clickup_sync'){
      if(!session)return json(res,401,{error:'Sign in before viewing ClickUp data.'});
      const result=await loadClickUpDashboard(c,session.accountId);return json(res,200,{success:true,...result});
    }
    if(bodyAction==='clickup_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting ClickUp.'});
      await deleteClickUpConnection(c,session.accountId);
      return json(res,200,{success:true,connection:publicClickUpConnection(null)});
    }

    if(bodyAction==='slack_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect Slack.'});
      const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'Slack did not return the required authorization values.'});
      if(!verifySlackOAuthState(state,session.accountId))return json(res,403,{error:'Slack authorization state is invalid or expired.'});
      const sc=slackConfig(),tokens=await exchangeSlackCode(code);if(!tokens.access_token)return json(res,409,{error:'Slack did not return a bot access token.'});
      let auth={};try{auth=await slackAuthTest(tokens.access_token)}catch{}
      const saved=await saveSlackConnection(c,session.accountId,{team_id:clean(tokens.team?.id||auth.team_id),team_name:clean(tokens.team?.name||auth.team),enterprise_id:clean(tokens.enterprise?.id),enterprise_name:clean(tokens.enterprise?.name),bot_user_id:clean(tokens.bot_user_id),connected_user_id:clean(tokens.authed_user?.id||auth.user_id),access_token_encrypted:encryptSlackToken(tokens.access_token,sc.encryptionSecret),scopes:clean(tokens.scope).split(',').map(clean).filter(Boolean),status:'connected',last_sync_error:null});
      return json(res,200,{connected:true,connection:publicSlackConnection(saved)});
    }
    if(bodyAction==='slack_dashboard'||bodyAction==='slack_sync'){
      if(!session)return json(res,401,{error:'Sign in before viewing Slack data.'});const result=await loadSlackDashboard(c,session.accountId);return json(res,200,{success:true,...result});
    }
    if(bodyAction==='slack_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting Slack.'});const connection=await getSlackConnection(c,session.accountId);if(connection){const sc=slackConfig();if(sc){try{const token=decryptSlackToken(connection.access_token_encrypted,sc.encryptionSecret);await revokeSlackToken(token)}catch{}}await deleteSlackConnection(c,session.accountId)}return json(res,200,{success:true,connection:publicSlackConnection(null)});
    }


    if(bodyAction==='hubspot_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect HubSpot.'});
      const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'HubSpot did not return the required authorization values.'});
      if(!verifyHubSpotOAuthState(state,session.accountId))return json(res,403,{error:'HubSpot authorization state is invalid or expired.'});
      const hsc=hubSpotConfig();const tokens=await exchangeHubSpotCode(code);const existing=await getHubSpotConnection(c,session.accountId);
      if(!tokens.refresh_token&&!existing?.refresh_token_encrypted)return json(res,409,{error:'HubSpot did not return a refresh token. Reconnect HubSpot and approve access again.'});
      let metadata={};let details={};try{metadata=await introspectHubSpotToken(tokens.access_token,'access_token')}catch{}try{details=await getHubSpotAccountDetails({accessToken:tokens.access_token})}catch{}
      const saved=await saveHubSpotConnection(c,session.accountId,{portal_id:Number(details?.portalId||metadata?.hub_id||tokens?.hub_id)||null,hub_domain:clean(metadata?.hub_domain),connected_email:clean(metadata?.user),account_type:clean(details?.accountType),time_zone:clean(details?.timeZone),company_currency:clean(details?.companyCurrency),access_token_encrypted:encryptHubSpotToken(tokens.access_token,hsc.encryptionSecret),refresh_token_encrypted:tokens.refresh_token?encryptHubSpotToken(tokens.refresh_token,hsc.encryptionSecret):existing?.refresh_token_encrypted,...hubSpotTokenDates(tokens),scopes:Array.isArray(tokens.scopes)?tokens.scopes:hsc.scopes,status:'connected',last_sync_error:null});
      return json(res,200,{connected:true,connection:publicHubSpotConnection(saved)});
    }
    if(bodyAction==='hubspot_dashboard'||bodyAction==='hubspot_sync'){
      if(!session)return json(res,401,{error:'Sign in before viewing HubSpot data.'});
      const result=await loadHubSpotDashboard(c,session.accountId);return json(res,200,{success:true,...result});
    }
    if(bodyAction==='hubspot_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting HubSpot.'});const connection=await getHubSpotConnection(c,session.accountId);
      if(connection){const hsc=hubSpotConfig();if(hsc){try{const refresh=decryptHubSpotToken(connection.refresh_token_encrypted,hsc.encryptionSecret);await revokeHubSpotToken(refresh,'refresh_token')}catch{}}await deleteHubSpotConnection(c,session.accountId)}
      return json(res,200,{success:true,connection:publicHubSpotConnection(null)});
    }

    if(bodyAction==='quickbooks_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect QuickBooks.'});
      const code=clean(b.code),realmId=clean(b.realmId||b.realm_id),state=clean(b.state);
      if(!code||!realmId||!state)return json(res,422,{error:'QuickBooks did not return the required authorization values.'});
      if(!verifyQuickBooksOAuthState(state,session.accountId))return json(res,403,{error:'QuickBooks authorization state is invalid or expired.'});
      const qbc=quickBooksConfig();const tokens=await exchangeQuickBooksCode(code);
      let companyName='';try{const company=await getQuickBooksCompanyInfo({realmId,accessToken:tokens.access_token});companyName=clean(company?.CompanyName)}catch{}
      const saved=await saveQuickBooksConnection(c,session.accountId,{realm_id:realmId,company_name:companyName,access_token_encrypted:encryptQuickBooksToken(tokens.access_token,qbc.encryptionSecret),refresh_token_encrypted:encryptQuickBooksToken(tokens.refresh_token,qbc.encryptionSecret),...tokenDates(tokens),scope:tokens.scope||'com.intuit.quickbooks.accounting',status:'connected',last_sync_error:null});
      return json(res,200,{connected:true,connection:publicQuickBooksConnection(saved)});
    }
    if(bodyAction==='quickbooks_sync'){
      if(!session)return json(res,401,{error:'Sign in before syncing QuickBooks.'});
      const result=await syncQuickBooks(c,session.accountId);return json(res,200,{success:true,...result});
    }
    if(bodyAction==='quickbooks_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting QuickBooks.'});
      const connection=await getQuickBooksConnection(c,session.accountId);
      if(connection){const qbc=quickBooksConfig();if(qbc){try{const refresh=decryptQuickBooksToken(connection.refresh_token_encrypted,qbc.encryptionSecret);await revokeQuickBooksToken(refresh)}catch{}}await deleteQuickBooksConnection(c,session.accountId)}
      return json(res,200,{success:true,connection:publicQuickBooksConnection(null)});
    }



    if(bodyAction==='google_drive_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect Google Drive.'});
      const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'Google Drive did not return the required authorization values.'});
      if(!verifyGoogleDriveOAuthState(state,session.accountId))return json(res,403,{error:'Google Drive authorization state is invalid or expired.'});
      const gdc=googleDriveConfig();const tokens=await exchangeGoogleDriveCode(code);const existing=await getGoogleDriveConnection(c,session.accountId);
      if(!tokens.refresh_token&&!existing?.refresh_token_encrypted)return json(res,409,{error:'Google did not return a refresh token. Revoke Creative Creatures access in your Google Account and connect again.'});
      let identity={displayName:'',email:''};try{identity=await getGoogleDriveAbout({accessToken:tokens.access_token})}catch{}
      const saved=await saveGoogleDriveConnection(c,session.accountId,{connected_email:identity.email||existing?.connected_email||'',connected_name:identity.displayName||existing?.connected_name||'',access_token_encrypted:encryptGoogleDriveToken(tokens.access_token,gdc.encryptionSecret),refresh_token_encrypted:tokens.refresh_token?encryptGoogleDriveToken(tokens.refresh_token,gdc.encryptionSecret):existing?.refresh_token_encrypted,...googleDriveTokenDates(tokens),scope:tokens.scope||gdc.scopes.join(' '),selected_items:Array.isArray(existing?.selected_items)?existing.selected_items:[],status:'connected',last_error:null});
      return json(res,200,{connected:true,connection:publicGoogleDriveConnection(saved)});
    }
    if(bodyAction==='google_drive_picker_token'){
      if(!session)return json(res,401,{error:'Sign in before opening Google Drive.'});
      const {connection,accessToken}=await googleDriveConnectionAccess(c,session.accountId);const config=googleDriveConfig();
      return json(res,200,{connection:publicGoogleDriveConnection(connection),accessToken,picker:{apiKey:config.pickerApiKey,appId:config.projectNumber}});
    }
    if(bodyAction==='google_drive_save_selection'){
      if(!session)return json(res,401,{error:'Sign in before saving Google Drive files.'});
      const {connection,accessToken}=await googleDriveConnectionAccess(c,session.accountId);const requestedIds=[...new Set((Array.isArray(b.fileIds)?b.fileIds:[]).map(clean).filter(Boolean))].slice(0,100);
      if(!requestedIds.length)return json(res,422,{error:'Select at least one Google Drive file or folder.'});
      const refreshed=await getGoogleDriveFiles({accessToken,fileIds:requestedIds});const usable=refreshed.filter(item=>!item.unavailable&&!item.trashed);const current=sanitizePickerItems(connection.selected_items);const merged=new Map(current.map(item=>[item.id,item]));usable.forEach(item=>merged.set(item.id,item));
      const saved=await saveGoogleDriveConnection(c,session.accountId,{selected_items:[...merged.values()].slice(0,100),last_refreshed_at:new Date().toISOString(),last_error:null,status:'connected'});
      return json(res,200,{success:true,connection:publicGoogleDriveConnection(saved),unavailable:refreshed.filter(item=>item.unavailable)});
    }
    if(bodyAction==='google_drive_refresh'){
      if(!session)return json(res,401,{error:'Sign in before refreshing Google Drive files.'});
      const {connection,accessToken}=await googleDriveConnectionAccess(c,session.accountId);const ids=sanitizePickerItems(connection.selected_items).map(item=>item.id);const refreshed=ids.length?await getGoogleDriveFiles({accessToken,fileIds:ids}):[];const unavailable=refreshed.filter(item=>item.unavailable);const usable=sanitizePickerItems(refreshed.filter(item=>!item.unavailable&&!item.trashed));
      const saved=await saveGoogleDriveConnection(c,session.accountId,{selected_items:usable,last_refreshed_at:new Date().toISOString(),last_error:unavailable.length?`${unavailable.length} selected item(s) are no longer available to Creative Creatures.`:null,status:'connected'});
      return json(res,200,{success:true,connection:publicGoogleDriveConnection(saved),unavailable});
    }
    if(bodyAction==='google_drive_remove_item'){
      if(!session)return json(res,401,{error:'Sign in before updating Google Drive files.'});const fileId=clean(b.fileId);if(!fileId)return json(res,422,{error:'Google Drive file ID is required.'});
      const connection=await getGoogleDriveConnection(c,session.accountId);if(!connection)return json(res,409,{error:'Connect Google Drive first.'});const selected=sanitizePickerItems(connection.selected_items).filter(item=>item.id!==fileId);const saved=await saveGoogleDriveConnection(c,session.accountId,{selected_items:selected,last_refreshed_at:new Date().toISOString(),last_error:null});
      return json(res,200,{success:true,connection:publicGoogleDriveConnection(saved)});
    }
    if(bodyAction==='google_drive_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting Google Drive.'});const connection=await getGoogleDriveConnection(c,session.accountId);
      if(connection){const gdc=googleDriveConfig();if(gdc){try{const token=connection.refresh_token_encrypted?decryptGoogleDriveToken(connection.refresh_token_encrypted,gdc.encryptionSecret):decryptGoogleDriveToken(connection.access_token_encrypted,gdc.encryptionSecret);await revokeGoogleDriveToken(token)}catch{}}await deleteGoogleDriveConnection(c,session.accountId)}
      return json(res,200,{success:true,connection:publicGoogleDriveConnection(null)});
    }

    if(bodyAction==='google_calendar_callback'){
      if(!session)return json(res,401,{error:'Your Creative Creatures login expired. Sign in again and reconnect Google Calendar.'});
      const code=clean(b.code),state=clean(b.state);if(!code||!state)return json(res,422,{error:'Google Calendar did not return the required authorization values.'});
      if(!verifyGoogleCalendarOAuthState(state,session.accountId))return json(res,403,{error:'Google Calendar authorization state is invalid or expired.'});
      const gcc=googleCalendarConfig();const tokens=await exchangeGoogleCalendarCode(code);
      if(!tokens.refresh_token){const existing=await getGoogleCalendarConnection(c,session.accountId);if(!existing?.refresh_token_encrypted)return json(res,409,{error:'Google did not return a refresh token. Revoke Creative Creatures access in your Google Account and connect again.'});}
      const accessToken=tokens.access_token;const calendars=await listGoogleCalendars({accessToken});const primary=calendars.find(item=>item.primary)||calendars.find(item=>['owner','writer'].includes(item.accessRole))||calendars[0]||null;
      const existing=await getGoogleCalendarConnection(c,session.accountId);
      const saved=await saveGoogleCalendarConnection(c,session.accountId,{calendar_id:primary?.id||existing?.calendar_id||'primary',calendar_summary:primary?.summary||existing?.calendar_summary||'Primary calendar',connected_email:primary?.primary?primary.id:(existing?.connected_email||''),access_token_encrypted:encryptGoogleCalendarToken(accessToken,gcc.encryptionSecret),refresh_token_encrypted:tokens.refresh_token?encryptGoogleCalendarToken(tokens.refresh_token,gcc.encryptionSecret):existing?.refresh_token_encrypted,...googleTokenDates(tokens),scope:tokens.scope||gcc.scopes.join(' '),status:'connected',last_error:null});
      return json(res,200,{connected:true,connection:publicGoogleCalendarConnection(saved),calendars});
    }
    if(bodyAction==='google_calendar_list'){
      if(!session)return json(res,401,{error:'Sign in before viewing Google calendars.'});
      const {connection,accessToken}=await googleConnectionAccess(c,session.accountId);const calendars=await listGoogleCalendars({accessToken});
      return json(res,200,{connection:publicGoogleCalendarConnection(connection),calendars});
    }
    if(bodyAction==='google_calendar_select'){
      if(!session)return json(res,401,{error:'Sign in before selecting a Google calendar.'});
      const calendarId=clean(b.calendarId);if(!calendarId)return json(res,422,{error:'Choose a calendar.'});
      const {connection,accessToken}=await googleConnectionAccess(c,session.accountId);const calendars=await listGoogleCalendars({accessToken});const selected=calendars.find(item=>item.id===calendarId);if(!selected)return json(res,404,{error:'That Google calendar is no longer available.'});
      if(!['owner','writer'].includes(selected.accessRole))return json(res,403,{error:'Choose a Google calendar where you can create and edit events.'});
      const saved=await saveGoogleCalendarConnection(c,session.accountId,{calendar_id:selected.id,calendar_summary:selected.summary,connected_email:selected.primary?selected.id:connection.connected_email,status:'connected',last_error:null});
      return json(res,200,{success:true,connection:publicGoogleCalendarConnection(saved),calendars});
    }
    if(bodyAction==='google_calendar_events'){
      if(!session)return json(res,401,{error:'Sign in before viewing Google Calendar events.'});
      const {connection,accessToken}=await googleConnectionAccess(c,session.accountId);const events=await listGoogleCalendarEvents({accessToken,calendarId:connection.calendar_id||'primary',maxResults:b.maxResults||20,timeMin:clean(b.timeMin)||undefined,timeMax:clean(b.timeMax)||undefined});
      return json(res,200,{connection:publicGoogleCalendarConnection(connection),events});
    }
    if(bodyAction==='google_calendar_create_event'){
      if(!session)return json(res,401,{error:'Sign in before creating Calendar events.'});
      const {connection,accessToken}=await googleConnectionAccess(c,session.accountId);const event=await createGoogleCalendarEvent({accessToken,calendarId:connection.calendar_id||'primary',event:b.event||{}});
      return json(res,200,{success:true,event});
    }
    if(bodyAction==='google_calendar_update_event'){
      if(!session)return json(res,401,{error:'Sign in before updating Calendar events.'});
      const {connection,accessToken}=await googleConnectionAccess(c,session.accountId);const event=await updateGoogleCalendarEvent({accessToken,calendarId:connection.calendar_id||'primary',eventId:clean(b.eventId),event:b.event||{}});
      return json(res,200,{success:true,event});
    }
    if(bodyAction==='google_calendar_delete_event'){
      if(!session)return json(res,401,{error:'Sign in before deleting Calendar events.'});
      const {connection,accessToken}=await googleConnectionAccess(c,session.accountId);await deleteGoogleCalendarEvent({accessToken,calendarId:connection.calendar_id||'primary',eventId:clean(b.eventId)});
      return json(res,200,{success:true});
    }
    if(bodyAction==='google_calendar_disconnect'){
      if(!session)return json(res,401,{error:'Sign in before disconnecting Google Calendar.'});
      const connection=await getGoogleCalendarConnection(c,session.accountId);
      if(connection){const gcc=googleCalendarConfig();if(gcc){try{const token=connection.refresh_token_encrypted?decryptGoogleCalendarToken(connection.refresh_token_encrypted,gcc.encryptionSecret):decryptGoogleCalendarToken(connection.access_token_encrypted,gcc.encryptionSecret);await revokeGoogleCalendarToken(token)}catch{}}await deleteGoogleCalendarConnection(c,session.accountId)}
      return json(res,200,{success:true,connection:publicGoogleCalendarConnection(null)});
    }

    const email=lower(b.email),password=clean(b.password);
    if(!email||!password)return json(res,422,{error:'Email and password are required.'});
    const rows=await db(c,`accounts?select=${SELECT}&email_normalized=eq.${encodeURIComponent(email)}&limit=1`);const account=Array.isArray(rows)?rows[0]:null;
    if(!account||!account.password_hash||!verifyPassword(password,account.password_hash))return json(res,401,{error:'Invalid email or password.'});
    const token=signSession({role:'account',accountId:account.id,email:account.email},secret,30*24*60*60);setSessionCookie(res,'cc_account_session',token,30*24*60*60);
    return json(res,200,{authenticated:true,account:pub(account)});
  }catch(e){console.error('account auth error',e);const status=[400,401,403,404,409,422].includes(Number(e.status))?Number(e.status):500;return json(res,status,{error:e.message||'Unable to process the account request right now.',code:e.code||'ACCOUNT_AUTH_ERROR'})}
}
