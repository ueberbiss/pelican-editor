// Runtime language packs, placeholders, safe HTML, RTL, build output.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pelican-editor.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot(stored) {
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w.navigator, 'language', { value: 'en-US' });
      Object.defineProperty(w.navigator, 'languages', { value: ['en-US'] });
      w.Blob.prototype.text = function () { return new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(this); }); };
      Object.entries(stored || {}).forEach(([k, v]) => w.localStorage.setItem(k, v));
    } });
  return dom.window;
}
async function loadPack(w, name, obj, code) {
  w.prompt = () => code;
  const inp = w.document.getElementById('pack-input');
  Object.defineProperty(inp, 'files', { value: [new w.File([JSON.stringify(obj)], name)], configurable: true });
  inp.dispatchEvent(new w.Event('change'));
  await sleep(50);
}
const txt = (w, id) => w.document.getElementById(id).textContent;
const opts = w => [...w.document.querySelectorAll('#ui-lang option')].map(o => o.value);

(async () => {
  // built-in locales, ordered source first, plus the "load file" entry
  let w = boot();
  assert.deepStrictEqual(opts(w), ['en', 'de', '__load']);
  assert.strictEqual(w.document.querySelector('#ui-lang option[value="de"]').textContent, 'Deutsch');
  assert.strictEqual(w.document.documentElement.dir, 'ltr');

  // Chrome-style placeholder ($NAME$ + placeholders) works in built-in strings
  const msgs = [];
  w.confirm = m => (msgs.push(m), true);
  const ed = w.document.getElementById('ed');
  ed.value = 'a: b'; ed.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.document.querySelector('[data-close]').click();
  assert.strictEqual(msgs[0], '“untitled.md” has unsaved changes. Close anyway?');

  // load a partial French pack (messages.json format) at runtime
  await loadPack(w, 'fr.json', {
    langName: { message: 'Français' },
    new: { message: 'Nouveau' },
    packLoaded: { message: 'Chargé : $LANG$', placeholders: { lang: { content: '$1' } } },
    emptyHint: { message: 'Aucun frontmatter. <img src=x onerror="window.pwned=1"> <code>tags:</code>' }
  }, 'fr');
  assert.strictEqual(w.document.documentElement.lang, 'fr');
  assert.strictEqual(txt(w, 'btn-new'), 'Nouveau');
  assert.strictEqual(txt(w, 'btn-open'), 'Open', 'missing keys fall back to English');
  assert.deepStrictEqual(opts(w), ['en', 'de', 'fr', '__load']);
  assert.strictEqual(txt(w, 'status'), 'Chargé : Français');
  const hint = w.document.getElementById('empty-hint');
  assert.strictEqual(hint.querySelector('img'), null, 'unsafe HTML is not rendered');
  assert.ok(hint.querySelector('code'), 'whitelisted tag is rendered');
  assert.ok(!w.pwned);

  // pack persists across reloads
  const stored = { 'pme.packs': w.localStorage.getItem('pme.packs'), 'pme.lang': 'fr' };
  w = boot(stored);
  assert.strictEqual(txt(w, 'btn-new'), 'Nouveau');
  assert.ok(opts(w).includes('fr'));

  // region codes are normalised, flat {key: "text"} files are accepted, rtl is honoured
  w = boot();
  await loadPack(w, 'messages.pt_br.json', { langName: 'Português', new: 'Novo', textDirection: 'rtl' }, 'pt_br');
  assert.ok(opts(w).includes('pt-BR'));
  assert.strictEqual(txt(w, 'btn-new'), 'Novo');
  assert.strictEqual(w.document.documentElement.dir, 'rtl');

  // invalid file -> error status, nothing changes
  w = boot();
  await loadPack(w, 'x.json', { nothing: 1 }, 'xx');
  assert.strictEqual(w.document.getElementById('status').className, 'err');
  assert.deepStrictEqual(opts(w), ['en', 'de', '__load']);
  // cancelled prompt -> nothing changes
  await loadPack(w, 'fr.json', { langName: 'Fr' }, null);
  assert.deepStrictEqual(opts(w), ['en', 'de', '__load']);
  console.log('I18N TESTS OK');
})().catch(e => { console.error(e); process.exit(1); });
