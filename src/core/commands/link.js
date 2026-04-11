import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $getNearestNodeOfType } from "@lexical/utils";
import { $createTextNode, $getSelection, $isRangeSelection } from "lexical";
import {
  $getCursorWordContext,
  $getWordBoundaries,
  $selectWord,
} from "../utils";

/** @returns {import('@lexical/link').LinkNode|null} */
export function $getLinkNode() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }

  return $getNearestNodeOfType(selection.focus.getNode(), LinkNode);
}

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "link",
    label: "Link",

    isActive() {
      return $getLinkNode() !== null;
    },

    execute(lexicalEditor, payload) {
      lexicalEditor.update(() => {
        lexicalEditor.focus();

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return;
        }

        const context = $getCursorWordContext();
        if (!context) return;

        const { node, offset, text, isMidWord, isTouchingWord } = context;

        if (isMidWord || isTouchingWord) {
          const { start, end } = $getWordBoundaries(text, offset);

          $selectWord(node, start, end);
        } else {
          const node = $createTextNode(payload.url);
          selection.insertNodes([node]);

          $selectWord(node, payload.url.length, payload.url.length);
        }
      });

      lexicalEditor.dispatchCommand(TOGGLE_LINK_COMMAND, payload);
    },
  },
  {
    id: "unlink",
    label: "Unlink",

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    },
  },
];
