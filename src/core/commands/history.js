import { REDO_COMMAND, UNDO_COMMAND } from "lexical";
import { COMMAND_ICONS } from "./icons";

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = [
  {
    id: "undo",
    label: "Undo",
    icon: COMMAND_ICONS.undo,

    isDisabled(editor) {
      return !editor.canUndo.peek();
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(UNDO_COMMAND);
    },
  },
  {
    id: "redo",
    label: "Redo",
    icon: COMMAND_ICONS.redo,

    isDisabled(editor) {
      return !editor.canRedo.peek();
    },

    execute(lexicalEditor) {
      lexicalEditor.dispatchCommand(REDO_COMMAND);
    },
  },
];
