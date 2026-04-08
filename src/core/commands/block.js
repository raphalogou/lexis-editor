import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  createCommand,
  ParagraphNode,
} from "lexical";
import { transformBlock } from "../utils";

export const INSERT_HEADING_COMMAND = createCommand("INSERT_HEADING_COMMAND");
export const INSERT_QUOTE_COMMAND = createCommand("INSERT_QUOTE_COMMAND");

const headingLevels = [1, 2, 3, 4];

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  ...headingLevels.map((level) => ({
    id: `heading-${level}`,
    label: `Heading ${level}`,

    isActive() {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      const heading = $getNearestNodeOfType(
        selection.focus.getNode(),
        HeadingNode,
      );

      return heading?.getTag() === `h${level}`;
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(INSERT_HEADING_COMMAND, level);
    },
  })),
  {
    id: "quote",
    label: "Quote",

    isActive() {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      return !!$getNearestNodeOfType(selection.focus.getNode(), QuoteNode);
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(INSERT_QUOTE_COMMAND);
    },
  },
  {
    id: "paragraph",
    label: "Normal",

    isActive() {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      return !!$getNearestNodeOfType(selection.focus.getNode(), ParagraphNode);
    },

    execute(lexicalEditor) {
      transformBlock(lexicalEditor, $createParagraphNode);
    },
  },
];

/**
 *
 * @param {import('lexical').LexicalEditor} lexicalEditor
 */
export function registerHeading(lexicalEditor) {
  return lexicalEditor.registerCommand(
    INSERT_HEADING_COMMAND,
    (level) => {
      /** @type {import('@lexical/rich-text').HeadingType} */
      const headingLevel = Number.isFinite(level) ? `h${level}` : level;
      transformBlock(lexicalEditor, () => $createHeadingNode(headingLevel));
    },
    COMMAND_PRIORITY_EDITOR,
  );
}

/**
 *
 * @param {import('lexical').LexicalEditor} lexicalEditor
 */
export function registerQuote(lexicalEditor) {
  return lexicalEditor.registerCommand(
    INSERT_QUOTE_COMMAND,
    () => transformBlock(lexicalEditor, $createQuoteNode),
    COMMAND_PRIORITY_LOW,
  );
}
