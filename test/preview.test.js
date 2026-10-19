// Rendered preview: Markdown tree, link/image safety, hostile-input limits, and the DOM toggle.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pelican-editor.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const pure = script.split('// <pure>')[1].split('// </pure>')[0];
const { mdParse, mdSafeUrl } = new Function(pure + '; return {mdParse, mdSafeUrl};')();
const blocks = t => mdParse(t).blocks;
const text = nodes => nodes.map(n => n.t === 'text' ? n.v : n.t === 'br' ? '\n' : n.v || text(n.c || [])).join('');

// ---- blocks ----
let b = blocks('# Hi #\n\nSetext\n======\n\nSub\n---\n\n#NoSpace');
assert.deepStrictEqual(b.map(x => x.t + (x.n || '')), ['h1', 'h1', 'h2', 'h1']);
assert.strictEqual(text(b[0].c), 'Hi');
assert.strictEqual(blocks('---')[0].t, 'hr');
assert.strictEqual(blocks('* * *')[0].t, 'hr');
b = blocks('```js\nvar a = "<b>";\n```\n\n    indented\n    code\n\n~~~\nx\n~~~');
assert.deepStrictEqual(b.map(x => [x.t, x.v, x.lang]), [['pre', 'var a = "<b>";', 'js'], ['pre', 'indented\ncode', ''], ['pre', 'x', '']]);
b = blocks('> quote\n> more\n\n> second');
assert.strictEqual(b.length, 2);
assert.strictEqual(b[0].t, 'quote');
assert.strictEqual(text(b[0].c[0].c), 'quote\nmore');

// lists: Python-Markdown needs a blank line before a list, and 4 spaces for nesting
assert.strictEqual(blocks('Para\n- not a list').length, 1);
assert.strictEqual(blocks('Para\n\n- a\n- b')[1].items.length, 2);
b = blocks('- a\n- b\n    - nested\n    - nested2\n- c')[0];
assert.strictEqual(b.items.length, 3);
assert.strictEqual(b.tight, true);
assert.deepStrictEqual(b.items[1].map(x => x.t), ['p', 'ul']);
assert.strictEqual(b.items[1][1].items.length, 2);
b = blocks('3. x\n4. y')[0];
assert.deepStrictEqual([b.t, b.start, b.items.length], ['ol', 3, 2]);
assert.strictEqual(blocks('- a\n\n- b')[0].tight, false);
assert.strictEqual(blocks('- a\n\n    more\n- b')[0].tight, false);
assert.strictEqual(blocks('- a\n1. b').length, 2);

// tables
b = blocks('| a | b |\n|:--|--:|\n| 1 | 2 \\| x |\n| 3 |')[0];
assert.strictEqual(b.t, 'table');
assert.deepStrictEqual(b.align, ['left', 'right']);
assert.strictEqual(text(b.rows[0][1]), '2 | x');
assert.strictEqual(b.rows[1].length, 2);
assert.strictEqual(blocks('a | b\n| --- | :-: |\n1 | 2')[0].t, 'table', 'separator with spaces and centre alignment');
assert.strictEqual(blocks('a | b\n--- | ---\n1 | 2')[0].t, 'table', 'separator without outer pipes');
assert.notStrictEqual(blocks('a | b\n--x | ---')[0].t, 'table', 'non-dash cell is not a separator');
assert.notStrictEqual(blocks('a | b\n    --- | ---')[0].t, 'table', 'indented row is not a separator');
assert.deepStrictEqual([blocks('a | b\n---')[0].t, blocks('a | b\n---')[0].n], ['h', 2], 'column mismatch is a setext heading, not a table');

// ---- inline ----
const inl = t => blocks(t)[0].c;
let c = inl('*em* **strong** ***both*** ~~del~~ `co*de` snake_case_name 2 * 3 * 4');
assert.deepStrictEqual(c.filter(n => n.t !== 'text').map(n => n.t), ['em', 'strong', 'strong', 'del', 'code']);
assert.strictEqual(c.find(n => n.t === 'code').v, 'co*de');
assert.ok(text(c).includes('snake_case_name') && text(c).includes('2 * 3 * 4'));
assert.strictEqual(text(inl('\\*not em\\*')), '*not em*');
assert.ok(inl('a  \nb').some(n => n.t === 'br'));
assert.ok(!inl('a\nb').some(n => n.t === 'br'));
c = inl('[x](https://a.b "t") [r][1] [s] <https://z.de> <me@x.de>\n\n[1]: https://ref.de\n[S]: https://s.de');
const links = c.filter(n => n.t === 'a');
assert.deepStrictEqual(links.map(n => n.href), ['https://a.b', 'https://ref.de', 'https://s.de', 'https://z.de', 'mailto:me@x.de']);
assert.strictEqual(links[0].title, 't');
assert.strictEqual(mdParse('```\n[1]: https://x\n```').blocks[0].v, '[1]: https://x', 'reference-like text inside a fence is kept');

// raw HTML stays literal text
assert.strictEqual(text(inl('<script>alert(1)</script> <img src=x onerror=1>')), '<script>alert(1)</script> <img src=x onerror=1>');

// ---- link safety ----
const zw = String.fromCharCode(0x200b);
for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'java' + zw + 'script:alert(1)', 'data:text/html,x',
  'vbscript:x', 'file:///etc/passwd', '//evil.example/x', '/rel/path', '#anchor', '../x.md', '{filename}/a.md', 'blob:x']) {
  assert.strictEqual(mdSafeUrl(bad), null, 'must not be clickable: ' + JSON.stringify(bad));
}
for (const ok of ['http://a.b/c', 'HTTPS://a.b', 'mailto:a@b.de']) assert.ok(mdSafeUrl(ok), ok);
c = inl('[x](javascript:alert(1)) [y](  java\tscript:1  )');
assert.ok(c.filter(n => n.t === 'a').every(n => n.href === null));
c = inl('![alt text](http://evil.example/p.png "t")');
assert.deepStrictEqual([c[0].t, c[0].alt], ['img', 'alt text']);

// ---- hostile input stays fast and bounded ----
const hostile = {
  stars: '*a '.repeat(2600),
  brackets: '[a '.repeat(2600),
  ticks: '`a ``b '.repeat(1000),
  underscores: '_a '.repeat(2600),
  quotes: '>'.repeat(20000),
  nestedList: '- '.repeat(5000) + 'x',
  nestedQuoteLines: Array.from({ length: 500 }, (_, k) => '>'.repeat(k % 12 + 1) + ' x').join('\n'),
  manyLines: 'a\n'.repeat(100000),
  manyItems: '* a\n'.repeat(30000),
  hashes: '#'.repeat(250000),
  spaces: 'a' + ' '.repeat(250000) + 'b',
  emphasisRuns: '*'.repeat(8000),
  // table separator rows: whitespace/pipe runs used to backtrack quadratically (40k spaces took 1.7 s)
  tableSepSpaces: 'a | b\n---' + ' '.repeat(250000) + 'x',
  tableSepTabs: 'a | b\n---' + '\t'.repeat(250000) + 'x',
  tableSepPipes: 'a | b\n' + '|-'.repeat(100000) + 'x',
  tableSepMixed: 'a | b\n' + ':- '.repeat(80000),
  tableHeaderLong: 'a | '.repeat(100000) + '\n---|---',
  long: 'x'.repeat(2000000),
};
for (const [name, input] of Object.entries(hostile)) {
  const t0 = Date.now();
  const r = mdParse(input);
  const ms = Date.now() - t0;
  assert.ok(ms < 2000, name + ' took ' + ms + ' ms');
  assert.ok(Array.isArray(r.blocks));
}
assert.strictEqual(mdParse('x'.repeat(2000000)).truncated, true);
assert.strictEqual(mdParse('short').truncated, false);

// ---- DOM ----
function open(storage) {
  return new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/',
    beforeParse(w) { Object.entries(storage || {}).forEach(([k, v]) => w.localStorage.setItem(k, v)); },
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let dom = open();
  let w = dom.window, d = w.document;
  const ed = d.getElementById('ed'), prev = d.getElementById('preview'), btn = d.getElementById('btn-preview');
  const type = t => { ed.value = t; ed.dispatchEvent(new w.Event('input', { bubbles: true })); };

  assert.ok(prev.hidden, 'preview is off by default');
  assert.strictEqual(btn.getAttribute('aria-pressed'), 'false');
  btn.click();
  assert.ok(!prev.hidden);
  assert.strictEqual(btn.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(w.localStorage.getItem('pme.preview'), '1');

  type('Title: T\nTags: a\n\n# Head\n\nHello *world* and [link](https://example.org/x "tt")\n\n- one\n- two\n    - deep\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\n```\ncode <b>\n```');
  await sleep(250);
  assert.strictEqual(prev.querySelector('h1').textContent, 'Head', 'frontmatter must not appear in the preview');
  assert.ok(!prev.textContent.includes('Title'));
  assert.strictEqual(prev.querySelector('em').textContent, 'world');
  const a = prev.querySelector('a');
  assert.strictEqual(a.getAttribute('href'), 'https://example.org/x');
  assert.strictEqual(a.target, '_blank');
  assert.ok(/noopener/.test(a.rel) && /noreferrer/.test(a.rel));
  assert.strictEqual(prev.querySelectorAll('ul > li').length, 3);
  assert.strictEqual(prev.querySelectorAll('li > ul > li').length, 1);
  assert.strictEqual(prev.querySelectorAll('li > p').length, 0, 'tight list renders without <p>');
  assert.strictEqual(prev.querySelectorAll('th').length, 2);
  assert.strictEqual(prev.querySelectorAll('td')[1].style.textAlign, 'right');
  assert.strictEqual(prev.querySelector('pre code').textContent, 'code <b>');
  assert.strictEqual(prev.querySelectorAll('pre b').length, 0);

  // live update from the editor and from the form
  type('Title: T\n\nchanged');
  await sleep(250);
  assert.strictEqual(prev.textContent.trim(), 'changed');
  const ta = d.querySelector('#fields textarea');
  ta.value = 'T2'; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(250);
  assert.strictEqual(prev.textContent.trim(), 'changed');

  // hostile content: nothing executable or loadable is created
  type([
    '<script>window.PWNED=1</script>', '<img src=x onerror="window.PWNED=2">',
    '[a](javascript:window.PWNED=3) [b](  JaVa\tScRiPt:window.PWNED=4)', '![x](http://evil.example/p.png)',
    '[c](data:text/html,<script>1</script>)', '<a href="javascript:1">raw</a>', '`<img src=x onerror=1>`',
  ].join('\n\n'));
  await sleep(250);
  assert.strictEqual(w.PWNED, undefined);
  assert.strictEqual(prev.querySelectorAll('img, script, iframe, object, embed, svg, style, form, input').length, 0);
  assert.strictEqual(prev.querySelectorAll('a').length, 0, 'no clickable anchors for unsafe or relative targets');
  // [a] and [c] are inert links; [b] has whitespace inside the target, so it is not a link at all
  assert.strictEqual(prev.querySelectorAll('.link-off').length, 2);
  assert.ok(prev.textContent.includes('[b]('));
  assert.strictEqual(prev.querySelectorAll('.img-ph').length, 1);
  assert.ok(!prev.querySelector('[onerror], [onclick], [onload]'));
  assert.ok(prev.textContent.includes('<script>window.PWNED=1</script>'), 'raw HTML is shown as text');

  // language change relabels the pane; toggling off hides it and persists
  const sel = d.getElementById('ui-lang');
  sel.value = 'de'; sel.dispatchEvent(new w.Event('change'));
  await sleep(250);
  assert.strictEqual(btn.textContent, 'Vorschau');
  assert.strictEqual(prev.getAttribute('aria-label'), 'Vorschau');
  btn.click();
  assert.ok(prev.hidden);
  assert.strictEqual(w.localStorage.getItem('pme.preview'), '0');
  dom.window.close();

  // stored preference is honoured at startup
  dom = open({ 'pme.preview': '1' });
  w = dom.window; d = w.document;
  assert.ok(!d.getElementById('preview').hidden);
  assert.strictEqual(d.getElementById('btn-preview').getAttribute('aria-pressed'), 'true');
  dom.window.close();

  console.log('PREVIEW TESTS OK');
})().catch(e => { console.error(e); process.exit(1); });
