import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../public/portal/archetype-pdf.js', import.meta.url), 'utf8');
const slugs = ['firefighter-founder','creative-wizard','people-pleaser','control-builder','vision-chaser'];
function setup(report, override, bad = false) {
  const calls = [], opened = [];
  const popup = { document: { body: { style: {} } }, location: { replace: url => opened.push(url) }, close() { this.closed = true; } };
  const window = { CC_ARCHETYPE_REPORT_OVERRIDE: override, open: () => popup, location: {} };
  const context = { window, localStorage: { getItem: key => key === 'ownerArchetypeReportData' ? JSON.stringify(report) : null },
    fetch: async url => { calls.push(url); assert.ok(url.startsWith('/reports/owner-archetypes/')); const b = bad ? Buffer.from('<html>') : readFileSync(new URL('../public'+url, import.meta.url)); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) }; },
    Blob, TextDecoder, Uint8Array, URL: { createObjectURL: () => 'blob:report', revokeObjectURL() {} }, setTimeout() {}, console: { warn() {} } };
  vm.runInNewContext(code, context);
  return { api: window.CCArchetypePDF, window, calls, opened, popup };
}
for (let i=0;i<5;i++) test(`saved ${'ABCDE'[i]} opens ${slugs[i]} without remote API`, async () => {
  const x=setup({archetypeKey:'ABCDE'[i],answers:{}});
  assert.equal(await x.api.ensureReportToken(),null);
  assert.equal(x.calls.length,0);
  assert.equal(await x.api.openPdf(),true);
  assert.deepEqual(x.calls,[`/reports/owner-archetypes/${slugs[i]}.pdf`]);
  assert.deepEqual(x.opened,['blob:report']);
});
test('admin override wins over current browser account; consecutive reports do not reuse result', async () => {
 const x=setup({archetypeKey:'A',answers:{}},{archetypeKey:'E',answers:{}});
 assert.equal(await x.api.openPdf(),true);
 x.window.CC_ARCHETYPE_REPORT_OVERRIDE={archetypeKey:'C',answers:{}};
 assert.equal(await x.api.openPdf(),true);
 assert.deepEqual(x.calls,['/reports/owner-archetypes/vision-chaser.pdf','/reports/owner-archetypes/people-pleaser.pdf']);
});
test('unknown result cannot silently open another archetype',async()=>{
 const x=setup({archetypeKey:'unknown',answers:{}}); assert.equal(await x.api.openPdf(),false); assert.equal(x.calls.length,0); assert.equal(x.popup.closed,true);
});
test('HTML fallback cannot be presented as a PDF',async()=>{
 const x=setup({archetypeKey:'B',answers:{}},null,true);assert.equal(await x.api.openPdf(),false);assert.equal(x.opened.length,0);
});
