# Lexis Editor

A drop-in rich text editor built on [Lexical](https://lexical.dev/), packaged as a form-native web component.

## Why Lexis Editor?

- **Zero config** — Add `<lexis-editor>` to any form and it just works
- **Markdown native** — Built-in markdown import/export, toggle with one option
- **Form integration** — Works with native HTML forms, validation, reset/restore
- **Extensible** — Add features by implementing `LexisExtension` classes
- **Toolbar included** — Built-in toolbar with familiar formatting controls

## Installation

```bash
npm install @void/lexis-editor
```

```javascript
// main.js
import '@void/lexis-editor';
import '@void/lexis-editor/lexis-editor.css';
import '@void/lexis-editor/lexis-content.css';
```

## Quick Start

```html
<form method="get">
  <lexis-editor
    name="content"
    value="# Hello World"
    placeholder="Write something..."
  ></lexis-editor>
  <button type="submit">Save</button>
</form>
```

That's it. The editor handles form submission, validation, and content serialization automatically.

## Examples

### Full-Featured Editor

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blog Editor</title>
  <script type="module">
    import '@void/lexis-editor';
    import '@void/lexis-editor/lexis-editor.css';
    import '@void/lexis-editor/lexis-content.css';

    const editor = document.querySelector('lexis-editor');

    // Configure before initialization
    editor.addEventListener('editor:initialize', (e) => {
      e.detail.configure({
        markdown: true,
        toolbar: {
          template: 'format list link ~ history'
        }
      });
    });

    // Listen for changes
    editor.addEventListener('editor:change', (e) => {
      console.log('Content:', e.detail.value);
    });
  </script>
</head>
<body>
  <form>
    <lexis-editor
      name="post"
      value="## Title\n\nStart writing..."
      required
      placeholder="Enter your post content..."
    ></lexis-editor>
    <button type="submit">Publish</button>
    <button type="reset">Reset</button>
  </form>
</body>
</html>
```

See [Images](#images) for the full upload/insert/remove event flow.

## Features

| Text | Blocks | Media | Output |
|------|--------|-------|--------|
| Bold, italic, underline | Headings (1-4) | Images (URL or file, paste/drag-and-drop) | Markdown |
| Strikethrough, inline code | Blockquotes | Links with validation | Sanitized HTML |
| — | Code blocks (Prism) | — | — |
| — | Bullet/numbered lists | — | — |
| — | Horizontal dividers | — | — |
| — | Tables (GFM markdown) | — | — |

## Images

Users can insert an image three ways — the toolbar's image picker (URL or file), pasting from the clipboard, or dragging a file into the editor. All three go through the same three-event lifecycle:

1. **`editor:image:insert`** fires first, with `detail.file` — the picked/pasted/dropped `File`. Call `event.preventDefault()` to reject it before anything is inserted.
2. **`editor:image:upload`** fires immediately after a file-based insert is accepted. An optimistic blob preview is already showing; resolve `detail.upload` to replace it with a durable URL.
3. **`editor:image:remove`** fires whenever an image node is deleted from the document (backspace, cut, etc.), with the image's last known `url`/`description`, useful for cleaning up server-side storage.

### Validating inserts

```javascript
document.addEventListener('editor:image:insert', (event) => {
  const { file } = event.detail;

  if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    event.preventDefault(); // rejected — nothing is inserted
  }
});
```

### Uploading files

```javascript
document.addEventListener('editor:image:upload', (event) => {
  const { file, upload } = event.detail;

  // file.name — the uploaded filename
  // upload.progress(n) — update progress (0-100)
  // upload.success({ url }) — signal completion
  // upload.error(message) — signal failure

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      upload.progress((e.loaded / e.total) * 100);
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      const { url } = JSON.parse(xhr.responseText);
      upload.success({ url });
    } else {
      upload.error('Upload failed');
    }
  };

  xhr.send(file);
});
```

Leaving `editor:image:upload` unhandled isn't silently ignored, the console warns after a few seconds that an image is still "uploading", since without a resolved URL its blob preview won't survive a reload.

Pasting an image from the clipboard or dragging one into the editor goes through this exact same flow, no extra wiring needed to support them.

### Cleaning up on removal

```javascript
document.addEventListener('editor:image:remove', (event) => {
  const { url, description } = event.detail;

  if (url) {
    fetch(`/api/upload?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
  }
});
```

### Inserting programmatically

Bypasses the picker/paste/drag flow entirely, no `editor:image:insert`/`editor:image:upload` events fire, since there's no file to insert or upload:

```javascript
editor.runCommand('insert-image', {
  url: 'https://example.com/photo.png',
  description: 'A photo',
});
```

## Tables

Insert a table via the `insert-table` toolbar token/command, it starts as a 3×3 grid with a header row. Tables round-trip through markdown as GFM pipe tables (`| a | b |`), including inline formatting (bold, links, code) inside cells.

When the caret is inside a table cell, a floating panel appears above the table with row/column controls, add/remove row, add/remove column, delete table. Hovering a control previews what it'll affect: red for removals, blue for the edge where a new row/column will be inserted.

**Current limitations**: no merged cells, no column alignment (`:--`/`--:`), and typing a pipe-delimited table by hand isn't recognized until the divider row (`| --- |`) is complete, only inserting, pasting, or loading markdown creates a real table.

## Readonly & Disabled

```html
<lexis-editor readonly value="# Locked content"></lexis-editor>
```

`readonly` makes the editor non-editable while still submitting its value with the form. `disabled` behaves the same way but also excludes the field from form submission entirely, like any other form control, it's also set automatically when the editor sits inside a `<fieldset disabled>`:

```html
<fieldset disabled>
  <lexis-editor name="content"></lexis-editor>
</fieldset>
```

While non-editable, the toolbar's controls are all disabled and stop reflecting live selection state.

## Configuration

### Initialization Lifecycle

Two events bracket setup:

```javascript
const editor = document.querySelector('lexis-editor');

// 1. Fires before the editor instance is built, the only point at which
//    configure() has any effect.
editor.addEventListener('editor:initialize', (e) => {
  e.detail.configure({
    markdown: true,
    toolbar: { template: 'format | list link' },
  });
});

// 2. Fires once the editor instance exists and is attached.
editor.addEventListener('editor:ready', (e) => {
  const { editor: instance } = e.detail; // same object as `editor.editor`
  console.log('Ready with commands:', Object.keys(instance.commands));
});
```

### Available Options

```javascript
e.detail.configure({
  markdown: true,           // Output format: true=markdown, false=HTML
  extensionMode: 'append',  // 'append' or 'replace'
  extensions: [],           // Custom LexisExtension classes
  lexical: {
    namespace: '@my/editor',
    theme: {                 // Custom CSS class mappings
      text: { bold: 'my-bold' }
    }
  },
  toolbar: {
    template: 'format | list link',
    groups: { list: ['bullet-list', 'number-list' ]}               // Named command groups
  }
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `markdown` | boolean | `true` | Serialize as markdown or HTML |
| `extensions` | array | `[]` | Add custom extensions |
| `extensionMode` | string | `'append'` | How to merge extensions |
| `toolbar` | object | `{}` | Toolbar template and groups |
| `lexical` | object | `{}` | Lexical namespace and theme |

### Presets

The `preset` attribute picks which extension/toolbar defaults `extensions`/`toolbar` build on top of:

```html
<!-- Default: markdown output, all built-in extensions (tables, images, code blocks, links, lists…) -->
<lexis-editor></lexis-editor>

<!-- "simple": HTML output, only bold/italic/underline/link/undo/redo -->
<lexis-editor preset="simple"></lexis-editor>
```

### Programmatic Setup

Everything above also works without writing any `<lexis-editor>` markup:

```javascript
import '@void/lexis-editor';

const editor = document.createElement('lexis-editor');
editor.setAttribute('name', 'content'); // needed for FormData submission

editor.addEventListener('editor:initialize', (e) => {
  e.detail.configure({ toolbar: { template: 'bold italic ~ undo redo' } });
});

document.body.append(editor);
```

### Custom Extensions

Add features by subclassing `LexisExtension` — at minimum, a `name` and a `commands` list:

```javascript
import { LexisExtension } from '@void/lexis-editor';
import { $getSelection, $isRangeSelection } from 'lexical';

class TimestampExtension extends LexisExtension {
  get name() {
    return 'timestamp';
  }

  get commands() {
    return [
      {
        id: 'insert-timestamp',
        label: 'Insert timestamp',
        execute(lexicalEditor) {
          lexicalEditor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              selection.insertText(new Date().toLocaleString());
            }
          });
        },
      },
    ];
  }
}

editor.addEventListener('editor:initialize', (e) => {
  e.detail.configure({
    extensions: [TimestampExtension],
    toolbar: { template: 'bold italic | insert-timestamp' },
  });
});
```

Extensions that need their own Lexical nodes/commands (like the built-in table, image, and code-block extensions) also implement a `lexicalExtension` getter — see `src/core/extensions/` in this repo for real examples.

### Mentions (prompt extensions)

`MentionExtension` is opt-in. Typing `@` opens an inline menu; picking an item inserts an atomic mention chip (Backspace removes it whole). The host page supplies the items:

```javascript
import { MentionExtension } from '@void/lexis-editor';

editor.addEventListener('editor:initialize', (e) => {
  e.detail.configure({ extensions: [MentionExtension] });
});

editor.addEventListener('editor:mention:search', (e) => {
  const { query, signal, respond } = e.detail;
  fetch(`/api/users?q=${encodeURIComponent(query)}`, { signal })
    .then((r) => r.json())
    .then((users) => respond(users.map((u) => ({ id: u.id, label: u.name, description: u.email }))));
});
```

Mentions serialize as `@[Ada Lovelace](ada)` in markdown and `<a data-mention-id="ada" data-mention-trigger="@">@Ada Lovelace</a>` in HTML. Item ids can't contain spaces or parentheses.

`MentionExtension` is built on `PromptExtension`, a base class for any trigger-character menu (hashtags, slash commands, emoji…): subclass it, set `name` and `trigger`, and implement `search(query, { signal })` and `$createNode(item)`. Add `nodes` and `markdownTransformers` if it inserts its own node type.

## Toolbar Configuration

The toolbar uses a token-based template system.

### Template Syntax

| Token | Description |
|-------|-------------|
| `\|` | Separator between controls |
| `~` | Spacer (flex gap) |
| `command-id` | Single command button (e.g., `bold`, `italic`) |
| `group-name` | Dropdown group (requires `toolbar.groups`) |
| Extension token | Custom control from extension (e.g., `link`) |

### Built-in Command Tokens

**Format**:
- `bold`, `italic`, `underline`, `strikethrough`, `code`

**Lists**:
- `bullet-list`, `number-list`

**Blocks**:
- `heading-1`, `heading-2`, `heading-3`, `heading-4`
- `quote`, `paragraph`, `divider`, `code-block`

**Media**:
- `link` (extension-provided, shows popover)
- `insert-image`

**Tables**:
- `insert-table`
- `table-add-row`, `table-remove-row`, `table-add-column`, `table-remove-column`, `table-delete` — normally surfaced via the contextual floating panel (see [Tables](#tables)), but usable as toolbar tokens too

**History**:
- `undo`, `redo`

### Groups

Create dropdown groups by defining `toolbar.groups`:

```javascript
e.detail.configure({
  toolbar: {
    template: 'format headings history',
    groups: {
      headings: ['heading-1', 'heading-2', 'heading-3', 'paragraph']
    }
  }
});
```

### Disabling Toolbar

```html
<lexis-editor toolbar="false"></lexis-editor>
```

## Events

| Event | Description |
|-------|-------------|
| `editor:initialize` | Configure before ready (cancelable config patch) |
| `editor:ready` | Editor initialized, `detail.editor` available |
| `editor:change` | Content changed, `detail.value` contains current content |
| `editor:focus` | Editor gained focus |
| `editor:blur` | Editor lost focus |
| `editor:image:insert` | Image about to insert (call `preventDefault()` to cancel) |
| `editor:image:upload` | Image file upload with progress callbacks |
| `editor:image:remove` | Image node removed; `detail.url`/`detail.description` reflect its last known state |

## API

After `editor:ready`:

```javascript
const { editor } = event.detail;

// Content
editor.value        // Markdown or HTML string
editor.textValue    // Plain text
editor.isEmpty      // Boolean

// Commands
editor.runCommand('bold');
editor.runCommand('heading-2');
editor.runCommand('insert-image', { url: 'https://example.com/photo.png' }); // some commands take a payload

// State
editor.isActive('italic');      // true/false
editor.isDisabled('undo');      // true/false
```

### Available Commands

| Category | Commands |
|----------|----------|
| **Format** | `bold`, `italic`, `underline`, `strikethrough`, `code` |
| **Lists** | `bullet-list`, `number-list` |
| **Blocks** | `heading-1`, `heading-2`, `heading-3`, `heading-4`, `quote`, `paragraph`, `divider`, `code-block` |
| **Media** | `link`, `unlink`, `insert-image` |
| **Tables** | `insert-table`, `table-add-row`, `table-remove-row`, `table-add-column`, `table-remove-column`, `table-delete` |
| **History** | `undo`, `redo` |

## TypeScript

Type declarations are included — no `@types` package needed. `@void/lexis-editor` types `LexisEditorElement`, `Editor`, `EditorCommand`, and every event's `detail` shape, plus the importable `LexisExtension` base class for writing custom extensions; `@void/lexis-editor/core` types the lighter headless-preset surface.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run build:check  # Biome check
npm run lint         # Biome lint
```

The `index.html` file provides a working demo with toolbar, form integration, and image upload simulation.
