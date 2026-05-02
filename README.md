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

### Image Upload Handler

```javascript
import '@void/lexis-editor';

// Handle image file uploads
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

## Features

| Text | Blocks | Media | Output |
|------|--------|-------|--------|
| Bold, italic, underline | Headings (1-4) | Images (URL or file) | Markdown |
| Strikethrough, inline code | Blockquotes | Links with validation | Sanitized HTML |
| — | Code blocks (Prism) | — | — |
| — | Bullet/numbered lists | — | — |
| — | Horizontal dividers | — | — |

## Configuration

Configure via the `editor:initialize` event:

```javascript
element.addEventListener('editor:initialize', (e) => {
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
});
```

### Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `markdown` | boolean | `true` | Serialize as markdown or HTML |
| `extensions` | array | `[]` | Add custom extensions |
| `extensionMode` | string | `'append'` | How to merge extensions |
| `toolbar` | object | `{}` | Toolbar template and groups |
| `lexical` | object | `{}` | Lexical namespace and theme |

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
| **History** | `undo`, `redo` |

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run build:check  # Biome check
npm run lint         # Biome lint
```

The `index.html` file provides a working demo with toolbar, form integration, and image upload simulation.
