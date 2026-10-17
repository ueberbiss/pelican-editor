// Tests the pure parse/serialize/slugify functions against a real Pelican article.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pelican-editor.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const pure = script.split('// <pure>')[1].split('// </pure>')[0];
const { parse, serialize, slugify } = new Function(pure + '; return {parse, serialize, slugify};')();

const sample = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.md'), 'utf8');
const p = parse(sample);
assert.strictEqual(p.fields.length, 32);
assert.strictEqual(p.fields[4].key, 'Slug');
assert.strictEqual(p.fields[4].value, '49-paku-paku-speedy-spicy-hot-spicy-ramen-noodles-test');
assert.ok(p.fields.find(f => f.key === 'Ingredients').value.includes('Säureregulatoren: E452i'));
assert.ok(p.body.startsWith('Das erste'));
const once = serialize(p.fields, p.body);
assert.strictEqual(once.split('\n\n').slice(1).join('\n\n'), sample.split('\n\n').slice(1).join('\n\n'));
assert.deepStrictEqual(parse(once).fields, p.fields);
assert.strictEqual(parse('grög: ja\nSlug: x\n\nbody').fields[0].key, 'grög');
assert.strictEqual(serialize([{ key: 'tags', value: '' }], ''), 'tags:\n\n');
const q = parse('A: b\n\nFoo: bar\ntext');
assert.strictEqual(parse(serialize([], q.body)).fields.length, 0);
assert.strictEqual(parse('Summary: a\n    b\n    c\nTags: x\n\nbody').fields[0].value, 'a\nb\nc');
assert.strictEqual(parse('Das ist: Prosa\n').fields.length, 0);
assert.strictEqual(slugify('Hühner-Äpfel & Größe!'), 'huehner-aepfel-groesse');

// stray: first non-blank line that ends the header is reported, never for clean files or plain prose
assert.strictEqual(p.stray, null);
assert.deepStrictEqual(parse('Title: A\nSummary: x\n  y\n\nbody').stray, { line: 3, text: '  y' });
assert.deepStrictEqual(parse('A: b\nSome prose').stray, { line: 2, text: 'Some prose' });
assert.strictEqual(parse('Das ist: Prosa\n').stray, null);
assert.strictEqual(parse('Summary: a\n    b\n\nbody').stray, null);
assert.strictEqual(parse('A: b').stray, null);
