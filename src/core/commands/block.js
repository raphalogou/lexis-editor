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
import { COMMAND_ICONS } from "./icons";

export const TOGGLE_HEADING_COMMAND = createCommand("TOGGLE_HEADING_COMMAND");
export const TOGGLE_QUOTE_COMMAND = createCommand("TOGGLE_QUOTE_COMMAND");

const headingLevels = [1, 2, 3, 4];

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  ...headingLevels.map((level) => ({
    id: `heading-${level}`,
    label: `Heading ${level}`,
    icon: COMMAND_ICONS[`heading-${level}`],

    isActive() {
      return $isHeadingNode(level);
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(TOGGLE_HEADING_COMMAND, level);
    },
  })),
  {
    id: "quote",
    label: "Quote",
    icon: COMMAND_ICONS.quote,

    isActive() {
      return $isInsideQuote();
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(TOGGLE_QUOTE_COMMAND);
    },
  },
  {
    id: "paragraph",
    label: "Normal",
    icon: COMMAND_ICONS.paragraph,

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
 * @param {Number} level
 * @returns
 */
function $isHeadingNode(level) {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  const heading = $getNearestNodeOfType(selection.focus.getNode(), HeadingNode);

  return heading?.getTag() === `h${level}`;
}

function $isInsideQuote() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;

  return !!$getNearestNodeOfType(selection.focus.getNode(), QuoteNode);
}

/**
 * @param {import('lexical').LexicalEditor} lexicalEditor
 */
export function registerHeading(lexicalEditor) {
  return lexicalEditor.registerCommand(
    TOGGLE_HEADING_COMMAND,
    (level) => {
      if ($isHeadingNode(level)) {
        transformBlock(lexicalEditor, $createParagraphNode);
      } else {
        /** @type {import('@lexical/rich-text').HeadingType} */
        const headingLevel = Number.isFinite(level) ? `h${level}` : level;

        transformBlock(lexicalEditor, () => $createHeadingNode(headingLevel));
      }
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
    TOGGLE_QUOTE_COMMAND,
    () => {
      if ($isInsideQuote()) {
        transformBlock(lexicalEditor, $createParagraphNode);
      } else {
        transformBlock(lexicalEditor, $createQuoteNode);
      }
    },
    COMMAND_PRIORITY_LOW,
  );
}
