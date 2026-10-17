// The form panel warns when a stray line ends the header, and the warning follows edits and language.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pelican-editor.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/' });
const w = dom.window, d = w.document;
const ed = d.getElementById('ed'), warn = d.getElementById('stray-warn');
const type = t => { ed.value = t; ed.dispatchEvent(new w.Event('input', { bubbles: true })); };

assert.ok(warn.hidden, 'no warning for an empty document');

type('Title: A\nSummary: x\n  y\n\nbody');
assert.ok(!warn.hidden, 'warning expected for under-indented continuation');
assert.ok(warn.textContent.includes('3'), 'line number missing: ' + warn.textContent);
assert.ok(warn.textContent.includes('y'), 'line text missing: ' + warn.textContent);
assert.strictEqual(warn.getAttribute('role'), 'alert');

// language switch re-renders the message
const sel = d.getElementById('ui-lang');
sel.value = 'de'; sel.dispatchEvent(new w.Event('change'));
assert.ok(/Zeile/.test(warn.textContent), 'German message expected: ' + warn.textContent);
sel.value = 'en'; sel.dispatchEvent(new w.Event('change'));
assert.ok(/Line/.test(warn.textContent));

// fixing the indentation clears it
type('Title: A\nSummary: x\n    y\n\nbody');
assert.ok(warn.hidden, 'warning should clear once the header is valid');

// plain prose with a colon is not a header, so no warning
type('Das ist: Prosa\nweiter');
assert.ok(warn.hidden);

// editing a form field re-serializes with a blank line after the header, which clears the warning
type('Title: A\nSome prose');
assert.ok(!warn.hidden);
const ta = d.querySelector('#fields textarea');
ta.value = 'B'; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
assert.ok(warn.hidden, 'form edit should clear the warning');
assert.strictEqual(ed.value, 'Title: B\n\nSome prose');

dom.window.close();
console.log('STRAY TESTS OK');
