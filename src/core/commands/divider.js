import {
  HorizontalRuleNode,
  INSERT_HORIZONTAL_RULE_COMMAND,
} from "@lexical/extension";
import { $getNearestNodeOfType } from "@lexical/utils";
import { $getSelection, $isRangeSelection } from "lexical";
import { COMMAND_ICONS } from "./icons";

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "divider",
    label: "Divider",
    icon: COMMAND_ICONS.divider,
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
