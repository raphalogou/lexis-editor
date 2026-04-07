import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";

const formats = ["bold", "italic", "underline", "strikethrough", "code"];

export const formatCommands = formats.map((format) => ({
	id: format,
	label: format[0].toUpperCase() + format.slice(1),

	isActive(editorState) {
		return editorState.read(() => {
			const selection = $getSelection();
			return $isRangeSelection(selection) ? selection.hasFormat(format) : false;
		});
	},

  execute(lexicalEditor) {
		lexicalEditor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
	},
}));
