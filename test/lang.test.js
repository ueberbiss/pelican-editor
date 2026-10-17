const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'pelican-editor.html'),'utf8');
function boot(navLang, ls) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) { Object.defineProperty(w.navigator, 'language', { value: navLang }); Object.defineProperty(w.navigator, 'languages', { value: [navLang] }); if (ls) w.localStorage.setItem('pme.lang', ls); } });
  return dom.window;
}
const txt = (w, id) => w.document.getElementById(id).textContent;
// default from browser language
let w = boot('de-DE');
assert.strictEqual(w.document.documentElement.lang, 'de');
assert.strictEqual(txt(w, 'btn-open'), 'Öffnen');
assert.strictEqual(w.document.getElementById('ui-lang').value, 'de');
assert.strictEqual(w.document.querySelector('.tname').textContent, 'unbenannt.md');
assert.ok(w.document.getElementById('empty-hint').innerHTML.includes('<code>tags:</code>'));
assert.ok(w.document.getElementById('ed').placeholder.startsWith('Markdown hier'));
assert.ok(w.document.getElementById('btn-undo').title.includes('Strg'));
// switch to English at runtime, with a Status field present (chips are localised)
const ed = w.document.getElementById('ed');
ed.value = 'Date: 2026\nStatus: draft\n\nx'; ed.dispatchEvent(new w.Event('input', { bubbles: true }));
assert.ok([...w.document.querySelectorAll('.quick .chip')].some(b => b.textContent === 'heute'));
const sel = w.document.getElementById('ui-lang'); sel.value = 'en'; sel.dispatchEvent(new w.Event('change'));
assert.strictEqual(w.document.documentElement.lang, 'en');
assert.strictEqual(txt(w, 'btn-open'), 'Open');
assert.strictEqual(txt(w, 'btn-add'), '+ Field');
assert.ok([...w.document.querySelectorAll('.quick .chip')].some(b => b.textContent === 'today'));
assert.ok(w.document.getElementById('btn-undo').title.includes('Ctrl'));
assert.strictEqual(w.document.getElementById('ed').value, 'Date: 2026\nStatus: draft\n\nx', 'content untouched');
assert.strictEqual(w.localStorage.getItem('pme.lang'), 'en');
// persisted choice wins over browser language; non-de browsers default to en
w = boot('de-DE', 'en'); assert.strictEqual(txt(w, 'btn-new'), 'New');
w = boot('fr-FR'); assert.strictEqual(txt(w, 'btn-new'), 'New');
// confirm text localised
let msg; w.confirm = m => (msg = m, true);
const e2 = w.document.getElementById('ed'); e2.value = 'a: b'; e2.dispatchEvent(new w.Event('input', { bubbles: true }));
w.document.querySelector('[data-close]').click();
assert.strictEqual(msg, '“untitled.md” has unsaved changes. Close anyway?');
console.log('LANG TESTS OK');
