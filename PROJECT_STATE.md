# Project State Snapshot

This file is a restart-ready summary of the current `lexis-editor` project state. Last refreshed 2026-09-13 (uncommitted work on top of commit `ac84a9c`).

## Overview

- Stack: Lexical + custom web components.
- Main elements:
  - `lexis-editor`
  - `lexis-toolbar`
  - `el-popover` (custom element tag `xui-popover`)
- Styling strategy: CSS variables (`--lexis-*`) and scoped hooks (`data-slot`, classes).
- Automated tests exist now (`test/`) — see "Testing" below. Previously there were none.

## Implemented Features

### Editor lifecycle and config

- Build-time configuration via:
  - `editor:initialize` (`detail.configure(...)`)
  - `editor:ready`
- Config cloning/freezing is in place.
- Toolbar can be:
  - default/internal
  - external by id
  - inline template
  - disabled
- Manual disconnect cleanup is exposed separately from `disconnectedCallback` so frameworks that detach/reattach DOM without firing a real disconnect (e.g. Turbo) can call it explicitly.
- `deepMergeObjects`/`isPlainObject` used to be duplicated (and subtly diverged — one skipped `undefined` overrides, the other didn't) between `src/helper/utils.js` and `src/elements/editor.js`. Consolidated to the single `helper/utils.js` implementation.
- Registering two extensions under the same `name` used to silently clobber the first; now logs a `logger.warn`.
- `Editor.value`'s getter and setter used to disagree on whether markdown mode required `MarkdownExtension` to be registered (getter didn't check, setter did) — a config like `markdown: true` without that extension (e.g. the "simple" preset overridden) would read as markdown but parse input as HTML. Both now key off `supportsMarkdown` alone.

### Read-only / disabled mode (new this session)

- `readonly` attribute (observed via `attributeChangedCallback`) and the standard `disabled` form-associated lifecycle (`formDisabledCallback`, which also fires for an ancestor `<fieldset disabled>` — no attribute-watching hack needed).
- `LexisEditorElement#syncEditableState()` (`src/elements/editor.js`) applies both: toggles `contentEditable`, calls `lexicalEditor.setEditable()`, sets `aria-readonly`/`aria-disabled` and `data-readonly`/`data-disabled` on the content root, and force-disables the toolbar.
- `LexisToolbarElement.setDisabled(bool)` (`src/elements/toolbar.js`) forces every control inert regardless of per-command state. While forced disabled, the toolbar also **stops reacting** to further editor updates/focus (`#reflectEditorStateUnlessDisabled`) — it freezes at whatever it showed the instant it went non-editable, rather than continuing to live-update (e.g. if the host still calls `editor.value = ...` on a readonly viewer). Resumes live reflection immediately once re-enabled.
- `Editor.runCommand()` (`src/core/editor.js`) now refuses to execute while `!lexicalEditor.isEditable()` — a central guard so any command (toolbar-triggered or programmatic) is a no-op while non-editable, not just typing.
- Known, **intentional** exception: the link extension's popover "Apply" button intentionally shares the `"link"` command id with the toolbar trigger button, so they collide in the toolbar's single button-map slot — only the trigger reflects disabled/active state; the Apply button stays visually enabled while readonly. This is safe because `runCommand`'s central guard still no-ops it. Do not "fix" this collision — it's how the link controller super-powers the link command's UI/UX.
- `contentEditable = false` does not stop native `drop` events (only `paste`, which requires focus) — `ImageExtension`'s `PASTE_COMMAND`/`DRAGOVER_COMMAND`/`DROP_COMMAND` handlers each explicitly check `lexicalEditor.isEditable()` first.

### Toolbar system

- Template tokens with separators/spacers/groups.
- Group select state reflection and fallback reset behavior.
- Command icons supported via command `icon` field (SVG markup).
- Default toolbar group previously named `group` is now named `block` (see `src/editor/default.js`).

### Popover system

- `el-popover` (`xui-popover`) supports `label`, `placement`, `offset`, `open`.
- Popovers now have a default, overridable UI (refactored so consumers can override panel markup while keeping built-in behavior) — see `src/elements/popover.js`.
- Supports both light/auto and slotted usage patterns.

### Code block

- Language picker + prism highlighting.
- ArrowDown/ArrowUp handling from code blocks exists and has undergone several fixes.

### Arrow-key / decorator navigation

- `RichTextExtension` (`src/core/extensions/rich-text.js`) owns `KEY_ARROW_UP_COMMAND`/`KEY_ARROW_DOWN_COMMAND` handling for moving into/out of decorator nodes (e.g. images) and between consecutive decorator nodes.
- The most regression-prone area historically (multiple fix commits) — **now has automated coverage**: `test/browser/arrow-key-navigation.test.js` builds `<p>before</p><figure image1/><figure image2/><p>after</p>` and drives real ArrowUp/ArrowDown key presses through the full matrix (paragraph→image, image→image, image→paragraph, both directions) plus the "decorator with no next sibling" auto-paragraph-insert branch. Still verify manually too for anything this matrix doesn't cover (code-block-adjacent arrow behavior, caption-input arrow handling).

### Image support

- Node: `src/core/nodes/image-node.js` (`ImageNode`, a `DecoratorNode`). Fields are `url`, `description` (caption), `source` (`url` | `file`), and `upload` (`{status, progress, error}`). There is no `title` field. `getUploadStatus()` getter added this session.
- DOM output: `figure.editor-image` > `img` + upload overlay (`data-slot="upload-progress"` / `"upload-error"`) + `figcaption` (with an `<input>` for inline caption editing).
- Command: `insert-image` (dispatches `INSERT_IMAGE_COMMAND`).
- Extension: `src/core/extensions/image.jsx`. Popover UI uses a two-tab layout (`Upload File` / `From URL`, both reachable via tabs — not a hide/reveal toggle).
- Image insertion flow:
  - **URL mode**: validates via `validateUrl()`, inserts directly with `source: "url"`.
  - **File mode**: shared by the popover file picker, clipboard paste, and drag-and-drop via `#insertFileAsImage()`. Creates an optimistic blob URL, emits cancelable `editor:image:insert`, then dispatches `editor:image:upload` with `{ file, upload: { progress(n), success({url}), error(message) } }`. `upload.error` takes a plain string message.
  - Blob URLs are revoked via a `registerMutationListener(ImageNode, ...)` when the node is destroyed.
- **Clipboard paste and drag-and-drop for images** (new this session): `ImageExtension` registers `PASTE_COMMAND`/`DRAGOVER_COMMAND`/`DROP_COMMAND`. Dropping resolves the drop point to a Lexical selection via `document.caretRangeFromPoint`/`caretPositionFromPoint` (`#selectDropTarget`) so the image lands near the cursor. Non-image file drops are ignored but still `preventDefault()`-ed so the browser doesn't navigate away. Plain-text/markdown paste (handled separately by `ClipboardExtension`) is unaffected.
  - **Important gotcha, already fixed once — don't reintroduce it**: `PASTE_COMMAND`/`DROP_COMMAND` fire from *inside* an already-active Lexical update. Calling `Editor.runCommand()` (which triggers `INSERT_IMAGE_COMMAND`'s own `lexicalEditor.update()`) synchronously from within that handler creates a **nested update that corrupts reconciliation** (`"Expected node N to have a parent"`, thrown by Lexical's internal `insertNodes`). Fixed by deferring the insertion via `queueMicrotask`. Establishing a fallback selection (`#ensureSelection`, for when there was never a prior click/focus — a real scenario for drag-and-drop) must also run as its own separate `lexicalEditor.update()` *before* the insertion's update, not fused into the same pass. See `test/browser/image-clipboard.test.js`'s "no prior click/focus" test, which exists specifically to catch a regression here.
- A dev-mode warning (`ImageExtension.UPLOAD_WARNING_DELAY_MS`, default 4000ms) fires via `logger.warn` if a file image is still `"uploading"` after the grace period — almost always means `editor:image:upload` was never wired up. Cancelled the moment `success`/`progress`/`error` is called.
- Image selected state is reflected through `data-selected` attribute updates, driven by `SELECTION_CHANGE_COMMAND` + click handling.

### Markdown

- Image transformer (`src/core/extensions/markdown.js`) maps markdown image syntax to the caption-oriented (`description`) payload, with escape/unescape helpers for markdown-special characters in alt text.

## Testing (new this session)

- `test/unit/` — plain `node --test`, no browser. Pure-logic checks (currently `helper/utils.js`'s merge behavior).
- `test/browser/` — real headless Chromium via `puppeteer-core`, pointed at whatever Chrome/Chromium is already installed (`PUPPETEER_EXECUTABLE_PATH` or common paths — no bundled-browser download, no network dependency). Drives a throwaway Vite dev server serving `test/fixtures/`. Exists because jsdom doesn't faithfully implement contentEditable, native Selection/Range, `DataTransfer`/`ClipboardEvent`/`DragEvent`, or `document.caretRangeFromPoint` — Lexical genuinely needs a real browser.
  - `image-clipboard.test.js`: paste/drop insertion (incl. the no-prior-focus regression case above), plain-text paste unaffected, non-image drop ignored without navigating away, upload-warning heuristic (wired vs. unwired).
  - `editable-state.test.js`: readonly/disabled/fieldset-disabled, toolbar force-disable + frozen (non-reactive) state, central `runCommand` guard.
  - `extension-config.test.js`: extension name-collision warning, markdown getter/setter consistency.
  - `arrow-key-navigation.test.js`: the full ArrowUp/ArrowDown decorator matrix (see above).
  - Gracefully skips (with a clear reason) if no Chromium/Chrome binary is found, rather than failing.
  - Gotcha #1: a bare `import("lexical")` inside `page.evaluate()` fails — Vite only rewrites bare specifiers for files it transforms. Re-export what's needed from a `test/fixtures/*.js` file and dynamically import that instead (see `lexical-utils.js`).
  - Gotcha #2 (cost real debugging time — don't redo this): position the caret for a test via Lexical's own `$`-API (`paragraph.selectStart()`/`.selectEnd()` inside `lexicalEditor.update()`, then `lexicalEditor.focus()`), **not** by clicking pixel coordinates computed from `getBoundingClientRect()`. A coordinate click near an element whose size depends on an unloaded/fake image (or any other async-layout-dependent box) is genuinely flaky — it was passing ~70% of the time, which is exactly the kind of failure rate that's easy to mistake for "probably fine." Only use a real click when the click itself is what's under test (e.g. clicking a decorator to select it).
  - Gotcha #3: when a test fires two key presses back-to-back with no yield in between, don't bracket them with a fixed `setTimeout` delay and hope it's long enough — poll for the actual expected end state with `page.waitForFunction(...)` instead. A fixed delay that happens to be enough on your machine today is a future flake.
- Run everything: `npm test`. Biome now also lints/checks `test/` (`npm run lint` / `build:check`).
- **Not covered yet**: code block behavior, caption editing, link popover.

## Current Hotspots / Risks

- Decorator-node ArrowUp/ArrowDown behavior is still the most regression-prone area historically — now with automated coverage (`test/browser/arrow-key-navigation.test.js`), but still worth manual re-verification for anything outside that exact matrix (code-block boundaries, caption input focus).
- Blob URLs are not durable across reload/export without an upload/persistence layer — mitigated (not solved) by the new dev-mode warning when `editor:image:upload` is never wired up.
- The link toolbar/popover button-map collision (see above) is intentional and safe, but means the toolbar's "link" trigger button may never show an active/highlighted state when the cursor is inside a link — not something to fix, just don't be surprised by it.

## Next Planned Steps

1. Consider whether other extensions' command handlers (code-block, link, list) need their own `isEditable()` guards for defense-in-depth beyond the central `runCommand` guard, the way `ImageExtension`'s paste/drop handlers do (needed there specifically because `drop` bypasses `contentEditable`).
2. Extend browser-test coverage to code block arrow-key boundaries (`CodeBlockExtension#handleArrowDownInCodeBlock`) and caption-input editing, using the same real-keyboard-event approach as `arrow-key-navigation.test.js`.
3. Re-audit `PROJECT_STATE.md` after any further popover/image/arrow-nav/readonly changes — it drifts quickly relative to that code.

## Resume Checklist

When resuming work:

1. Verify behavior in these files first:
   - `src/core/extensions/image.jsx`
   - `src/core/extensions/rich-text.js`
   - `src/elements/editor.js` / `src/elements/toolbar.js` (readonly/disabled)
2. Re-run:
   - `npm run build:check`
   - `npm run build`
   - `npm test`
3. Validate keyboard navigation matrix manually before further refactors (still no automated coverage there).
