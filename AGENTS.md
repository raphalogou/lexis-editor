# AGENTS.md

## Big picture
- `lexis-editor` is a custom-element wrapper around Lexical; runtime entry is `src/main.js` (registers `lexis-editor`, `lexis-toolbar`, `el-popover`, `ui-progress`).
- Core orchestration lives in `src/core/editor.js` (`Editor` class): builds Lexical from extensions, registers commands, caches `value`/`textValue`, and switches output between Markdown and sanitized HTML.
- UI host is `src/elements/editor.js` (`LexisEditorElement`): form-associated element (`attachInternals`), lifecycle events (`editor:initialize` -> `editor:ready`), toolbar attachment, and `editor:change` dispatch.
- Extension boundary: classes extending `src/core/extensions/extension.js` (`LexisExtension`) provide `lexicalExtension`, optional `commands`, optional toolbar `render()`, and `dispose()` cleanup.

## Architecture patterns to follow
- Add editor features primarily as extensions (`src/core/extensions/*`) and only then wire commands/UI.
- Keep command contracts compatible with `EditorCommand` in `src/core/editor.js` (`id`, `label`, `icon`, `execute`, optional `isActive`/`isDisabled`/`register`).
- Register command collections via `src/core/commands/index.js`; extension-local commands come from each extension `get commands()`.
- Respect toolbar token grammar from `src/helper/toolbar-builder.js`: tokens map to command ids; `|` is separator, `~` is spacer, group tokens map via `toolbar.groups`.
- Use `ListenerRegistry` (`src/helper/listener.js`) for every listener/mutation subscription to guarantee teardown in `dispose()`/`disconnectedCallback()`.

## High-impact flows
- Config flow: consumers patch config during `editor:initialize` (`event.detail.configure(...)`) before editor instantiation is finalized (`src/elements/editor.js`).
- Content flow: `editor.value` serializes with `MARKDOWN_TRANSFORMERS` (`src/core/extensions/markdown.js`) when `markdown=true`, otherwise exports sanitized HTML (`src/helper/sanitizer.js`).
- Image flow (`src/core/extensions/image.jsx` + `src/core/nodes/image-node.js`):
  - URL mode validates via `validateUrl()`.
  - File mode inserts optimistic blob URL, emits `editor:image:insert` (cancelable), then `editor:image:upload` with `{ success, progress, error }` callbacks.
  - Blob URLs are revoked when nodes are destroyed (mutation listener).
- Keyboard edge cases are intentionally handled in extensions, especially decorator/image and code block navigation (`src/core/extensions/rich-text.js`, `src/core/extensions/code-block.js`).

## Project-specific conventions
- JSX is custom: Vite OXC pragma is `h`/`Fragment` with alias `jsx-runtime -> src/helper` (`vite.config.js`, `src/helper/jsx-runtime.js`); do not assume React.
- DOM construction mostly uses `createElement`/`h` helpers (`src/helper/html.js`), with `data-slot` and `data-command` attributes as styling/behavior hooks.
- URL and HTML safety are explicit (`validateUrl`, `sanitizeHtml`); preserve these checks when adding link/image/paste features.
- Logging uses `logger` (`src/core/logger.js`); debug output is intended for dev diagnostics.

## Developer workflows
- Install and run:
  - `npm install`
  - `npm run dev`
- Quality gates used in this repo:
  - `npm run build:check` (Biome check on `src/` and `test/`)
  - `npm run lint`
  - `npm run build`
  - `npm test` (unit tests via `node --test`, plus real-browser integration tests via `puppeteer-core` against a throwaway Vite dev server — see `test/browser/helpers.mjs`; jsdom can't faithfully test contentEditable/Selection/DataTransfer/caretRangeFromPoint, so these use an actual Chromium/Chrome already on the machine, no download)
- The arrow-key/decorator navigation hotspot now has automated coverage (`test/browser/arrow-key-navigation.test.js`), but still validate toolbar state, selection transitions, and the image upload lifecycle manually too — automated coverage is real but not exhaustive.

## Integration points for consumers
- Listen to editor lifecycle/events on `lexis-editor`: `editor:initialize`, `editor:ready`, `editor:change`, `editor:focus`, `editor:blur`.
- Intercept image lifecycle via bubbling events in `src/main.js`: `editor:image:insert` and `editor:image:upload`.
- External toolbar is supported via `toolbar` attribute in `LexisEditorElement` (`false`, element id, inline toolbar element, or template string behavior).
