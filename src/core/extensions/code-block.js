import {
  $createCodeNode,
  $getLastCodeNodeOfLine,
  $isCodeHighlightNode,
  $isCodeNode,
  CodeHighlightNode,
  CodeNode,
} from "@lexical/code";
import {
  loadCodeLanguage,
  registerCodeHighlighting,
} from "@lexical/code-prism";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  $isTabNode,
  $isTextNode,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  defineExtension,
  KEY_ARROW_DOWN_COMMAND,
  mergeRegister,
} from "lexical";
import { ListenerRegistry, registerEventListener } from "../../helper/listener";
import { COMMAND_ICONS } from "../commands/icons";
import { logger } from "../logger";
import { transformBlock } from "../utils";
import { LexisExtension } from "./extension";

// Additional Prism grammars not preloaded by @lexical/code-prism.
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-csharp.js";
import "prismjs/components/prism-diff.js";
import "prismjs/components/prism-go.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-kotlin.js";
import "prismjs/components/prism-markup-templating.js";
import "prismjs/components/prism-php.js";
import "prismjs/components/prism-r.js";
import "prismjs/components/prism-ruby.js";

const DEFAULT_CODE_BLOCK_LANGUAGE = "plain";
const DEFAULT_CODE_BLOCK_THEME = "one-light";

const FRIENDLY_LANGUAGE_LABELS = [
  ["bash", "Bash"],
  ["c", "C"],
  ["clike", "C-like"],
  ["cpp", "C++"],
  ["csharp", "C#"],
  ["css", "CSS"],
  ["diff", "Diff"],
  ["go", "Go"],
  ["html", "HTML"],
  ["java", "Java"],
  ["javascript", "JavaScript"],
  ["json", "JSON"],
  ["kotlin", "Kotlin"],
  ["markdown", "Markdown"],
  ["objectivec", "Objective-C"],
  ["php", "PHP"],
  ["plain", "Plain Text"],
  ["powershell", "PowerShell"],
  ["python", "Python"],
  ["r", "R"],
  ["ruby", "Ruby"],
  ["rust", "Rust"],
  ["sql", "SQL"],
  ["swift", "Swift"],
  ["typescript", "TypeScript"],
  ["xml", "XML"],
];

export const TOGGLE_CODE_BLOCK_COMMAND = createCommand(
  "TOGGLE_CODE_BLOCK_COMMAND",
);

function createDefaultCodeNode() {
  return $createCodeNode(DEFAULT_CODE_BLOCK_LANGUAGE, DEFAULT_CODE_BLOCK_THEME);
}

function buildLanguageOptions() {
  return [...FRIENDLY_LANGUAGE_LABELS].sort((a, b) =>
    a[1].localeCompare(b[1], undefined, { sensitivity: "base" }),
  );
}

const CODE_LANGUAGE_OPTIONS = buildLanguageOptions();

export class CodeBlockExtension extends LexisExtension {
  name = "code-block";

  /** @type {import('../../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /** @type {HTMLSelectElement | null} */
  #languagePicker = null;

  /** @type {string | null} */
  #activeCodeBlockKey = null;

  /** @type {string} */
  #lastVisibleCodeBlockKey = "";

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/code-block",
      nodes: [CodeNode, CodeHighlightNode],
      register: (lexicalEditor) => {
        return mergeRegister(
          lexicalEditor.registerCommand(
            TOGGLE_CODE_BLOCK_COMMAND,
            () => this.#toggleCodeBlock(lexicalEditor),
            COMMAND_PRIORITY_EDITOR,
          ),

          lexicalEditor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            () => this.#handleArrowDownInCodeBlock(),
            COMMAND_PRIORITY_EDITOR,
          ),

          registerCodeHighlighting(lexicalEditor),

          lexicalEditor.registerUpdateListener(() => {
            lexicalEditor.read(() => {
              this.#syncLanguagePicker(lexicalEditor);
            });
          }),
        );
      },
    });
  }

  /**
   * @returns {import('../editor').EditorCommand[]}
   */
  get commands() {
    return [
      {
        id: "code-block",
        label: "Code Block",
        icon: COMMAND_ICONS["code-block"],
        shortcut: null,

        isActive: () => {
          return this.editor.lexicalEditor.read(() =>
            this.#isInsideCodeBlock(),
          );
        },

        execute(lexicalEditor) {
          lexicalEditor.dispatchCommand(TOGGLE_CODE_BLOCK_COMMAND);
        },
      },
    ];
  }

  /**
   * Check if cursor is inside a code block
   * @private
   * @returns {boolean}
   */
  #isInsideCodeBlock() {
    return this.#getCodeBlockNode() !== null;
  }

  /**
   * @param {import('lexical').LexicalEditor} lexicalEditor
   * @returns {boolean}
   */
  #toggleCodeBlock(lexicalEditor) {
    if (this.#isInsideCodeBlock()) {
      transformBlock(lexicalEditor, $createParagraphNode);
      return true;
    }

    transformBlock(lexicalEditor, createDefaultCodeNode);
    return true;
  }

  /**
   * @returns {boolean}
   */
  #handleArrowDownInCodeBlock() {
    const selection = $getSelection();
    if (!this.#isInsideCodeBlock() || !$isRangeSelection(selection)) {
      return false;
    }

    const focusNode = selection.focus.getNode();
    const focusOffset = selection.focus.offset;
    const codeBlockNode = $getNearestNodeOfType(focusNode, CodeNode);
    if (!codeBlockNode) {
      return false;
    }

    const lastLineNode = codeBlockNode.getLastChild();
    if (!lastLineNode) {
      if (focusNode.getKey() !== codeBlockNode.getKey()) {
        return false;
      }
    } else if (focusNode.getKey() === codeBlockNode.getKey()) {
      const lastLineIndex = Math.max(0, codeBlockNode.getChildrenSize() - 1);
      const focusLineIndex = Math.max(0, focusOffset - 1);

      if (focusLineIndex !== lastLineIndex) {
        return false;
      }
    } else {
      const lineEndNode = getCodeLineEndNode(focusNode, codeBlockNode);
      if (lineEndNode?.getKey() !== lastLineNode.getKey()) {
        return false;
      }
    }

    let nextSibling = codeBlockNode.getNextSibling();

    if (!nextSibling) {
      nextSibling = $createParagraphNode();
      codeBlockNode.insertAfter(nextSibling);
    }

    return true;
  }

  #getCodeBlockNode() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;

    return $getNearestNodeOfType(selection.focus.getNode(), CodeNode);
  }

  /**
   * @param {import('lexical').LexicalEditor} lexicalEditor
   */
  #syncLanguagePicker(lexicalEditor) {
    const codeBlockNode = this.#getCodeBlockNode();
    if (!codeBlockNode) {
      this.#hideLanguagePicker();
      return;
    }

    const codeBlockKey = codeBlockNode.getKey();
    const codeBlockElement = lexicalEditor.getElementByKey(codeBlockKey);
    if (!codeBlockElement) {
      this.#hideLanguagePicker();
      return;
    }

    this.#activeCodeBlockKey = codeBlockKey;
    this.#showLanguagePicker(
      codeBlockElement,
      codeBlockNode.getLanguage() || DEFAULT_CODE_BLOCK_LANGUAGE,
    );
  }

  /**
   * @param {HTMLElement} codeBlockElement
   * @param {string} activeLanguage
   */
  #showLanguagePicker(codeBlockElement, activeLanguage) {
    const picker = this.#getLanguagePicker();
    picker.hidden = false;

    if (picker.value !== activeLanguage) {
      picker.value = activeLanguage;
    }

    const codeBlockKey = this.#activeCodeBlockKey || "";
    if (this.#lastVisibleCodeBlockKey === codeBlockKey) {
      return;
    }

    this.#lastVisibleCodeBlockKey = codeBlockKey;

    const hostElement = this.hostElement;
    if (!hostElement) return;

    const hostBounds = hostElement.getBoundingClientRect();
    const codeBounds = codeBlockElement.getBoundingClientRect();

    picker.style.top = `${codeBounds.top - hostBounds.top + 8}px`;
    picker.style.left = `${
      codeBounds.right - hostBounds.left - picker.offsetWidth - 8
    }px`;
  }

  #hideLanguagePicker() {
    this.#activeCodeBlockKey = null;
    this.#lastVisibleCodeBlockKey = "";

    if (!this.#languagePicker) return;
    this.#languagePicker.hidden = true;
  }

  /**
   * @returns {HTMLSelectElement}
   */
  #getLanguagePicker() {
    if (this.#languagePicker) {
      return this.#languagePicker;
    }

    const hostElement = this.hostElement;
    if (!hostElement) {
      throw new Error("CodeBlockExtension requires hostElement");
    }

    const picker = document.createElement("select");
    picker.dataset.slot = "code-block-language-picker";
    picker.className = "lexis-code-language-picker";
    picker.hidden = true;
    picker.style.position = "absolute";
    picker.style.zIndex = "5";

    for (const [value, label] of CODE_LANGUAGE_OPTIONS) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      picker.append(option);
    }

    this.#listeners.track(
      registerEventListener(picker, "change", () => {
        this.#updateActiveCodeBlockLanguage(picker.value);
      }),
    );

    hostElement.append(picker);
    this.#languagePicker = picker;
    return picker;
  }

  /**
   * @param {string} language
   */
  #updateActiveCodeBlockLanguage(language) {
    const codeBlockKey = this.#activeCodeBlockKey;
    if (!codeBlockKey) return;

    this.editor.lexicalEditor.update(() => {
      const node = $getNodeByKey(codeBlockKey);
      if (!$isCodeNode(node)) {
        return;
      }

      if (node.getLanguage() !== language) {
        node.setLanguage(language);
      }
    });

    loadCodeLanguage(language).catch((error) => {
      logger.debug("Failed to load code language", { language, error });
    });
  }

  dispose() {
    this.#listeners.cleanup();

    if (this.#languagePicker?.isConnected) {
      this.#languagePicker.remove();
    }

    this.#languagePicker = null;
    this.#activeCodeBlockKey = null;
    this.#lastVisibleCodeBlockKey = "";
  }
}

function isCodeLineAnchorNode(node) {
  return (
    $isCodeHighlightNode(node) ||
    $isTabNode(node) ||
    $isLineBreakNode(node) ||
    $isTextNode(node)
  );
}

function getCodeLineEndNode(node, codeBlockNode) {
  if (isCodeLineAnchorNode(node)) {
    return $getLastCodeNodeOfLine(node);
  }

  const directChild = getDirectChildWithinAncestor(node, codeBlockNode);
  if (!directChild) {
    return null;
  }

  if (isCodeLineAnchorNode(directChild)) {
    return $getLastCodeNodeOfLine(directChild);
  }

  return directChild;
}

function getDirectChildWithinAncestor(node, ancestor) {
  let currentNode = node;

  while (currentNode) {
    const parent = currentNode.getParent();
    if (!parent) {
      return null;
    }

    if (parent.getKey() === ancestor.getKey()) {
      return currentNode;
    }

    currentNode = parent;
  }

  return null;
}
