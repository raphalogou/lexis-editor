import { $setBlocksType } from "@lexical/selection";
import { $getSelection, $isRangeSelection } from "lexical";

/**
 * @param {import('lexical').LexicalEditor} editor
 * @param {() => import('lexical').ElementNode} createNode
 */
export function transformBlock(editor, createNode) {
  editor.update(() => {
    const selection = $getSelection();

    if ($isRangeSelection(selection)) {
      $setBlocksType(selection, createNode);
      editor.focus();
    }
  });
}
