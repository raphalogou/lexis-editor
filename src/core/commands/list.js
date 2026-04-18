import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
} from "@lexical/list";
import { $getNearestNodeOfType } from "@lexical/utils";
import { $getSelection, $isRangeSelection } from "lexical";
import { COMMAND_ICONS } from "./icons";

function $getListNodeType() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return;
  }

  const listNode = $getNearestNodeOfType(selection.focus.getNode(), ListNode);

  return listNode?.getListType();
}

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "bullet-list",
    label: "Unordered List",
    icon: COMMAND_ICONS["bullet-list"],

    isActive() {
      return $getListNodeType() === "bullet";
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND);
    },
  },
  {
    id: "number-list",
    label: "Ordered List",
    icon: COMMAND_ICONS["number-list"],

    isActive() {
      return $getListNodeType() === "number";
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND);
    },
  },
];
