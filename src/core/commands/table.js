import { INSERT_TABLE_COMMAND } from "@lexical/table";
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
];
