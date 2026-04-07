import { $getSelection, $isRangeSelection } from "lexical";
import { formatCommands } from "../core/commands";

export class LexisToolbar extends HTMLElement {
	/**
	 * @type {import('../core/editor').Editor}
	 */
	#editor = null;

	#teardownFunction = null;

	#commands = { format: [] };

	connectedCallback() {
		this.addEventListener("click", this.handleEditorCommand);

		this.#commands.format = formatCommands.map((cmd) => cmd.id);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this.handleEditorCommand);
		this.#teardownFunction?.();
	}

	/**
	 * @param {import('../core/editor').Editor} editor
	 */
	attachEditor(editor) {
		this.#teardownFunction = editor.lexicalEditor.registerUpdateListener(
			({ editorState }) => {
				editorState.read(() => this.syncControlsState());
			},
		);

		this.#editor = editor;
	}

	handleEditorCommand(evt) {
		if (!this.#editor) {
			throw new Error(
				"No editor has been attached to this toolbar. Did you forget to map it to the editor through the `toolbar` attribute ?",
			);
		}

		const control = evt.target.closest("[data-command]");
		if (!control) {
			return;
		}

		this.#editor.runCommand(control.dataset.command);
	}

	syncControlsState() {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) {
			return;
		}

		for (const cmd of this.#commands.format) {
			this.querySelector(`[data-command='${cmd}']`)?.setAttribute(
				"data-state",
				selection.hasFormat(cmd) ? "active" : null,
			);
		}
	}
}

customElements.define("lexis-toolbar", LexisToolbar);
