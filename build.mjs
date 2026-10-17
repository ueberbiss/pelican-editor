#!/usr/bin/env node
// Builds dist/pelican-editor.html (one self-contained file) from
//   src/pelican-editor.src.html  +  _locales/<code>/messages.json
// and validates the translations. Usage:
//   node build.mjs           validate + build + regenerate STRINGS.md
//   node build.mjs --check   validate only (CI / pre-commit)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_LANG = 'en';
const MARKER = '/*__LOCALES__*/ {}';
const checkOnly = process.argv.includes('--check');

const errors = [];
const warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);

// ---------- read locales ----------
const localeDir = path.join(root, '_locales');
const raw = {}; // code -> { key: { message, description?, placeholders? } }
for (const dir of fs.readdirSync(localeDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const code = dir.name.replace('_', '-'); // Chrome convention: pt_BR -> pt-BR
  const file = path.join(localeDir, dir.name, 'messages.json');
  if (!fs.existsSync(file)) { warn(`${dir.name}: no messages.json, skipped`); continue; }
  try { raw[code] = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { err(`${dir.name}/messages.json: invalid JSON (${e.message})`); }
}
if (!raw[SOURCE_LANG]) { err(`source language "${SOURCE_LANG}" is missing`); report(); }

const src = raw[SOURCE_LANG];
const srcKeys = Object.keys(src);

// ---------- helpers ----------
const phTokens = s => [...new Set([...s.replace(/\$\$/g, '').matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map(m => m[1].toLowerCase()))].sort();
const tagTokens = s => [...new Set([...s.matchAll(/<\/?([a-z][a-z0-9]*)>/gi)].map(m => m[0].toLowerCase()))].sort();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- which keys does the code use? ----------
const template = fs.readFileSync(path.join(root, 'src', 'pelican-editor.src.html'), 'utf8');
const used = new Set(['langName']); // langName is read by the language drop-down, not via tr()
for (const m of template.matchAll(/\btr\(\s*'([A-Za-z0-9_]+)'/g)) used.add(m[1]);
for (const m of template.matchAll(/data-i18n(?:-html|-title|-placeholder)?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
for (const k of used) if (!(k in src)) err(`code uses "${k}" but ${SOURCE_LANG}/messages.json has no such key`);
for (const k of srcKeys) if (!used.has(k)) warn(`${SOURCE_LANG}: key "${k}" is not used by the code`);

// ---------- validate + compile ----------
const out = {};
const coverage = [];
const codes = [SOURCE_LANG, ...Object.keys(raw).filter(c => c !== SOURCE_LANG).sort()];
for (const code of codes) {
  const loc = raw[code];
  const compiled = {};
  let translated = 0;
  for (const key of Object.keys(loc)) {
    const e = loc[key];
    if (!/^[A-Za-z0-9_]+$/.test(key)) { err(`${code}: invalid key "${key}" (letters, digits, underscore only)`); continue; }
    if (!(key in src)) { warn(`${code}: key "${key}" does not exist in ${SOURCE_LANG} (ignored)`); continue; }
    if (!e || typeof e.message !== 'string') { err(`${code}.${key}: "message" must be a string`); continue; }
    if (e.message.trim() === '') continue; // untranslated: falls back to English
    const used_ = phTokens(e.message), want = phTokens(src[key].message);
    if (!same(used_, want)) err(`${code}.${key}: placeholders ${JSON.stringify(used_)} differ from ${SOURCE_LANG} ${JSON.stringify(want)}`);
    const defined = Object.keys(e.placeholders || {}).map(x => x.toLowerCase());
    used_.filter(p => !defined.includes(p)).forEach(p => err(`${code}.${key}: $${p.toUpperCase()}$ is not defined under "placeholders"`));
    if (!same(tagTokens(e.message), tagTokens(src[key].message))) err(`${code}.${key}: HTML tags differ from ${SOURCE_LANG}`);
    compiled[key] = e.placeholders ? { message: e.message, placeholders: e.placeholders } : { message: e.message };
    translated++;
  }
  if (!compiled.langName) err(`${code}: "langName" is required (name of the language in itself)`);
  const dir = compiled.textDirection && compiled.textDirection.message;
  if (dir && dir !== 'ltr' && dir !== 'rtl') err(`${code}.textDirection must be exactly "ltr" or "rtl"`);
  coverage.push([code, translated, srcKeys.length]);
  out[code] = compiled;
}

report();

// ---------- write ----------
if (!checkOnly) {
  if (template.split(MARKER).length !== 2) { console.error(`marker ${MARKER} must appear exactly once in the source`); process.exit(1); }
  const json = JSON.stringify(out)
    .replace(/</g, '\\u003c')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029'); // safe inside <script>
  let html = template.replace(MARKER, () => json); // function form: translations may contain "$"
  html = html.replace('<!doctype html>\n', () => '<!doctype html>\n<!-- GENERATED from src/pelican-editor.src.html and _locales/ by build.mjs. Edit those, not this file. -->\n');
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'pelican-editor.html'), html);

  const esc = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const rows = srcKeys.map(k => `| \`${k}\` | ${esc(src[k].message)} | ${esc(src[k].description || '')} |`);
  fs.writeFileSync(path.join(root, 'STRINGS.md'),
    '# Strings\n\nGenerated by `node build.mjs` from `_locales/en/messages.json`. Reference for translators.\n' +
    '`$NAME$`-style tokens are placeholders: keep them unchanged.\n\n| Key | English | Note for translators |\n|---|---|---|\n' + rows.join('\n') + '\n');
  console.log(`built dist/pelican-editor.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB), STRINGS.md`);
}

function report() {
  if (typeof coverage !== 'undefined' && coverage.length) {
    for (const [c, n, t] of coverage) console.log(`  ${c.padEnd(8)} ${String(n).padStart(3)}/${t}  ${Math.round(100 * n / t)}%`);
  }
  warnings.forEach(w => console.warn('warning:', w));
  if (errors.length) { errors.forEach(e => console.error('ERROR:', e)); process.exit(1); }
}
