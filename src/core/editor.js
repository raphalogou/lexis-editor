import {
  buildEditorFromExtensions,
  TabIndentationExtension,
} from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { ListExtension } from "@lexical/list";
import { RichTextExtension } from "@lexical/rich-text";
import { configExtension, defineExtension } from "lexical";
import { registerHeading, registerQuote } from "./commands/block";

/**
 * @typedef {Object} EditorCommand
 * @property {string} id
 * @property {string} label
 * @property {string} [shortcut]
 * @property {(editor: Editor) => boolean} [isActive]
 * @property {(editor: Editor) => boolean} [isDisabled]
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

  /** @type {import('@lexical/history').HistoryState} */
  historyState = null;

  /**
   * @param {HTMLElement} rootEl
   */
  constructor(rootEl) {
    this.lexicalEditor = buildEditorFromExtensions(
      defineExtension({
        name: "[root]",
        namespace: "@lexis/editor",
        dependencies: [
          RichTextExtension,
          HistoryExtension,
          TabIndentationExtension,
          ListExtension,
        ],
        theme: {
          quote: "quote",
          heading: {
            h1: "h1",
            h2: "h2",
            h3: "h3",
            h4: "h4",
            h5: "h5",
            h6: "h6",
          },
          text: {
            bold: "font-bold",
            italic: "italic",
            underline: "underline",
          },
        },

        register(lexicalEditor) {
          registerHeading(lexicalEditor);
          registerQuote(lexicalEditor);
        },

        afterRegistration: (lexicalEditor, _, state) => {
          lexicalEditor.setRootElement(rootEl);

          const dep = state.getDependency(HistoryExtension);
          this.historyState = dep.output.historyState.peek();

          this.#rootEl = rootEl;
        },
      }),
    );
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

    return this.lexicalEditor.read(() => cmd.isActive(this));
  }

  /**
   * @param {string} id
   *@returns {boolean}
   */
  isDisabled(id) {
    if (!this.hasCommand(id)) return false;

    const cmd = this.getCommand(id);
    if (!cmd.isDisabled) return false;

    return this.lexicalEditor.read(() => cmd.isDisabled(this));
  }
}
