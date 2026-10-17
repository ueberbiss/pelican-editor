const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'pelican-editor.html'),'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const assert = require('assert');
const ed = d.getElementById('ed');
const key = (k, o={}) => d.dispatchEvent(new w.KeyboardEvent('keydown', {key:k, ctrlKey:true, bubbles:true, ...o}));
const type = t => { ed.value = t; ed.dispatchEvent(new w.Event('input', {bubbles:true})); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  type('Title: a'); await sleep(800);
  type('Title: ab\n\nx'); await sleep(800);
  // add field via UI
  d.getElementById('btn-add').click();
  const chip = [...d.querySelectorAll('#chips .chip')].find(b => b.dataset.k === 'Tags');
  chip.click();
  assert.ok(ed.value.includes('Tags:'));
  assert.strictEqual(d.querySelectorAll('#fields .field').length, 2);
  key('z');
  assert.ok(!ed.value.includes('Tags:'), 'undo add field');
  assert.strictEqual(d.querySelectorAll('#fields .field').length, 1);
  key('z');
  assert.strictEqual(ed.value, 'Title: a', 'undo typing burst');
  assert.strictEqual(d.getElementById('btn-undo').disabled, false);
  key('z'); // back to empty
  assert.strictEqual(ed.value, '');
  assert.strictEqual(d.getElementById('btn-undo').disabled, true);
  assert.strictEqual(d.getElementById('dirty').className, '', 'clean after undoing all');
  key('y'); key('y'); key('z', {shiftKey:true});
  assert.ok(ed.value.includes('Tags:'), 'redo');
  console.log('UNDO TESTS OK');
})().catch(e => { console.error(e); process.exit(1); });
