import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const pdfs = [
  'The Firefighter Founder Archetype.pdf',
  'The Creative Wizard Archetype.pdf',
  'The People Pleaser Archetype.pdf',
  'The Control Builder Archetype.pdf',
  'The Vision Chaser Archetype.pdf'
];

const dummyDir = path.join(process.cwd(), 'supabase', 'tests', 'dummy_pdfs');
if (!fs.existsSync(dummyDir)) {
  fs.mkdirSync(dummyDir, { recursive: true });
}

for (const pdf of pdfs) {
  const filePath = path.join(dummyDir, pdf);
  fs.writeFileSync(filePath, 'dummy pdf content for ' + pdf);
}

console.log('Uploading PDFs via Supabase CLI...');
try {
  execSync('npx supabase storage cp --linked -r supabase/tests/dummy_pdfs ss:///archetype_reports', { stdio: 'inherit' });
  console.log('Upload successful.');
} catch (err) {
  console.error('Upload failed', err);
}
