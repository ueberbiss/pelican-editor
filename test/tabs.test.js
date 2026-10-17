const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'pelican-editor.html'),'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
w.Blob.prototype.text = function () { return new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(this); }); };
let confirms = []; w.confirm = m => { confirms.push(m); return true; };
const ed = d.getElementById('ed');
const key = (k, o={}) => d.dispatchEvent(new w.KeyboardEvent('keydown', {key:k, ctrlKey:true, bubbles:true, ...o}));
const type = t => { ed.value = t; ed.dispatchEvent(new w.Event('input', {bubbles:true})); };
const tabs = () => [...d.querySelectorAll('#tabs .tab')];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function openFiles(list) {
  const inp = d.getElementById('fallback-input');
  Object.defineProperty(inp, 'files', { value: list.map(([n, t]) => new w.File([t], n)), configurable: true });
  inp.dispatchEvent(new w.Event('change'));
  // files are read asynchronously; wait until all tabs exist (or time out) instead of a fixed delay
  const want = list.length;
  for (let i = 0; i < 100 && tabs().length < want; i++) await sleep(20);
  await sleep(50);
}
(async () => {
  assert.strictEqual(tabs().length, 1);
  await openFiles([['a.md', 'Title: A\n\nbody a'], ['b.md', 'Title: B\r\nTags: x\r\n\r\nbody b']]);
  assert.strictEqual(tabs().length, 2, 'pristine tab replaced, 2 tabs');
  assert.deepStrictEqual(tabs().map(t => t.title), ['a.md', 'b.md']);
  assert.ok(tabs()[1].classList.contains('on'));
  assert.strictEqual(d.querySelectorAll('#fields .field').length, 2);
  // edit b, switch to a, check isolation
  type('Title: B2\nTags: x\n\nbody b');
  assert.strictEqual(tabs()[1].querySelector('.tdot').style.visibility, 'visible');
  tabs()[0].click();
  assert.strictEqual(ed.value, 'Title: A\n\nbody a');
  assert.strictEqual(d.querySelectorAll('#fields .field').length, 1);
  assert.strictEqual(d.getElementById('btn-undo').disabled, true, 'a has own history');
  tabs()[1].click();
  assert.strictEqual(ed.value, 'Title: B2\nTags: x\n\nbody b');
  assert.strictEqual(d.getElementById('btn-undo').disabled, false);
  key('z');
  assert.ok(ed.value.startsWith('Title: B\n'), 'undo in b');
  // new tab
  d.getElementById('btn-new').click();
  assert.strictEqual(tabs().length, 3);
  // close dirty-free untitled
  tabs()[2].querySelector('[data-close]').click();
  assert.strictEqual(tabs().length, 2);
  assert.strictEqual(confirms.length, 0);
  // dirty close asks
  tabs()[0].click(); type('Title: A!\n\nx');
  tabs()[0].querySelector('[data-close]').click();
  assert.strictEqual(confirms.length, 1);
  assert.strictEqual(tabs().length, 1);
  assert.strictEqual(tabs()[0].title, 'b.md');
  assert.ok(ed.value.includes('Title: B'));
  // close last -> fresh untitled
  tabs()[0].querySelector('[data-close]').click();
  assert.strictEqual(tabs().length, 1);
  assert.strictEqual(tabs()[0].title, 'untitled.md');
  console.log('TAB TESTS OK');
})().catch(e => { console.error(e); process.exit(1); });
