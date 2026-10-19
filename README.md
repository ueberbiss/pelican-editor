# Pelican MD Editor

A single-file Markdown editor with a form for Pelican frontmatter. No install: open
`dist/pelican-editor.html` in Chrome or Edge (Firefox/Safari work, but "Save" downloads the file).

The UI is translatable. Translations are standard `messages.json` files, so
collaborative translation tools can work on them directly.

## Preview

The **Preview** button in the toolbar shows the rendered Markdown (without the frontmatter) next to
the editor. The choice is remembered. It follows Python-Markdown, which Pelican uses: a list needs a
blank line before it, nested lists need 4 spaces, `#Heading` works without a space.
Supported: headings, emphasis, code, fenced and indented code blocks, quotes, lists, tables,
links, reference links, images, rules.

The preview is built with DOM calls only (never `innerHTML`), so it is safe with the page's strict CSP:

- Raw HTML in the text is shown as text, not rendered.
- Only `http(s)` and `mailto` links are clickable (they open in a new tab). Relative links,
  `{filename}/…` and anything else show as inert text with the target in the tooltip.
- Remote images are never loaded (the page makes no network requests). Local images need a project folder, see below.
- Very long documents are cut after 300,000 characters, and paragraphs over 8,000 characters are shown as plain text.

The parser (`mdParse`) is inside the `// <pure>` block, so it is tested directly in `test/preview.test.js`.

### Project folder and media folder (images in the preview)

Click **Project folder** and choose your Pelican *project* folder (the one with `pelicanconf.py` and the
content folder, e.g. `ramenrakete`). Not a subfolder like `content/images`. The editor then shows local
images in the preview, for example `![alt]({static}/images/reviews/photo.jpg "title")`.

- The **content folder** next to the button is the Pelican `PATH` setting. It is read from
  `pelicanconf.py` (`PATH = 'content'`) and defaults to `content`. Change it if your project differs.
  A red border means the folder does not exist in the project folder. `{static}/…` paths start there, so
  any layout works (`content/images/reviews`, `content/pics`, …).
- The **Media folder** button (appears once a project is connected) chooses where your images live, anywhere
  inside the project folder. It defaults to `content/images` when that exists. The 🖼 button opens its
  file picker there. The choice is only a starting point: it doesn't limit which images can be shown.
- `{static}/x.jpg`, `{attach}/x.jpg`, `{filename}/x.jpg` and `/x.jpg` are relative to the content folder.
  `x.jpg`, `./x.jpg`, `../x.jpg` and `{static}x.jpg` are relative to the Markdown file. That folder is only
  known for files opened with **Open** that sit inside the project folder; otherwise the content folder is assumed.
- The 🖼 button inserts `![](…)` with the correct `{static}/…` path (several files at once are possible).
  Images outside the content folder are refused with a message.
- A missing, oversized (>25 MB) or broken image stays a dashed placeholder; the tooltip says which path was looked up.
- The folder is only **read**. Nothing is uploaded, copied or changed, and paths cannot leave the content folder
  (`..`, encoded `..`, backslashes and URL schemes are refused). Remote `http(s)` images still show as placeholders.
- The folders are remembered (IndexedDB). After a browser restart one click on **Reconnect project folder** grants access again.
- Works in **Chrome and Edge** only (File System Access API). In other browsers the button is disabled.
  Firefox/Safari support is a known gap.
- The page's CSP allows `img-src data: blob:`: images come from `blob:` URLs the page creates itself, never from the network.

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
