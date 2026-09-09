import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const payloadRoot = path.join(projectRoot, 'payload');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.join(projectRoot, `.cc-leadership-l10-calendar-phase2-backup-${stamp}`);
const migration = 'supabase/migrations/20260908010000_leadership_l10_calendar.sql';
const manifest = [
  'api/leadership.js',
  'public/monitor/leadership-live.js',
  'public/monitor/leadership-live.css',
  migration
];
const required = new Set(manifest.slice(0, 3));
const changed = [];

for (const file of manifest) {
  const source = path.join(payloadRoot, file);
  const target = path.join(projectRoot, file);
  if (!fs.existsSync(source)) throw new Error(`Package payload is missing: ${file}`);
  if (required.has(file) && !fs.existsSync(target)) throw new Error(`Required Leadership Phase 1 file was not found: ${file}`);
  if (file === 'api/leadership.js') {
    const current = fs.readFileSync(target, 'utf8');
    if (!current.includes('leadership_meetings')) throw new Error('Agency Leadership Phase 1 must be applied before this package.');
  }
  if (file === 'public/monitor/leadership-live.js') {
    const current = fs.readFileSync(target, 'utf8');
    if (!current.includes("'/api/leadership'")) throw new Error('The live Agency Leadership workspace was not found.');
  }
  const existed = fs.existsSync(target);
  if (existed) {
    const backup = path.join(backupRoot, file);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(target, backup);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  changed.push({ file, existed });
}

const restore = () => {
  for (const item of changed.reverse()) {
    const target = path.join(projectRoot, item.file);
    const backup = path.join(backupRoot, item.file);
    if (item.existed && fs.existsSync(backup)) fs.copyFileSync(backup, target);
    else if (!item.existed && fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
};

try {
  for (const file of ['api/leadership.js', 'public/monitor/leadership-live.js']) {
    execFileSync(process.execPath, ['--check', path.join(projectRoot, file)], { stdio: 'pipe' });
  }
  const api = fs.readFileSync(path.join(projectRoot, 'api/leadership.js'), 'utf8');
  const ui = fs.readFileSync(path.join(projectRoot, 'public/monitor/leadership-live.js'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'public/monitor/leadership-live.css'), 'utf8');
  const sql = fs.readFileSync(path.join(projectRoot, migration), 'utf8').toLowerCase();
  for (const value of ['sync_calendar_meeting', 'delete_leadership_item', 'calendar_event_id', 'agenda']) {
    if (!api.includes(value)) throw new Error(`Leadership API is missing: ${value}`);
  }
  for (const value of ['syncCalendarMeetings', 'Segue — Good News', 'IDS — Identify, Discuss, Solve', 'Save meeting']) {
    if (!ui.includes(value)) throw new Error(`Leadership L10 workspace is missing: ${value}`);
  }
  for (const value of ['lead-modal-l10', 'lead-l10-section', '@media(max-width:760px)']) {
    if (!css.includes(value)) throw new Error(`Leadership responsive styles are missing: ${value}`);
  }
  for (const value of ['alter table public.leadership_meetings', 'calendar_event_id', 'create unique index', 'agenda jsonb']) {
    if (!sql.includes(value)) throw new Error(`Leadership migration is missing: ${value}`);
  }
  console.log('Leadership L10 + Google Calendar Phase 2 applied.');
  console.log('JavaScript syntax validation: PASS');
  console.log(`Supabase migration: ${migration}`);
  console.log(`Backup: ${backupRoot}`);
  console.log('Next: run the Supabase migration, then npm run build.');
  console.log('Changed / added:');
  manifest.forEach(file => console.log(`  ${file}`));
} catch (error) {
  restore();
  console.error('Leadership L10 + Google Calendar Phase 2 failed. Original files were restored.');
  throw error;
}
