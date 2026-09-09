import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot=path.dirname(fileURLToPath(import.meta.url));
const payloadRoot=path.join(projectRoot,'payload');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backupRoot=path.join(projectRoot,`.cc-breakthrough-accelerator-phase3-backup-${stamp}`);
const migration='supabase/migrations/20260905010000_breakthrough_accelerator_phase3.sql';
const manifest=['api/account-auth.js','accelerator/index.html','public/accelerator/accelerator-live.js','public/accelerator/accelerator-workspace.css',migration];
const required=new Set(['api/account-auth.js','accelerator/index.html','public/accelerator/accelerator-live.js','public/accelerator/accelerator-workspace.css']);
const changed=[];

for(const file of manifest){
  const source=path.join(payloadRoot,file),target=path.join(projectRoot,file);
  if(!fs.existsSync(source))throw new Error(`Package payload is missing: ${file}`);
  if(required.has(file)&&!fs.existsSync(target))throw new Error(`Required Phase 2 file was not found: ${file}`);
  if(file==='api/account-auth.js'){
    const currentApi=fs.readFileSync(target,'utf8');
    if(!currentApi.includes('accelerator_save_workspace'))throw new Error('Breakthrough Accelerator Phase 2 must be applied before Phase 3.');
    if(!currentApi.includes('GHL CRM'))throw new Error('This revised package expects the current GHL CRM-labelled backend. Apply it only to the project version supplied for this compatibility review.');
  }
  const existed=fs.existsSync(target);
  if(existed){const backup=path.join(backupRoot,file);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(target,backup)}
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);changed.push({file,existed});
}

const restore=()=>{for(const item of changed.reverse()){const target=path.join(projectRoot,item.file),backup=path.join(backupRoot,item.file);if(item.existed&&fs.existsSync(backup))fs.copyFileSync(backup,target);else if(!item.existed&&fs.existsSync(target))fs.rmSync(target,{force:true})}};

try{
  for(const file of ['api/account-auth.js','public/accelerator/accelerator-live.js'])execFileSync(process.execPath,['--check',path.join(projectRoot,file)],{stdio:'pipe'});
  const api=fs.readFileSync(path.join(projectRoot,'api/account-auth.js'),'utf8'),html=fs.readFileSync(path.join(projectRoot,'accelerator/index.html'),'utf8'),sql=fs.readFileSync(path.join(projectRoot,migration),'utf8').toLowerCase();
  for(const value of ['accelerator_save_plan','accelerator_set_plan_status','accountid'])if(!api.toLowerCase().includes(value.toLowerCase()))throw new Error(`Accelerator Phase 3 API is missing: ${value}`);
  for(const value of ['planDialog','accPlanOutput','oneYearVision','priorityRows'])if(!html.includes(value))throw new Error(`Accelerator Phase 3 UI is missing: ${value}`);
  for(const value of ['accelerator_plans','enable row level security','revoke all','service_role','account_id uuid not null unique'])if(!sql.includes(value))throw new Error(`Accelerator Phase 3 migration is missing: ${value}`);
  const apiCount=fs.readdirSync(path.join(projectRoot,'api')).filter(name=>/\.(?:js|ts)$/.test(name)).length;
  if(apiCount>12)throw new Error(`The project has ${apiCount} top-level Vercel API files; Hobby allows 12.`);
  console.log('Breakthrough Accelerator Phase 3 (revised for current UI and GHL CRM) applied.');
  console.log('JavaScript syntax validation: PASS');
  console.log(`Deployable API files: ${apiCount}`);
  console.log(`Supabase migration: ${migration}`);
  console.log(`Backup: ${backupRoot}`);
  console.log('Next: run the Supabase migration, then npm run build.');
  console.log('Changed / added:');manifest.forEach(file=>console.log(`  ${file}`));
}catch(error){restore();console.error('Breakthrough Accelerator Phase 3 failed. Original files were restored.');throw error}
