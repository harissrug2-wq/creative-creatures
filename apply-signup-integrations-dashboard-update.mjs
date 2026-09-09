import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot=path.dirname(fileURLToPath(import.meta.url));
const payloadRoot=path.join(projectRoot,'payload');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupRoot=path.join(projectRoot,`.cc-signup-integrations-dashboard-backup-${stamp}`);
const manifest=['signup/index.html','integrations/index.html','public/monitor/monitor.js','public/portal/app-shell.js','public/portal/diagnostic-state.js','public/portal/signup.css'];
const changed=[];

for(const file of manifest){
  const source=path.join(payloadRoot,file),target=path.join(projectRoot,file);
  if(!fs.existsSync(source))throw new Error(`Package payload is missing: ${file}`);
  if(!fs.existsSync(target))throw new Error(`Required project file was not found: ${file}`);
  const backup=path.join(backupRoot,file);
  fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(target,backup);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);changed.push(file);
}

const restore=()=>changed.reverse().forEach(file=>fs.copyFileSync(path.join(backupRoot,file),path.join(projectRoot,file)));
try{
  for(const file of ['public/monitor/monitor.js','public/portal/app-shell.js','public/portal/diagnostic-state.js'])execFileSync(process.execPath,['--check',path.join(projectRoot,file)],{stdio:'pipe'});
  const integrations=fs.readFileSync(path.join(projectRoot,'integrations/index.html'),'utf8');
  const inline=integrations.match(/<script>([\s\S]*)<\/script>/);
  if(!inline)throw new Error('Integrations inline application script was not found.');
  Function(inline[1]);
  for(const value of ["'CRM':","'Bookkeeping':","'Project Management':","'Communications':","'Calendar & Meetings':","'Central Drive':","'HR & People':","'Billing':","'IT & Security':",'categoryRequestSave'])if(!integrations.includes(value))throw new Error(`Integrations dashboard is missing: ${value}`);
  console.log('Signup and Integrations Dashboard update applied.');
  console.log('JavaScript syntax validation: PASS');
  console.log('No Supabase migration and no new API function were added.');
  console.log(`Backup: ${backupRoot}`);
  console.log('Next: npm.cmd run build');
  console.log('Changed:');manifest.forEach(file=>console.log(`  ${file}`));
}catch(error){restore();console.error('Update failed. Original files were restored.');throw error}
