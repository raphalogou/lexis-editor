import { $createCodeNode, CodeHighlightNode, CodeNode } from "@lexical/code";
import { registerCodeHighlighting } from "@lexical/code-prism";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  defineExtension,
  KEY_ARROW_DOWN_COMMAND,
  mergeRegister,
} from "lexical";

import { transformBlock } from "../utils";
import { LexisExtension } from "./extension";

const DEFAULT_CODE_BLOCK_LANGUAGE = "javascript";
const DEFAULT_CODE_BLOCK_THEME = "one-light";

export const TOGGLE_CODE_BLOCK_COMMAND = createCommand(
  "TOGGLE_CODE_BLOCK_COMMAND",
);

function createDefaultCodeNode() {
  return $createCodeNode(DEFAULT_CODE_BLOCK_LANGUAGE, DEFAULT_CODE_BLOCK_THEME);
}

export class CodeBlockExtension extends LexisExtension {
  name = "code-block";

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
    if (!$isRangeSelection(selection)) {
      return false;
    }

    const focusNode = selection.focus.getNode();
    const codeBlockNode = $getNearestNodeOfType(focusNode, CodeNode);
    if (!codeBlockNode) {
      return false;
    }

    const lastChild = codeBlockNode.getLastChild();
    if (!lastChild || lastChild.getKey() !== focusNode.getKey()) {
      return false;
    }

    let nextSibling = codeBlockNode.getNextSibling();
    if (!nextSibling) {
      nextSibling = $createParagraphNode();
      codeBlockNode.insertAfter(nextSibling);
    }

    nextSibling.selectStart();
    return true;
  }

  #getCodeBlockNode() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;

    return $getNearestNodeOfType(selection.focus.getNode(), CodeNode);
  }
}
