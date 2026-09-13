# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev           # Vite dev server (uses index.html as a live demo/playground)
npm run build          # Production library build (Vite lib mode, ES + CJS)
npm run preview        # Preview the production build
npm run build:check     # Biome check (lint + format check) on src/
npm run lint          # Biome lint on src/
npm run format         # Biome format on src/
```

There is no automated test suite configured. Validate behavior manually via `npm run dev` and the demo in `index.html` — pay particular attention to toolbar state, selection/keyboard transitions, and the image upload lifecycle, since these are the most regression-prone areas (see Hotspots below).

To run a single check, scope Biome to a path: `npx biome check src/core/extensions/image.jsx`.

## Architecture

`lexis-editor` is a custom-element (`<lexis-editor>`) wrapper around [Lexical](https://lexical.dev/), packaged as a form-native web component library. `src/main.js` is the runtime entry point and registers the custom elements: `lexis-editor`, `lexis-toolbar`, `el-popover`, `ui-progress`.

**Core orchestration** — `src/core/editor.js` (`Editor` class): builds the Lexical editor from extensions, registers commands, caches `value`/`textValue`, and switches serialized output between Markdown and sanitized HTML.

**UI host** — `src/elements/editor.js` (`LexisEditorElement`): the form-associated custom element (uses `attachInternals`). Owns the lifecycle (`editor:initialize` → `editor:ready`), toolbar attachment, and `editor:change` dispatch.

**Extension boundary** — classes extending `src/core/extensions/extension.js` (`LexisExtension`) are the primary way to add editor features. Each extension provides a `lexicalExtension`, optional `commands`, an optional toolbar `render()`, and `dispose()` cleanup. Wire features as extensions first, then commands/UI on top — don't bypass this boundary.

### Key flows

- **Config**: consumers patch config during `editor:initialize` via `event.detail.configure(...)` before the editor instance is finalized (`src/elements/editor.js`). Config is cloned/frozen after this point.
- **Content serialization**: `editor.value` uses `MARKDOWN_TRANSFORMERS` (`src/core/extensions/markdown.js`) when `markdown: true`, otherwise exports sanitized HTML via `src/helper/sanitizer.js`. Preserve `validateUrl`/`sanitizeHtml` checks when touching link/image/paste code — URL and HTML safety are explicit and load-bearing here.
- **Images** (`src/core/extensions/image.jsx` + `src/core/nodes/image-node.js`): URL mode validates via `validateUrl()`; file mode inserts an optimistic blob URL, emits cancelable `editor:image:insert`, then `editor:image:upload` with `{ success, progress, error }` callbacks. Blob URLs are revoked on node destruction via a mutation listener. Blob URLs are not durable across reload/export without a real upload/persistence layer — this is a known gap, not a bug to silently "fix" with a workaround.
- **Toolbar**: token grammar lives in `src/helper/toolbar-builder.js`. Tokens map to command ids; `|` is a separator, `~` is a spacer, group tokens resolve via `toolbar.groups`. Command collections are registered via `src/core/commands/index.js`; extension-local commands come from each extension's `get commands()`.
- **Commands**: keep any new command compatible with the `EditorCommand` contract in `src/core/editor.js` (`id`, `label`, `icon`, `execute`, optional `isActive`/`isDisabled`/`register`).
- **Cleanup**: use `ListenerRegistry` (`src/helper/listener.js`) for every Lexical listener/mutation subscription so teardown happens correctly in `dispose()`/`disconnectedCallback()`. `LexisEditorElement`'s disconnect cleanup is factored out separately so it can be invoked manually for frontend frameworks that detach/reattach the DOM without a real disconnect (e.g. Turbo).

### Conventions

- JSX is **not** React. Vite's OXC JSX pragma is `h`/`Fragment` with `jsx-runtime` aliased to `src/helper` (see `vite.config.js`, `src/helper/jsx-runtime.js`). DOM construction otherwise uses the `createElement`/`h` helpers in `src/helper/html.js`, with `data-slot` and `data-command` attributes as styling/behavior hooks.
- Logging goes through `logger` (`src/core/logger.js`) — intended for dev diagnostics, not user-facing errors.
- The library builds two entry points (`src/core.js`, `src/index.js`) plus two CSS bundles (`lexis-editor.css`, `lexis-content.css`) as separate lib outputs (see `vite.config.js`). Lexical, DOMPurify, marked, and Prism are externalized, not bundled.

### Integration points (consumer-facing)

- Lifecycle/content events on `<lexis-editor>`: `editor:initialize`, `editor:ready`, `editor:change`, `editor:focus`, `editor:blur`.
- Image lifecycle (bubbling, wired in `src/main.js`): `editor:image:insert` (cancelable), `editor:image:upload` (progress/success/error callbacks).
- External toolbar: the `toolbar` attribute on `<lexis-editor>` accepts `false`, an element id, an inline toolbar element, or a template string.
- Full config shape, toolbar template syntax, built-in command ids, and the JS API (`editor.value`, `editor.runCommand()`, `editor.isActive()`, etc.) are documented in `README.md` — check it before inventing a new option name or command id.

### Current hotspots

- Decorator-node ArrowUp/ArrowDown selection behavior (`src/core/extensions/rich-text.js`, code block navigation in `src/core/extensions/code-block.js`) is the most regression-prone area in the codebase — it has been fixed multiple times. Test keyboard navigation around images/decorators and code blocks manually after touching selection logic.
- Image caption editing, popover source-mode state (Upload vs. From URL), and blob URL persistence are an active area of change — see `PROJECT_STATE.md` for the current state of in-progress image work if it still reflects reality (verify against the code, it can go stale).
