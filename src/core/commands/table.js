import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  INSERT_TABLE_COMMAND,
} from "@lexical/table";
import { $getSelection, $isRangeSelection } from "lexical";
import { COMMAND_ICONS } from "./icons";

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "insert-table",
    label: "Table",
    icon: COMMAND_ICONS.table,
    shortcut: null,

    isActive() {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      return !!$getTableCellNodeFromLexicalNode(selection.focus.getNode());
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: "3",
        rows: "3",
        // `true` would also make the first *column* a header (spreadsheet
        // style); GFM markdown tables only ever have a header row.
        includeHeaders: { rows: true, columns: false },
      });
    },
  },
  {
    id: "table-add-row",
    label: "Add row below",
    icon: COMMAND_ICONS["table-add-row"],
    shortcut: null,

    execute(lexicalEditor) {
      lexicalEditor.update(() => {
        $insertTableRowAtSelection(true);
      });
    },
  },
  {
    id: "table-remove-row",
    label: "Remove row",
    icon: COMMAND_ICONS["table-remove-row"],
    shortcut: null,

    execute(lexicalEditor) {
      lexicalEditor.update(() => {
        $deleteTableRowAtSelection();
      });
    },
  },
  {
    id: "table-add-column",
    label: "Add column right",
    icon: COMMAND_ICONS["table-add-column"],
    shortcut: null,

    execute(lexicalEditor) {
      lexicalEditor.update(() => {
        $insertTableColumnAtSelection(true);
      });
    },
  },
  {
    id: "table-remove-column",
    label: "Remove column",
    icon: COMMAND_ICONS["table-remove-column"],
    shortcut: null,

    execute(lexicalEditor) {
      lexicalEditor.update(() => {
        $deleteTableColumnAtSelection();
      });
    },
  },
  {
    id: "table-delete",
    label: "Delete table",
    icon: COMMAND_ICONS["table-delete"],
    shortcut: null,

    execute(lexicalEditor) {
      lexicalEditor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const cellNode = $getTableCellNodeFromLexicalNode(
          selection.focus.getNode(),
        );
        if (!cellNode) return;

        $getTableNodeFromLexicalNodeOrThrow(cellNode).remove();
      });
    },
  },
];
