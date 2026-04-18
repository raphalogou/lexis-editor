import { buildEditorFromExtensions } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import { $getRoot, defineExtension } from "lexical";
import { ListenerRegistry } from "../helper/listener";
import { sanitizeHtml } from "../helper/sanitizer";
import { ClipboardExtension } from "./extensions/clipboard";
import { LexisExtension } from "./extensions/extension";
import { LinkExtension } from "./extensions/link";
import {
  MARKDOWN_TRANSFORMERS,
  MarkdownExtension,
} from "./extensions/markdown";
import { RichTextExtension } from "./extensions/rich-text";
import { logger } from "./logger";

/**
 * @typedef {Object} EditorCommand
 * @property {string} id
 * @property {string} label
 * @property {string} [shortcut]
 * @property {(editor: Editor) => boolean} [isActive]
 * @property {(editor: Editor) => boolean} [isDisabled]
 * @property {(editor: Editor) => void} [register]
 * @property {(lexicalEditor: import('lexical').LexicalEditor, payload?: any) => void} execute
 */

export class Editor {
  #commands = {};

  #extensions = new Map();

  #listeners = new ListenerRegistry();

  #cache = {
    value: null,
    textValue: null,
  };

  #isCacheDirty = true;

  /** @type {import('lexical').LexicalEditor} */
  lexicalEditor = null;

  /** @type {import('@lexical/history').HistoryState} */
  historyState = null;

  /**
   * @param {HTMLElement} rootEl
   */
  constructor(
    rootEl,
    config = { markdown: true, extensions: [], initialValue: null },
  ) {
    this.config = config;

    this.#registerExtensions();
    this.#buildLexicalEditor(rootEl);
  }

  destroy() {
    for (const ext of this.enabledExtensions) {
      ext.dispose();
    }

    this.#listeners.cleanup();
    this.lexicalEditor.dispose();

    this.#extensions.clear();
    this.#commands = null;
    this.lexicalEditor = null;
    this.#cache = { value: null, textValue: null };
  }

  /**
   * @returns {Boolean}
   */
  get supportsMarkdown() {
    return this.config.markdown;
  }

  get commands() {
    return Object.freeze({ ...this.#commands });
  }

  get value() {
    if (!this.#isCacheDirty && this.#cache.value !== null) {
      return this.#cache.value;
    }

    this.#cache.value = this.lexicalEditor.read(() =>
      this.supportsMarkdown
        ? $convertToMarkdownString(MARKDOWN_TRANSFORMERS, $getRoot())
        : sanitizeHtml($generateHtmlFromNodes(this.lexicalEditor)),
    );
    this.#isCacheDirty = false;

    return this.#cache.value;
  }

  set value(value) {
    this.lexicalEditor.update(() => {
      const rootNode = $getRoot();
      rootNode.clear();

      if (this.supportsMarkdown) {
        $convertFromMarkdownString(value, MARKDOWN_TRANSFORMERS, rootNode);
      } else {
        $generateNodesFromDOM(
          this.lexicalEditor,
          new DOMParser().parseFromString(value, "text/html"),
        );
      }
    });

    this.#invalidateValueCache();
  }

  get textValue() {
    if (!this.#isCacheDirty && this.#cache.textValue !== null) {
      return this.#cache.textValue;
    }

    this.#cache.textValue = this.lexicalEditor.read(() =>
      $getRoot().getTextContent(),
    );
    this.#isCacheDirty = false;

    return this.#cache.textValue;
  }

  get isEmpty() {
    return this.textValue.length === 0;
  }

  /** @param {EditorCommand} command */
  registerCommand(command) {
    if (!command.id) throw new Error("Command must have an id");

    if (command.register) {
      command.register(this);
    }

    this.#commands[command.id] = command;
  }

  /**
   * @param {string} id
   * @param {EditorCommand} command
   */
  replaceCommand(id, command) {
    if (!this.hasCommand(id)) {
      throw new Error(`Command "${id}" is not registered`);
    }

    if (command.register) {
      command.register(this);
    }

    this.#commands[id] = { ...command, id };
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  hasCommand(id) {
    return id in this.#commands;
  }

  /**
   * @param {string} id
   * @returns {EditorCommand|null}
   */
  getCommand(id) {
    return this.#commands[id] ?? null;
  }

  /**
   * @param {string} id
   * @param {any} [payload]
   */
  runCommand(id, payload) {
    if (!this.hasCommand(id)) {
      throw new Error(`Command "${id}" is not registered`);
    }

    this.lexicalEditor.focus();
    this.getCommand(id).execute(this.lexicalEditor, payload);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isActive(id) {
    if (!this.hasCommand(id)) return false;

    const cmd = this.getCommand(id);
    if (!cmd.isActive) return false;

    return this.lexicalEditor.read(() => cmd.isActive(this));
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isDisabled(id) {
    if (!this.hasCommand(id)) return false;

    const cmd = this.getCommand(id);
    if (!cmd.isDisabled) return false;

    return this.lexicalEditor.read(() => cmd.isDisabled(this));
  }

  /**
   * Invalidate cached values when editor content changes
   * @private
   */
  #invalidateValueCache() {
    this.#isCacheDirty = true;
  }

  #buildLexicalEditor(rootEl) {
    this.lexicalEditor = buildEditorFromExtensions(
      defineExtension({
        name: "[root]",
        namespace: "@lexis/editor",
        theme: {
          quote: "quote",
          heading: {
            h1: "h1",
            h2: "h2",
            h3: "h3",
            h4: "h4",
            h5: "h5",
            h6: "h6",
          },
          text: {
            bold: "font-bold",
            italic: "italic",
            underline: "underline",
          },
        },

        afterRegistration: (lexicalEditor, _, state) => {
          lexicalEditor.setRootElement(rootEl);

          const extOutput = state.getDependency(HistoryExtension);
          this.historyState = extOutput.output.historyState.peek();

          this.#listeners.track(
            lexicalEditor.registerUpdateListener(
              ({ dirtyElements, dirtyLeaves }) => {
                if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
                  this.#invalidateValueCache();
                }
              },
            ),
          );
        },
      }),
      ...this.enabledExtensions
        .map((ext) => ext.lexicalExtension)
        .filter(Boolean),
    );
  }

  #registerExtensions() {
    for (const ExtensionClass of [
      ...this.baseExtensions,
      ...(this.config.extensions ?? []),
    ]) {
      const extension = new ExtensionClass(this);
      if (!(extension instanceof LexisExtension)) {
        logger.error("Extensions should extend LexisExtension class");
        continue;
      }

      this.#extensions.set(extension.name, extension);
    }
  }

  get baseExtensions() {
    return [
      RichTextExtension,
      LinkExtension,
      ClipboardExtension,
      MarkdownExtension,
    ];
  }

  /**
   * @returns {import('./extensions/extension').LexisExtension[]}
   */
  get extensions() {
    return Array.from(this.#extensions.values());
  }

  /**
   * @returns {import('./extensions/extension').LexisExtension[]}
   */
  get enabledExtensions() {
    return this.extensions.filter((ext) => ext.enabled);
  }
}
