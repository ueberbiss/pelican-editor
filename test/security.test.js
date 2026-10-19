// Regression tests for the security audit: linear-time trimming, CSP hashes, poisoned localStorage.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pelican-editor.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const style = html.split('<style>')[1].split('</style>')[0];
const pure = script.split('// <pure>')[1].split('// </pure>')[0];
const { parse, serialize } = new Function(pure + '; return {parse, serialize};')();

// F1: long whitespace runs must not take quadratic time (80k spaces took ~5 s before).
const long = 'A: x' + ' '.repeat(100000) + 'y';
const t0 = Date.now();
assert.strictEqual(parse(long + '\n\nb').fields.length, 1);
serialize([{ key: 'A', value: long.slice(3) }], 'b');
assert.ok(Date.now() - t0 < 500, 'parse/serialize too slow on long whitespace');
assert.strictEqual(parse('A: b \t \n\nx').fields[0].value, 'b');

// F2: CSP meta pins exactly the inline script and style.
const sha = s => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
assert.ok(csp, 'CSP meta tag missing');
assert.ok(csp[1].includes("default-src 'none'"));
assert.ok(csp[1].includes('script-src ' + sha(script)), 'script hash does not match');
assert.ok(csp[1].includes('style-src ' + sha(style)), 'style hash does not match');
assert.ok(!/unsafe-inline|unsafe-eval/.test(csp[1]));
// images may only come from data: and blob: URLs made by the page itself (media folder), never from the network
assert.ok(/img-src data: blob:;/.test(csp[1]), 'img-src must be exactly data: blob:');
assert.ok(!/https?:|\*/.test(csp[1]), 'no network or wildcard sources in the CSP');
assert.ok(!/connect-src|frame-src|font-src/.test(csp[1].replace(/default-src 'none'/, '')), 'everything else stays on default-src none');

// F3: a stored "__proto__" pack must not alter language lookup or crash startup.
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://example.test/',
  beforeParse(w) {
    w.localStorage.setItem('pme.packs', '{"__proto__":{"xx":"y"},"not a code":{"langName":"bad"},"fr":{"langName":"Français"}}');
    w.localStorage.setItem('pme.lang', 'xx');
  },
});
const d = dom.window.document;
assert.notStrictEqual(d.documentElement.lang, 'xx');
const opts = [...d.querySelectorAll('#ui-lang option')].map(o => o.value);
assert.ok(opts.includes('fr'), 'valid stored pack should load');
assert.ok(!opts.includes('not a code') && !opts.includes('xx'));
assert.strictEqual(({}).xx, undefined);
dom.window.close();
console.log('SECURITY TESTS OK');
