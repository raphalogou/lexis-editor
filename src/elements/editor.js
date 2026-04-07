import { commands } from "../core/commands";
import { Editor } from "../core/editor";
import { createElement } from "../helper";
import { LexisToolbar } from "./toolbar";

export class LexisEditor extends HTMLElement {
	#editorInstance;

	constructor() {
		super();

		this.$rootEl = createElement(
			"div",
			{ class: "lexis-content", "data-part": "editor-root" },
			{ contentEditable: true },
		);

		this.append(this.$rootEl);

		this.#editorInstance = new Editor(this.$rootEl);

		for (const cmd of commands) {
			this.#editorInstance.registerCommand(cmd);
		}
	}

	get editor() {
		return this.#editorInstance;
	}

	connectedCallback() {
		const toolbar = this.#getToolbar() ?? this.#buildToolbar();

		toolbar.attachEditor(this.#editorInstance);
	}

	/**
	 * @returns {import('./toolbar').LexisToolbar}
	 */
	#getToolbar() {
		let toolbar = this.querySelector("lexis-toolbar");

		if (!toolbar && !!this.getAttribute("toolbar")) {
			const toolbarAttr = this.getAttribute("toolbar");
			toolbar = document.getElementById(toolbarAttr);
		}

		return toolbar instanceof LexisToolbar ? toolbar : null;
	}

	#buildToolbar() {
		const toolbar = document.createElement("lexis-toolbar");

		return toolbar;
	}
}

customElements.define("lexis-editor", LexisEditor);
