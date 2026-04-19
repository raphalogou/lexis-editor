import {
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $isRangeSelection,
} from "lexical";
import { INSERT_IMAGE_COMMAND } from "../nodes/image-node";
import { COMMAND_ICONS } from "./icons";

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "insert-image",
    label: "Image",
    icon: COMMAND_ICONS.image,

    execute(lexicalEditor, payload) {
      lexicalEditor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
    },
  },
];

/**
 * @param {import('lexical').LexicalNode} imageNode
 * @returns {void}
 */
export function insertImageNodeAtSelection(imageNode) {
  const selection = $getSelection();
  if ($isNodeSelection(selection)) {
    const nodes = selection.getNodes();
    if (nodes.length === 1) {
      const [selectedNode] = nodes;
      selectedNode.insertAfter(imageNode);
      return;
    }
  }

  if (!$isRangeSelection(selection)) {
    return;
  }

  $insertNodes([imageNode]);
}
