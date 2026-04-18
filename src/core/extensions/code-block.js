import { $createCodeNode, CodeHighlightNode, CodeNode } from "@lexical/code";
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

export const TOGGLE_CODE_BLOCK_COMMAND = createCommand(
  "TOGGLE_CODE_BLOCK_COMMAND",
);

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
            () => {
              if (this.#isInsideCodeBlock()) {
                transformBlock(lexicalEditor, $createParagraphNode);
              } else {
                transformBlock(lexicalEditor, () => {
                  return $createCodeNode();
                });
              }
              return true;
            },
            COMMAND_PRIORITY_EDITOR,
          ),

          lexicalEditor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            () => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection) || !this.#isInsideCodeBlock()) {
                return false;
              }

              const codeBlockNode = this.#getCodeBlockNode();
              if (!codeBlockNode) {
                return false;
              }

              const lastChild = codeBlockNode.getLastChild();
              if (!lastChild) {
                return false;
              }

              const focusNode = selection.focus.getNode();

              if (lastChild.getKey() !== focusNode.getKey()) {
                return false;
              }

              const nextSibling = codeBlockNode.getNextSibling();

              if (!nextSibling) {
                const paragraphNode = $createParagraphNode();
                codeBlockNode.insertAfter(paragraphNode);
                paragraphNode.selectStart();
                return true;
              }

              nextSibling.selectStart();
              return true;
            },
            COMMAND_PRIORITY_EDITOR,
          ),
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

  #getCodeBlockNode() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;

    return $getNearestNodeOfType(selection.focus.getNode(), CodeNode);
  }
}
