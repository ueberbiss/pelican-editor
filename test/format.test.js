const { JSDOM } = require('jsdom');
const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'dist', 'pelican-editor.html'),'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document, ed = d.getElementById('ed');
const act = a => d.querySelector(`#toolbar [data-act="${a}"]`).click();
const set = (text, s, e = s) => { ed.value = text; ed.dispatchEvent(new w.Event('input', { bubbles: true })); ed.setSelectionRange(s, e); };
const selText = () => ed.value.slice(ed.selectionStart, ed.selectionEnd);
const key = (k, o = {}) => ed.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, ctrlKey: true, bubbles: true, ...o }));

// bold wrap / toggle (selection with surrounding spaces keeps spaces outside)
set('hello world', 0, 5); act('bold');
assert.strictEqual(ed.value, '**hello** world'); assert.strictEqual(selText(), 'hello');
act('bold'); assert.strictEqual(ed.value, 'hello world', 'toggle off (markers outside selection)');
set('a  foo  b', 1, 8); act('italic'); assert.strictEqual(ed.value, 'a  _foo_  b');
set('x ~~y~~ z', 2, 7); act('strike'); assert.strictEqual(ed.value, 'x y z', 'toggle off (markers inside selection)');
// empty selection inserts placeholder, selected
set('', 0); act('bold'); assert.strictEqual(ed.value, '**text**'); assert.strictEqual(selText(), 'text');
set('', 0); act('code'); assert.strictEqual(ed.value, '`text`');

// headings: add, switch, toggle off
set('Title', 2); act('h2'); assert.strictEqual(ed.value, '## Title');
act('h3'); assert.strictEqual(ed.value, '### Title');
act('h3'); assert.strictEqual(ed.value, 'Title');
// lists on multiple lines, blank lines skipped
set('a\nb\n\nc', 0, 6); act('ul'); assert.strictEqual(ed.value, '- a\n- b\n\n- c');
act('ul'); assert.strictEqual(ed.value, 'a\nb\n\nc', 'ul toggle');
act('ol'); assert.strictEqual(ed.value, '1. a\n2. b\n\n3. c');
act('ul'); assert.strictEqual(ed.value, '- a\n- b\n\n- c', 'ol -> ul');
set('q1\nq2', 0, 5); act('quote'); assert.strictEqual(ed.value, '> q1\n> q2'); act('quote'); assert.strictEqual(ed.value, 'q1\nq2');
// code block
set('', 0); act('codeblock'); assert.strictEqual(ed.value, '```\n\n```'); assert.strictEqual(ed.selectionStart, 4);
set('x = 1\ny = 2', 0, 11); act('codeblock'); assert.strictEqual(ed.value, '```\nx = 1\ny = 2\n```');
// link / image
set('see docs', 4, 8); act('link'); assert.strictEqual(ed.value, 'see [docs](https://)'); assert.strictEqual(selText(), 'https://');
set('go https://a.de', 3, 15); act('link'); assert.strictEqual(ed.value, 'go [text](https://a.de)'); assert.strictEqual(selText(), 'text');
set('', 0); act('image'); assert.strictEqual(ed.value, '![alt text]({static}/images/)'); assert.strictEqual(selText(), 'alt text');
set('Foto', 0, 4); act('image'); assert.strictEqual(ed.value, '![Foto]({static}/images/)'); assert.strictEqual(ed.selectionStart, ed.value.length - 1);

// frontmatter is never touched: caret/selection inside the header is clamped to the body
set('Title: T\nTags: a\n\nbody text', 0, 8); act('bold');
assert.ok(ed.value.startsWith('Title: T\nTags: a\n\n'), 'header intact');
assert.ok(ed.value.includes('**text**'), 'inserted at body start');
set('Title: T\n\nbody', 3); act('h1'); assert.strictEqual(ed.value, 'Title: T\n\n# body', 'heading goes onto first body line');
// fields stay in sync
assert.strictEqual(d.querySelectorAll('#fields .field').length, 1);
// each action is its own undo step
set('abc', 0, 3); act('bold'); act('italic');
assert.strictEqual(ed.value, '**_abc_**');
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
assert.strictEqual(ed.value, '**abc**'); 
d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
assert.strictEqual(ed.value, 'abc');
// shortcuts only when the editor has focus
set('abc', 0, 3); ed.focus(); key('b'); assert.strictEqual(ed.value, '**abc**');
key('k'); assert.ok(ed.value.includes('](https://)'));
// i18n of tooltips
assert.ok(d.querySelector('[data-act="bold"]').title.includes('Bold'));
const sel = d.getElementById('ui-lang'); sel.value = 'de'; sel.dispatchEvent(new w.Event('change'));
assert.ok(d.querySelector('[data-act="bold"]').title.includes('Strg+B'));
console.log('FORMAT TESTS OK');
