import { buildEditorFromExtensions } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import {
  $createParagraphNode,
  $getRoot,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  defineExtension,
} from "lexical";
import { ListenerRegistry } from "../helper/listener";
import { sanitizeHtml } from "../helper/sanitizer";
import { deepMergeObjects } from "../helper/utils";
import { LexisExtension } from "./extensions/extension";
import { MARKDOWN_TRANSFORMERS } from "./extensions/markdown";
import { RichTextExtension } from "./extensions/rich-text";
import { logger } from "./logger";

/**
 * @typedef {Object} EditorCommand
 * @property {string} id
 * @property {string} label
 * @property {string} [icon]
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

  /** @type {import('../elements/editor').LexisEditorElement|null} */
  hostElement = null;

  static defaultTheme = {
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
      code: "inline-code",
    },
    code: "code-block",
    codeHighlight: {
      atrule: "editor-token-atrule",
      attr: "editor-token-attr",
      boolean: "editor-token-boolean",
      builtin: "editor-token-builtin",
      cdata: "editor-token-cdata",
      char: "editor-token-char",
      class: "editor-token-class",
      "class-name": "editor-token-class-name",
      comment: "editor-token-comment",
      constant: "editor-token-constant",
      deleted: "editor-token-deleted",
      doctype: "editor-token-doctype",
      entity: "editor-token-entity",
      function: "editor-token-function",
      important: "editor-token-important",
      inserted: "editor-token-inserted",
      keyword: "editor-token-keyword",
      namespace: "editor-token-namespace",
      number: "editor-token-number",
      operator: "editor-token-operator",
      prolog: "editor-token-prolog",
      property: "editor-token-property",
      punctuation: "editor-token-punctuation",
      regex: "editor-token-regex",
      selector: "editor-token-selector",
      string: "editor-token-string",
      symbol: "editor-token-symbol",
      tag: "editor-token-tag",
      url: "editor-token-url",
      variable: "editor-token-variable",
    },
  };

  /**
   * @param {HTMLElement} rootEl
   * @param {Object} config
   */
  constructor(rootEl, config = {}) {
    this.config = {
      markdown: true,
      ...config,
    };

    this.#registerExtensions();
    this.#buildLexicalEditor(rootEl);

    for (const ext of this.enabledExtensions) {
      for (const cmd of ext.commands) {
        this.registerCommand(cmd);
      }
    }
  }

  /**
   * @param {import('../elements/editor').LexisEditorElement|null} hostElement
   * @returns {void}
   */
  attachHostElement(hostElement) {
    this.hostElement = hostElement;
  }

  selectEnd() {
    this.lexicalEditor.update(() => $getRoot().selectEnd());
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
    this.hostElement = null;
    this.#cache = { value: null, textValue: null };
  }

  /**
   * @returns {Boolean}
   */
  get supportsMarkdown() {
    return this.config.markdown === true;
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

      if (this.supportsMarkdown && this.#extensions.has("markdown")) {
        $convertFromMarkdownString(value, MARKDOWN_TRANSFORMERS, rootNode);
      } else {
        const nodes = $generateNodesFromDOM(
          this.lexicalEditor,
          new DOMParser().parseFromString(value, "text/html"),
        );

        let wrapperNode = null;
        for (const node of nodes) {
          if ($isTextNode(node) || $isLineBreakNode(node)) {
            if (!wrapperNode) {
              wrapperNode = $createParagraphNode();
              rootNode.append(wrapperNode);
            }

            wrapperNode.append(node);
            continue;
          }

          if (wrapperNode) {
            wrapperNode = null;
          }

          rootNode.append(node);
        }
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
    return this.lexicalEditor.read(() => {
      const root = $getRoot();
      const children = root.getChildren();

      if (children.length === 0) {
        return true;
      }

      if (children.length > 1) {
        return false;
      }

      const firstChild = children[0];
      if (!$isParagraphNode(firstChild)) {
        return false;
      }

      if (firstChild.getTextContent().trim().length > 0) {
        return false;
      }

      return firstChild.getChildren().every((child) => {
        if ($isLineBreakNode(child)) {
          return true;
        }

        return $isTextNode(child) && child.getTextContent().trim().length === 0;
      });
    });
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
    const lexicalConfig = this.config.lexical || {};
    const theme = deepMergeObjects(
      Editor.defaultTheme,
      lexicalConfig.theme || {},
    );

    this.lexicalEditor = buildEditorFromExtensions(
      defineExtension({
        name: "[root]",
        namespace: lexicalConfig.namespace || "@lexis/editor",
        theme,

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
    const extensionClasses = this.config.extensions ?? [];

    if (!extensionClasses.includes(RichTextExtension)) {
      extensionClasses.unshift(RichTextExtension);
    }

    for (const ExtensionClass of extensionClasses) {
      const extension = new ExtensionClass(this);
      if (!(extension instanceof LexisExtension)) {
        logger.error("Extensions should extend LexisExtension class");
        continue;
      }

      this.#extensions.set(extension.name, extension);
    }
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

export function resolveConfiguration(base, config) {
  const clonedConfig = { ...config };
  let extensions;

  if (clonedConfig.extensionMode === "replace") {
    extensions = clonedConfig.extensions ?? [];
  } else {
    extensions = [
      ...(base.extensions ?? []),
      ...(clonedConfig.extensions ?? []),
    ];
  }

  delete clonedConfig.extensions;

  const resolved = deepMergeObjects(
    {
      ...base,
      extensions: Array.from(new Set(extensions)),
    },
    clonedConfig,
  );

  return resolved;
}
