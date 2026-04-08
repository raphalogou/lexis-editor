import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";

const formats = ["bold", "italic", "underline", "strikethrough", "code"];

/**
 * @type {import('../editor').EditorCommand[]}
 */
export const commands = formats.map((format) => ({
  id: format,
  label: format[0].toUpperCase() + format.slice(1),

  isActive() {
    const selection = $getSelection();
    return $isRangeSelection(selection) ? selection.hasFormat(format) : false;
  },

  execute(lexicalEditor) {
    lexicalEditor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  },
}));
