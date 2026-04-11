import { $setBlocksType } from "@lexical/selection";
import {
  $createRangeSelection,
  $getSelection,
  $isRangeSelection,
  $setSelection,
} from "lexical";

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

function isWordChar(char) {
  return /\w/.test(char);
}

export function $getWordBoundaries(text, offset) {
  let start = offset;
  let end = offset;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;
  return { start, end };
}

export function $getCursorWordContext() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;

  const anchor = selection.anchor;
  const node = anchor.getNode();
  const offset = anchor.offset;
  const text = node.getTextContent();

  const charBefore = text[offset - 1] ?? "";
  const charAfter = text[offset] ?? "";

  const isTouchingWord = isWordChar(charBefore); // || isWordChar(charAfter);
  const isMidWord = isWordChar(charBefore) && isWordChar(charAfter);

  return { node, offset, text, isTouchingWord, isMidWord };
}

export function $selectWord(node, start, end) {
  const range = $createRangeSelection();
  range.anchor.set(node.getKey(), start, "text");
  range.focus.set(node.getKey(), end, "text");

  $setSelection(range);
}
