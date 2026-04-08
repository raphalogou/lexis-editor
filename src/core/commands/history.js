import { REDO_COMMAND, UNDO_COMMAND } from "lexical";

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "undo",
    label: "Undo",

    isDisabled(editor) {
      return editor.historyState.undoStack.length === 0;
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(UNDO_COMMAND);
    },
  },
  {
    id: "redo",
    label: "Redo",

    isDisabled(editor) {
      return editor.historyState.redoStack.length === 0;
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(REDO_COMMAND);
    },
  },
];
