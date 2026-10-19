// Media folder: path resolution (pure) and the preview/insert flow against a fake folder tree.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pelican-editor.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const pure = script.split('// <pure>')[1].split('// </pure>')[0];
const { mdMediaPath, mdPelicanPath, mdSplitDir, mdRelUnder, mdEncodeSeg } =
  new Function(pure + '; return {mdMediaPath, mdPelicanPath, mdSplitDir, mdRelUnder, mdEncodeSeg};')();

// ---- path resolution ----
const P = (s, d) => mdMediaPath(s, d);
assert.deepStrictEqual(P('{static}/images/reviews/pakupakuspeedyhotspicy01.jpg'), ['images', 'reviews', 'pakupakuspeedyhotspicy01.jpg']);
assert.deepStrictEqual(P('{static}/images/reviews/a.jpg', ['reviews']), ['images', 'reviews', 'a.jpg'], '{static}/ ignores the file folder');
assert.deepStrictEqual(P('{static}x.jpg', ['reviews']), ['reviews', 'x.jpg'], '{static}x is relative to the file');
assert.deepStrictEqual(P('{attach}/a/b.png'), ['a', 'b.png']);
assert.deepStrictEqual(P('{filename}/a/b.png'), ['a', 'b.png']);
assert.deepStrictEqual(P('|static|/a/b.png'), ['a', 'b.png']);
assert.deepStrictEqual(P('/images/a.jpg', ['reviews']), ['images', 'a.jpg'], 'root-relative');
assert.deepStrictEqual(P('x.jpg', ['reviews']), ['reviews', 'x.jpg']);
assert.deepStrictEqual(P('./x.jpg', ['reviews']), ['reviews', 'x.jpg']);
assert.deepStrictEqual(P('../images/a.jpg', ['reviews']), ['images', 'a.jpg']);
assert.deepStrictEqual(P('{static}/a%20b%20%281%29.jpg'), ['a b (1).jpg']);
assert.deepStrictEqual(P('{static}/a.jpg?v=2#top'), ['a.jpg']);
assert.deepStrictEqual(P('{static}//images///a.JPG'), ['images', 'a.JPG']);
assert.deepStrictEqual(P('{static}/Rückseite/ü.png'), ['Rückseite', 'ü.png']);
for (const bad of ['', '   ', '{static}/', '{static}/images/', '{static}/a.exe', '{static}/a', '{static}/a.jpg.php', '{static}/a.html',
  'http://x.de/a.jpg', 'https://x.de/a.jpg', 'data:image/png;base64,AAAA', 'javascript:alert(1).jpg', 'file:///etc/a.jpg', '//host/a.jpg',
  'C:\\a.jpg', '..\\a.jpg', '{static}/..%5Ca.jpg', '{static}/a%2Fb.jpg', '{static}/a%5Cb.jpg', '{static}/%00a.jpg', '{static}/%zz.jpg',
  '{static}/../a.jpg', '{static}/../../etc/passwd.jpg', '{static}/%2e%2e/a.jpg', '{static}/%2E%2E/%2e%2e/a.jpg', '../a.jpg', '../../a.jpg',
  '{static}/' + 'a/'.repeat(600) + 'x.jpg']) {
  assert.strictEqual(P(bad, []), null, 'must not resolve: ' + JSON.stringify(bad.slice(0, 40)));
}
assert.strictEqual(P('../../a.jpg', ['reviews']), null, 'cannot climb above the content folder');
assert.deepStrictEqual(P('../a.jpg', ['reviews']), ['a.jpg']);
// results never contain traversal or separators, whatever the input
for (const s of ['{static}/a/../b/./c.jpg', '{static}/a/%2e%2e/b.jpg', 'a/b/../../c.jpg', '/a//b.jpg']) {
  const r = P(s, ['x']);
  assert.ok(r === null || r.every(seg => seg && seg !== '.' && seg !== '..' && !/[\\/\0]/.test(seg)), s);
}

assert.strictEqual(mdPelicanPath("AUTHOR = 'x'\nPATH = 'content'\n"), 'content');
assert.strictEqual(mdPelicanPath('PATH="src/posts"'), 'src/posts');
assert.strictEqual(mdPelicanPath("  PATH='content'  # comment"), 'content');
assert.strictEqual(mdPelicanPath("STATIC_PATH = 'x'\nOUTPUT_PATH = 'o'"), null, 'only the PATH setting counts');
assert.strictEqual(mdPelicanPath("PATH = os.path.join(a, 'b')"), null);
assert.deepStrictEqual(mdSplitDir('content/'), ['content']);
assert.deepStrictEqual(mdSplitDir('a\\b//c'), ['a', 'b', 'c']);
assert.deepStrictEqual(mdSplitDir('.'), []);
assert.deepStrictEqual(mdSplitDir('../x/./y'), ['x', 'y'], 'no way out of the site folder');
assert.deepStrictEqual(mdRelUnder(['content', 'images', 'a.jpg'], ['content']), ['images', 'a.jpg']);
assert.strictEqual(mdRelUnder(['other', 'a.jpg'], ['content']), null);
assert.strictEqual(mdRelUnder(['content'], ['content']), null);
assert.deepStrictEqual(mdRelUnder(['a.jpg'], []), ['a.jpg']);
for (const name of ['a b (1).jpg', 'ü ö.png', '100%.jpg', 'x[1]"y".gif', 'plain.webp', 'tab\there.jpg']) {
  const enc = mdEncodeSeg(name);
  assert.ok(!/[\s()"<>\[\]\\]/.test(enc), 'encoded segment is link-safe: ' + enc);
  assert.deepStrictEqual(P('{static}/images/' + enc), ['images', name], 'round trip ' + name);
}

// ---- DOM with a fake folder tree ----
let nUrl = 0;
const calls = [];
function fsTree(w) {
  const file = (name, o = {}) => ({
    kind: 'file', name,
    async getFile() { return { name, size: o.size ?? 10, lastModified: 1, text: async () => o.text ?? '', slice: (a, b, t) => new w.Blob(['x'], { type: t }) }; },
    async isSameEntry(h) { return h === this; },
  });
  const dir = (name, kids = []) => {
    const d = {
      kind: 'directory', name, kids: new Map(kids.map(k => [k.name, k])),
      async getDirectoryHandle(n) { calls.push(n); const k = d.kids.get(n); if (!k || k.kind !== 'directory') throw new w.DOMException('nope', 'NotFoundError'); return k; },
      async getFileHandle(n) { const k = d.kids.get(n); if (!k || k.kind !== 'file') throw new w.DOMException('nope', 'NotFoundError'); return k; },
      async queryPermission() { return 'granted'; },
      async requestPermission() { return 'granted'; },
      async resolve(h) {
        const trail = [];
        const walk = cur => {
          for (const [n, k] of cur.kids) {
            if (k === h) { trail.push(n); return true; }
            if (k.kind === 'directory') { trail.push(n); if (walk(k)) return true; trail.pop(); }
          }
          return false;
        };
        return walk(d) ? trail : null;
      },
    };
    return d;
  };
  const review = file('review.md', { text: 'Title: R\n\n![rel](x.jpg)\n\n![up](../images/reviews/p1.jpg)' });
  const p1 = file('p1.jpg'), spaced = file('a b (1).jpg'), outside = file('outside.jpg');
  const site = dir('mysite', [
    file('pelicanconf.py', { text: "AUTHOR = 'me'\nPATH = 'content'\n" }),
    dir('content', [
      dir('reviews', [review, file('x.jpg')]),
      dir('images', [dir('reviews', [p1, file('p2.jpg'), file('big.png', { size: 30 * 1024 * 1024 }), spaced])]),
    ]),
    dir('other', [outside]),
  ]);
  return { site, review, p1, spaced, outside };
}
function open(withDir = true) {
  let t;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/',
    beforeParse(w) {
      t = fsTree(w);
      w.URL.createObjectURL = () => 'blob:test/' + (++nUrl);
      w.URL.revokeObjectURL = () => {};
      w.showOpenFilePicker = async () => w.__picked;
      w.showSaveFilePicker = async () => { throw new w.DOMException('x', 'AbortError'); };
      if (withDir) w.showDirectoryPicker = async () => t.site;
    },
  });
  return { dom, t };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // unsupported browser: button is disabled and says why
  {
    const { dom } = open(false);
    const b = dom.window.document.getElementById('btn-media');
    assert.ok(b.disabled);
    assert.ok(/Chrome and Edge/.test(b.title));
    dom.window.close();
  }

  const { dom, t } = open();
  const w = dom.window, d = w.document;
  const ed = d.getElementById('ed'), prev = d.getElementById('preview');
  const btn = d.getElementById('btn-media'), dirInput = d.getElementById('media-dir'), off = d.getElementById('btn-media-off');
  const type = x => { ed.value = x; ed.dispatchEvent(new w.Event('input', { bubbles: true })); };
  d.getElementById('btn-preview').click();

  const md = [
    '![Paku alt: lang]({static}/images/reviews/p1.jpg "📦 Die Packung von vorne")',
    '![two]({static}/images/reviews/p2.jpg "t2")',
    '![missing]({static}/images/reviews/nope.jpg "t3")',
    '![huge]({static}/images/reviews/big.png)',
    '![escape]({static}/../../etc/x.jpg)',
    '![remote](http://evil.example/x.jpg)',
    '![spaced]({static}/images/reviews/a%20b%20%281%29.jpg)',
  ].join('\n\n');
  type('Title: T\n\n' + md);
  await sleep(250);
  assert.ok(!btn.disabled);
  assert.strictEqual(prev.querySelectorAll('img').length, 0, 'no folder yet: placeholders only');
  assert.strictEqual(prev.querySelectorAll('.img-ph').length, 7);
  assert.ok(dirInput.hidden && off.hidden);

  // connect: content folder is read from pelicanconf.py
  btn.click();
  await sleep(300);
  assert.strictEqual(dirInput.value, 'content');
  assert.ok(!dirInput.hidden && !off.hidden);
  assert.ok(btn.textContent.includes('mysite'), btn.textContent);
  const imgs = [...prev.querySelectorAll('img.media-img')];
  assert.strictEqual(imgs.length, 3, 'p1, p2 and the spaced name');
  assert.strictEqual(imgs[0].alt, 'Paku alt: lang');
  assert.strictEqual(imgs[0].title, '📦 Die Packung von vorne');
  assert.ok(imgs.every(i => i.getAttribute('src').startsWith('blob:')));
  const miss = [...prev.querySelectorAll('.img-miss')];
  assert.strictEqual(miss.length, 2);
  assert.ok(miss.some(m => /not found/i.test(m.title) && m.title.includes('images/reviews/nope.jpg')));
  assert.ok(miss.some(m => /25 MB/.test(m.title)));
  assert.strictEqual(prev.querySelectorAll('.img-ph:not(.img-miss)').length, 2, 'escape attempt and remote image stay placeholders');
  assert.strictEqual(prev.querySelectorAll('img[src^="http"], img[src*="evil"]').length, 0);
  assert.ok(!calls.some(c => c === '..' || c === 'etc' || c.includes('/')), 'never asks the folder for traversal names: ' + calls);
  assert.strictEqual(prev.querySelectorAll('script, iframe, object, embed, svg, style').length, 0);

  // changing the content folder re-resolves; an unknown folder is flagged
  dirInput.value = 'nothere';
  dirInput.dispatchEvent(new w.Event('change'));
  await sleep(300);
  assert.strictEqual(dirInput.getAttribute('aria-invalid'), 'true');
  assert.strictEqual(prev.querySelectorAll('img.media-img').length, 0);
  dirInput.value = 'content/';
  dirInput.dispatchEvent(new w.Event('change'));
  await sleep(300);
  assert.strictEqual(dirInput.hasAttribute('aria-invalid'), false);
  assert.strictEqual(prev.querySelectorAll('img.media-img').length, 3);
  dirInput.value = '';
  dirInput.dispatchEvent(new w.Event('change'));
  await sleep(200);
  assert.strictEqual(dirInput.value, 'content', 'empty falls back to content');

  // file-relative paths need the folder of the opened file
  w.__picked = [t.review];
  d.getElementById('btn-open').click();
  await sleep(400);
  assert.ok(ed.value.includes('![rel](x.jpg)'), 'review.md was opened');
  const rel = [...prev.querySelectorAll('img.media-img')].map(i => i.alt);
  assert.deepStrictEqual(rel, ['rel', 'up'], 'x.jpg next to the file and ../images/... both resolve');

  // insert image: path built relative to the content folder
  type('Title: T\n\nintro\n');
  ed.setSelectionRange(ed.value.length, ed.value.length);
  w.__picked = [t.p1, t.spaced, t.outside];
  d.querySelector('[data-act="image"]').click();
  await sleep(300);
  assert.ok(ed.value.includes('![]({static}/images/reviews/p1.jpg)'), ed.value);
  assert.ok(ed.value.includes('![]({static}/images/reviews/a%20b%20%281%29.jpg)'), ed.value);
  assert.ok(!ed.value.includes('outside.jpg'), 'files outside the content folder are refused');
  assert.ok(d.getElementById('status').textContent.includes('outside.jpg'), 'user is told why');

  // media folder: defaults to content/images, can be changed to another folder inside the project, never outside
  const imgBtn = d.getElementById('btn-img-dir');
  assert.ok(!imgBtn.hidden && imgBtn.textContent.includes('content/images'), imgBtn.textContent);
  w.showDirectoryPicker = async () => t.site.kids.get('content').kids.get('reviews');
  imgBtn.click();
  await sleep(200);
  assert.ok(imgBtn.textContent.includes('content/reviews'), imgBtn.textContent);
  w.showDirectoryPicker = async () => ({ kind: 'directory', name: 'elsewhere' });
  imgBtn.click();
  await sleep(200);
  assert.ok(imgBtn.textContent.includes('content/reviews'), 'folder outside the project is refused');
  assert.ok(d.getElementById('status').textContent.includes('inside the project folder'));

  // disconnect
  off.click();
  await sleep(250);
  assert.strictEqual(prev.querySelectorAll('img.media-img').length, 0);
  assert.ok(dirInput.hidden && off.hidden);
  assert.strictEqual(btn.textContent, 'Project folder');
  assert.ok(imgBtn.hidden);
  w.close();

  console.log('MEDIA TESTS OK');
})().catch(e => { console.error(e); process.exit(1); });
