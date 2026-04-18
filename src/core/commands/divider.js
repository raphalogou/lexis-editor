import {
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from "@lexical/extension";
import { $getNearestNodeOfType } from "@lexical/utils";
import { $getSelection, $isRangeSelection } from "lexical";

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "divider",
    label: "Divider",
    shortcut: null,

    isActive() {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      return !!$getNearestNodeOfType(
        selection.focus.getNode(),
        HorizontalRuleNode,
      );
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND);
    },
  },
];
