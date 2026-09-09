import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const sourceRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'payload');
const targetRoot = process.cwd();
const files = [
  'api/account-auth.js',
  'api/accounts.js',
  'api/leadership.js',
  'api/payment-confirmation.js',
  'payment/index.html',
  'signup/lookup/index.html',
  'public/portal/account-client.js',
  'public/portal/app-shell.js',
  'public/shared/topnav.js',
  'public/shared/workspace-access.js',
  'public/monitor/monitor.js',
  'public/monitor/monitor.css',
  'supabase/migrations/20260908020000_account_access_users_ai.sql'
];

if (!fs.existsSync(path.join(targetRoot, 'package.json')) || !fs.existsSync(path.join(targetRoot, 'api', 'account-auth.js'))) {
  throw new Error('Run this script from the Creative Creatures project root.');
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(targetRoot, `.cc-account-access-users-ai-backup-${stamp}`);

for (const relative of files) {
  const source = path.join(sourceRoot, relative);
  const target = path.join(targetRoot, relative);
  if (!fs.existsSync(source)) throw new Error(`Patch payload is missing: ${relative}`);
  if (fs.existsSync(target)) {
    const backup = path.join(backupRoot, relative);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(target, backup);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

for (const relative of files.filter((file) => file.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', path.join(targetRoot, relative)], { stdio: 'inherit' });
}

console.log('Account access, agency users, and Ask Creature applied.');
console.log('JavaScript syntax validation: PASS');
console.log('Supabase migration: supabase/migrations/20260908020000_account_access_users_ai.sql');
console.log(`Backup: ${backupRoot}`);
console.log('Next: run the migration in the production Supabase project, then npm.cmd run build.');
