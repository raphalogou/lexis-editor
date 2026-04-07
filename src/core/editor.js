import { buildEditorFromExtensions } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { RichTextExtension } from "@lexical/rich-text";
import { defineExtension } from "lexical";

/**
 * @typedef {Object} EditorCommand
 * @property {string} id
 * @property {string} label
 * @property {string} [shortcut]
 * @property {(editorState: import('lexical').EditorState) => boolean} [isActive]
 * @property {(editorState: import('lexical').EditorState) => boolean} [isDisabled]
 * @property {(lexicalEditor: import('lexical').LexicalEditor, payload?: any) => void} execute
 */

export class Editor {
	#commands = {};

	/**
	 * @param {HTMLElement} rootEl
	 */
	#rootEl = null;

	/** @type {import('lexical').LexicalEditor} */
	lexicalEditor = null;

	/**
	 * @param {HTMLElement} rootEl
	 */
	constructor(rootEl) {
		this.lexicalEditor = buildEditorFromExtensions(
			defineExtension({
				name: "[root]",
				namespace: "@lexis/editor",
				dependencies: [RichTextExtension, HistoryExtension],
				theme: {
					text: {
						bold: "font-bold",
						italic: "italic",
						underline: "underline",
					},
				},
			}),
		);

		this.#rootEl = rootEl;
		this.lexicalEditor.setRootElement(rootEl);
	}

	get commands() {
		return Object.freeze({ ...this.#commands });
	}

	/** @param {EditorCommand} command */
	registerCommand(command) {
		if (!command.id) throw new Error("Command must have an id");

		this.#commands[command.id] = command;
	}

	/**
	 * @param {string} id
	 * @param {EditorCommand} command
	 */
	replaceCommand(id, command) {
		if (!this.hasCommand(id)) {
			throw new Error(`Command "${id}" is not registered`);
		}

		this.#commands[id] = { ...command, id };
	}

	/** @param {string} id */
	unregisterCommand(id) {
		if (!this.hasCommand(id)) {
			throw new Error(`Command "${id}" is not registered`);
		}

		delete this.#commands[id];
	}

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	hasCommand(id) {
		return id in this.#commands;
	}

	/**
	 * @param {string} id
	 * @returns {EditorCommand|null}
	 */
	getCommand(id) {
		return this.#commands[id] ?? null;
	}

	/**
	 * @param {string} id
	 * @param {any} [payload]
	 */
	runCommand(id, payload) {
		if (!this.hasCommand(id)) {
			throw new Error(`Command "${id}" is not registered`);
		}

		this.getCommand(id).execute(this.lexicalEditor, payload);
	}

	/**
	 * @param {string} id
	 * @returns {boolean}
	 */
	isActive(id) {
		if (!this.hasCommand(id)) return false;

		const cmd = this.getCommand(id);
		if (!cmd.isActive) return false;

		return this.lexicalEditor
			.getEditorState()
			.read(() => cmd.isActive(this.lexicalEditor.getEditorState()));
	}

	/**
	 * @param {string} id
	 *@returns {boolean}
	 */
	isDisabled(id) {
		if (!this.hasCommand(id)) return false;

		const cmd = this.getCommand(id);
		if (!cmd.isDisabled) return false;

		return this.lexicalEditor
			.getEditorState()
			.read(() => cmd.isDisabled(this.lexicalEditor.getEditorState()));
	}
}
