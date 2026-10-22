# Pelican MD Editor

A single-file Markdown editor with a form for Pelican frontmatter. No install: open
`dist/pelican-editor.html` in Chrome or Edge (Firefox/Safari work, but "Save" downloads the file).

The UI is translatable. Translations are standard `messages.json` files, so
collaborative translation tools can work on them directly.

## ⚠️ AI slop warning

This is AI slop. It was written entirely by Claude / Claude Code, and I have next to no coding
experience, so I can't vouch for the code. It was reviewed and tested by the same AI that wrote it, which
proves little. Expect bugs, odd decisions and code nobody has read carefully. **Don't trust it with
files you can't afford to lose: keep backups or use Git.**

I built it for myself. I don't care whether anybody likes it, uses it or thinks it's shit. If you want
to use it, fine. If you don't, also fine. No promises about support, fixes or stability.

## What it does

I run a few static Pelican blogs and found no editor that handles the frontmatter the way I wanted. So I
had Claude build one. It is one HTML file that runs in the browser and does the following:

- **Frontmatter form.** The Pelican metadata (`Title:`, `Date:`, `Tags:`, `Slug:`, …) at the top of the
  file is shown as editable fields next to the Markdown text. You can add and remove fields, and choose
  whether new field names are lowercase. A warning appears when a stray line would end the frontmatter early.
- **Markdown editor.** A plain text editor with a toolbar (bold, italic, headings, lists, quote, code,
  link, image) and shortcuts such as Ctrl+B, Ctrl+I and Ctrl+K. Undo and redo, and several files in tabs.
- **Files.** New, Open, Save and Save as. In Chrome and Edge, Save writes straight to the file. In
  other browsers it downloads a copy. You can also drop a file onto the editor. You are asked before
  closing a tab with unsaved changes.
- **Preview.** A button shows the rendered Markdown next to the editor, following Python-Markdown's rules
  (a list needs a blank line before it, nested lists need 4 spaces). It supports headings, emphasis,
  code, quotes, lists, tables, links, images and rules. It is built without `innerHTML`: raw HTML is shown
  as text, only `http(s)` and `mailto` links are clickable, and remote images are never loaded.
- **Images in the preview.** Choose your Pelican *project* folder (the one containing `pelicanconf.py`).
  The editor reads `PATH` from it and shows local images referenced as `{static}/…`, `{attach}/…`,
  `{filename}/…` or relative paths. You can also pick a media folder, and the image button inserts
  `![](…)` with the correct `{static}/…` path. Folders are only read, never changed. Chrome and Edge only.
- **Languages.** The UI is translatable (English and German included). See below.

It makes no network requests and uploads nothing. It does not run Pelican, publish anything or manage
your site. It is only an editor.


## Project layout

| Path | Purpose |
|---|---|
| `src/pelican-editor.src.html` | Application source (HTML, CSS, JS in one file). |
| `_locales/<code>/messages.json` | Translations (WebExtension/Chrome `messages.json` format). `en` is the source language. |
| `build.mjs` | Validates the translations and writes `dist/pelican-editor.html` and `STRINGS.md`. |
| `dist/pelican-editor.html` | The finished single file. Generated, do not edit. |
| `STRINGS.md` | Generated list of all strings with notes for translators. |
| `test/` | Tests (jsdom). `npm install` once, then `npm test`. |

Only the build needs Node.js (18+). Running the editor needs nothing.

## Build

```sh
node build.mjs           # validate, build dist/ and STRINGS.md
node build.mjs --check   # validate only (CI, pre-commit)
npm test                 # build + all tests
```

The build fails when a translation would break the UI (different placeholders or HTML tags
than English, invalid `textDirection`, missing `langName`). Missing translations only warn:
the editor falls back to English for any key a language doesn't have.

## Adding a language

1. Copy `_locales/en/messages.json` to `_locales/<code>/messages.json`.
   Use the language code as the folder name. For regional variants use an underscore
   (`pt_BR`); the editor shows it as `pt-BR`.
2. Translate the `message` values. You may delete keys you don't translate, and you may
   delete the `description` fields (they are notes for you, not shown in the UI).
3. Run `node build.mjs`. The language appears in the drop-down automatically.

### Rules for messages

- Keep placeholders such as `$NAME$` exactly as in English. They are replaced at runtime
  (the `placeholders` block must stay, too).
- Keep HTML tags such as `<code>…</code>` where English has them. Only `code`, `b`, `i` and
  `kbd` are rendered; anything else is shown as plain text.
- Don't translate literal examples such as `tags:`, `Tags:`, `Title`, `Slug`: they are
  Pelican metadata names.
- `langName` is the language's name *in that language* (Deutsch, Français).
- `textDirection` is exactly `ltr` or `rtl`.
- An empty `message` counts as untranslated.
- Strings are short UI labels. Check button labels and tooltips for length.

### Try a translation without rebuilding

In the editor, open the language drop-down, choose **Load language file …**, pick a
`messages.json` (or a flat `{"key": "text"}` JSON file) and enter the language code.
It is stored in that browser's local storage and overrides a built-in language of the
same code. This is meant for translators testing their work; to ship a language for everyone,
add it to `_locales/` and rebuild.

## Collaborative translation tools

The files are in the WebExtension `messages.json` format, which Weblate supports natively.
Settings for a Weblate component (see the
[Weblate documentation](https://docs.weblate.org/en/latest/formats/webextension.html)):

| Setting | Value |
|---|---|
| File format | WebExtension JSON file |
| File mask | `_locales/*/messages.json` |
| Monolingual base language file | `_locales/en/messages.json` |
| Template for new translations | empty |

Notes:

- The Weblate documentation does not say whether it shows the per-message `description` to
  translators. Point translators to `STRINGS.md` (generated, with the same notes) or paste it
  into the component's translation instructions.
- Other platforms that import Chrome/WebExtension `messages.json` should work the same way;
  check their documentation for the file mask and for how region folders such as `pt_BR` are mapped.
  This project hasn't been tested against them.
- After translations are merged, run `node build.mjs` and publish the new `dist/pelican-editor.html`.

## Adding or changing a string in the code

1. Add the key to `_locales/en/messages.json` with a `message` and a `description` that tells
   translators where it appears and what must not be translated. Keys use letters, digits and
   underscores only.
2. Use it in the source: `tr('key')` in JS (`tr('key', { name: value })` for placeholders),
   or `data-i18n`, `data-i18n-title`, `data-i18n-placeholder` or `data-i18n-html` attributes in HTML.
3. Run `node build.mjs`. It reports keys the code uses that don't exist in English, and English
   keys no code uses. Other languages show the English text until they are translated.

Don't build sentences from several keys: word order differs between languages. Use one
message with placeholders instead.
