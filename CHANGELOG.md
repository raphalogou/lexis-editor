# Changelog

All notable changes to this project are documented in this file.

## [0.2.0] - 2026-09-13

Builds on the released [0.1.5](https://git.holohc.org/ralogou/-/packages/npm/@void%2Flexis-editor/0.1.5). No breaking changes — existing configs, attributes, and the public JS API are unaffected.

### Added

- **Clipboard paste and drag-and-drop for images.** Paste an image or drop a file directly onto the editor to insert it — reuses the same `editor:image:insert` / `editor:image:upload` lifecycle as the existing toolbar image popover, so consumers who already wired that up get this for free. Dropping a non-image file is safely ignored (and no longer navigates the page away).
- **`readonly` attribute and standard `disabled` support** on `<lexis-editor>`, including via an ancestor `<fieldset disabled>`. Locks content editing and the toolbar; the toolbar freezes at its current state instead of continuing to live-update while disabled (e.g. if the host still updates `.value` on a read-only viewer).
- **Dev-mode warning** when an image inserted from a file is never resolved via `editor:image:upload` within a grace period (`ImageExtension.UPLOAD_WARNING_DELAY_MS`, default 4s) — flags a likely missing upload integration instead of silently leaving a temporary `blob:` URL that breaks on reload.
- **Automated test suite** (`npm test`): unit tests for shared config-merge helpers, plus real-browser integration tests (headless Chromium via Puppeteer, no bundled-browser download) covering image paste/drag-and-drop, readonly/disabled behavior, extension registration, and the arrow-key/decorator-navigation matrix that has historically been the most regression-prone area of this codebase.

### Fixed

- `Editor.value`'s getter and setter could disagree on whether content was markdown when `markdown: true` was configured without registering `MarkdownExtension` — the setter parsed input as HTML while the getter still serialized output as markdown.
- Registering two extensions under the same `name` silently discarded the first; this now logs a warning instead.
- The image upload `error` callback's actual signature didn't match the documented API (it expected `{ code, message }` instead of a plain message string).
- A crash could occur when inserting an image via paste or drag-and-drop before the editor had ever been focused or clicked into (a nested Lexical update corrupting reconciliation).
- Consolidated duplicated, subtly-diverging config-merge logic between two internal modules.

### Changed

- `Editor.runCommand()` now no-ops while the editor is not editable (readonly/disabled) — a centralized guard so commands can't mutate a locked editor whether triggered from the toolbar or called programmatically.

## [0.1.5] and earlier

See the [package registry](https://git.holohc.org/ralogou/-/packages/npm/@void%2Flexis-editor) for previously published versions. Changes prior to 0.2.0 are not catalogued in this file.
