// Type declarations for `@void/lexis-editor` (the "." export).
//
// Hand-authored against the actual runtime shapes in src/ rather than
// generated — cross-check against src/elements/editor.js, src/core/editor.js,
// src/core/extensions/extension.js, and README.md before changing a member
// here, since nothing else in this repo verifies these stay in sync.
//
// Importing this entry point (or "./core") registers the `lexis-editor`,
// `lexis-toolbar`, `xui-popover`, and `xui-progress` custom elements as a
// side effect.

import type { ReadonlySignal } from "@lexical/extension";
import type { Transformer } from "@lexical/markdown";
import type { DecoratorNode, LexicalCommand, LexicalEditor } from "lexical";

// ============================================================
// Config
// ============================================================

export interface LexisToolbarConfig {
  /** Token-based template string, e.g. `"bold italic | link ~ undo redo"`. */
  template?: string;
  /** Named dropdown groups referenced by a `group-name` token in `template`. */
  groups?: Record<string, string[]>;
}

export interface LexisLexicalConfig {
  namespace?: string;
  /** Merged over the default theme (see `Editor.defaultTheme`). */
  theme?: Record<string, unknown>;
}

export interface LexisEditorConfig {
  /** Serialize as markdown (`true`, default) or sanitized HTML (`false`). */
  markdown?: boolean;
  extensions?: LexisExtensionConstructor[];
  /** Whether `extensions` is merged with or replaces the preset's defaults. */
  extensionMode?: "append" | "replace";
  lexical?: LexisLexicalConfig;
  toolbar?: LexisToolbarConfig;
}

export type LexisExtensionConstructor = new (editor: Editor) => LexisExtension;

// ============================================================
// Events
// ============================================================

export interface EditorInitializeEventDetail {
  /** Frozen snapshot of the config as resolved so far. */
  config: Readonly<LexisEditorConfig>;
  /** Patch the config before the editor instance is finalized. */
  configure(patch: LexisEditorConfig): void;
  editorElement: LexisEditorElement;
}

export interface EditorReadyEventDetail {
  editor: Editor;
  config: Readonly<LexisEditorConfig>;
}

export interface EditorChangeEventDetail {
  /** Current serialized content (markdown or sanitized HTML). */
  value: string;
}

export interface ImageInsertEventDetail {
  file: File;
}

export interface ImageUploadEventDetail {
  file: File;
  upload: {
    /** 0-100 */
    progress(percent: number): void;
    success(result: { url: string }): void;
    error(message: string): void;
  };
}

export interface ImageRemoveEventDetail {
  /** The removed image's last known url, or `null` if it couldn't be read. */
  url: string | null;
  description: string;
}

export interface LexisEditorElementEventMap {
  /** Cancelable via `configure()`'s effect, not `preventDefault()`. */
  "editor:initialize": CustomEvent<EditorInitializeEventDetail>;
  "editor:ready": CustomEvent<EditorReadyEventDetail>;
  "editor:change": CustomEvent<EditorChangeEventDetail>;
  "editor:focus": CustomEvent<undefined>;
  "editor:blur": CustomEvent<undefined>;
  /** Call `event.preventDefault()` to cancel the insert. */
  "editor:image:insert": CustomEvent<ImageInsertEventDetail>;
  "editor:image:upload": CustomEvent<ImageUploadEventDetail>;
  "editor:image:remove": CustomEvent<ImageRemoveEventDetail>;
}

// ============================================================
// Commands
// ============================================================

export interface EditorCommand<TPayload = unknown> {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string | null;
  isActive?(editor: Editor): boolean;
  isDisabled?(editor: Editor): boolean;
  register?(editor: Editor): void;
  execute(lexicalEditor: LexicalEditor, payload?: TPayload): void;
}

/**
 * Ids of the commands this library ships with. Not exhaustive of every
 * string `runCommand`/`isActive`/`isDisabled` accept — a custom extension's
 * `commands` can register its own — but covers everything in the default
 * preset and documented in the README.
 */
export type BuiltinCommandId =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "code"
  | "bullet-list"
  | "number-list"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "quote"
  | "paragraph"
  | "divider"
  | "code-block"
  | "link"
  | "unlink"
  | "insert-image"
  | "insert-table"
  | "table-add-row"
  | "table-remove-row"
  | "table-add-column"
  | "table-remove-column"
  | "table-delete"
  | "undo"
  | "redo";

/** A known id, or any other string a custom extension registered. */
export type CommandId = BuiltinCommandId | (string & {});

// ============================================================
// Editor — the core orchestration instance, accessed via
// `editorEl.editor` after `editor:ready`.
// ============================================================

export interface Editor {
  config: LexisEditorConfig;
  readonly lexicalEditor: LexicalEditor;
  readonly canUndo: ReadonlySignal<boolean> | null;
  readonly canRedo: ReadonlySignal<boolean> | null;
  readonly hostElement: LexisEditorElement | null;
  readonly supportsMarkdown: boolean;
  readonly commands: Readonly<Record<string, EditorCommand>>;
  readonly extensions: LexisExtension[];
  readonly enabledExtensions: LexisExtension[];

  /** Markdown or sanitized HTML, depending on `config.markdown`. */
  value: string;
  readonly textValue: string;
  readonly isEmpty: boolean;

  attachHostElement(hostElement: LexisEditorElement | null): void;
  selectEnd(): void;
  destroy(): void;

  registerCommand(command: EditorCommand): void;
  replaceCommand(id: CommandId, command: EditorCommand): void;
  hasCommand(id: CommandId): boolean;
  getCommand(id: CommandId): EditorCommand | null;
  runCommand(id: CommandId, payload?: unknown): void;
  isActive(id: CommandId): boolean;
  isDisabled(id: CommandId): boolean;
}

// ============================================================
// Extensions
// ============================================================

export abstract class LexisExtension {
  protected editor: Editor;
  constructor(editor: Editor);

  abstract get name(): string;
  get hostElement(): LexisEditorElement | null;
  get lexicalExtension(): unknown | null;
  get enabled(): boolean;
  get commands(): EditorCommand[];
  render(toolbarEl: LexisToolbarElement): HTMLElement | null;
  dispose(): void;
}

export class RichTextExtension extends LexisExtension {
  get name(): "rich-text";
}

export class LinkExtension extends LexisExtension {
  get name(): "link";
}

export class ImageExtension extends LexisExtension {
  get name(): "image";
  /** Grace period before warning that an upload was never resolved. */
  static UPLOAD_WARNING_DELAY_MS: number;
}

export class ClipboardExtension extends LexisExtension {
  get name(): "clipboard";
}

export class CodeBlockExtension extends LexisExtension {
  get name(): "code-block";
}

export class TableExtension extends LexisExtension {
  get name(): "table";
}

export class MarkdownExtension extends LexisExtension {
  get name(): "markdown";
}

/** Passed to `$convertToMarkdownString`/`$convertFromMarkdownString`. */
export const MARKDOWN_TRANSFORMERS: Transformer[];

/** Dispatched (no payload) by the `code-block` command's toggle button. */
export const TOGGLE_CODE_BLOCK_COMMAND: LexicalCommand<void>;

// ============================================================
// Image node
// ============================================================

export type ImageSource = "url" | "file";
export type ImageUploadStatus = "idle" | "uploading" | "error";

export const IMAGE_SOURCE: Readonly<{ URL: "url"; FILE: "file" }>;
export const UPLOAD_STATUS: Readonly<{
  IDLE: "idle";
  UPLOADING: "uploading";
  ERROR: "error";
}>;

export interface ImageNodePayload {
  url: string;
  description?: string;
  source?: ImageSource | null;
}

export class ImageNode extends DecoratorNode<unknown> {
  getUrl(): string;
  getDescription(): string;
  getUploadStatus(): ImageUploadStatus;
  setImagePayload(payload: Partial<ImageNodePayload>): void;
}

export function $createImageNode(payload: ImageNodePayload): ImageNode;
export function $isImageNode(node: unknown): node is ImageNode;

/** Dispatched with `{ url, description?, source? }`; `url` is required. */
export const INSERT_IMAGE_COMMAND: LexicalCommand<ImageNodePayload>;

// ============================================================
// Sanitizer helpers
// ============================================================

export function sanitizeHtml(html: string): string;
/** Returns the URL unchanged if safe, or `null` if it should be rejected. */
export function validateUrl(url: string): string | null;

// ============================================================
// Listener helpers (also available from the `./core` entry)
// ============================================================

export function registerEventListener(
  element: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): () => void;

export class ListenerRegistry {
  track(...listeners: Array<(() => void) | undefined>): void;
  cleanup(): void;
}

// ============================================================
// Custom elements
// ============================================================

export interface LexisEditorElement extends HTMLElement {
  readonly editor: Editor;
  readonly form: HTMLFormElement | null;
  readonly hasFocus: boolean;
  toolbar: LexisToolbarElement | null;
  value: string;

  addEventListener<K extends keyof LexisEditorElementEventMap>(
    type: K,
    listener: (
      this: LexisEditorElement,
      ev: LexisEditorElementEventMap[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<K extends keyof LexisEditorElementEventMap>(
    type: K,
    listener: (
      this: LexisEditorElement,
      ev: LexisEditorElementEventMap[K],
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

export interface LexisToolbarElement extends HTMLElement {
  buildFromTemplate(
    template: string,
    editor: Editor,
    options?: {
      buildCustomControl?: (
        token: string,
        toolbar: LexisToolbarElement,
      ) => HTMLElement | null;
      groups?: Record<string, string[]>;
    },
  ): void;
  registerControl(commandId: string, element: HTMLElement): void;
  /** Forces every control inert (used for readonly/disabled). */
  setDisabled(disabled: boolean): void;
  reflectEditorState(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "lexis-editor": LexisEditorElement;
    "lexis-toolbar": LexisToolbarElement;
  }
}
