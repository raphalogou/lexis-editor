import { logger } from "../core/logger";
import { ListenerRegistry, registerEventListener } from "../helper/listener";
import "./popover";

export class LexisToolbarElement extends HTMLElement {
  /**
   * @type {import('../core/editor').Editor}
   */
  #editor = null;

  #buttonMap = new Map();

  /** @type {import('../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  connectedCallback() {
    // Register command controls
    for (const btn of this.querySelectorAll("[data-command]")) {
      btn.type = "button";
      this.#buttonMap.set(btn.dataset.command, btn);
    }

    this.#listeners.track(
      registerEventListener(this, "click", this.dispatchCommandEvent),
      registerEventListener(this, "editor:command", this.handleEditorCommand),
    );
  }

  disconnectedCallback() {
    this.#listeners.cleanup();
    this.#buttonMap.clear();
  }

  /**
   * @param {import('../core/editor').Editor} editor
   */
  attachEditor(editor) {
    this.#editor = editor;

    this.#listeners.track(
      editor.lexicalEditor.registerUpdateListener(() => {
        this.reflectEditorState();
      }),
    );

    this.reflectEditorState();
  }

  dispatchCommandEvent = (evt) => {
    const target = evt.target.closest("[data-command]");
    if (!target) return;

    target.dispatchEvent(
      new CustomEvent("editor:command", {
        detail: { command: target.dataset.command },
        bubbles: true,
      }),
    );
  };

  handleEditorCommand = (evt) => {
    if (!this.#editor) {
      logger.error(
        "No editor has been attached to this toolbar. Did you forget to map it to the editor through the `toolbar` attribute?",
      );
      return;
    }

    this.#editor.runCommand(evt.detail.command, evt.detail.payload);
  };

  reflectEditorState() {
    this.#buttonMap.forEach((btn, cmd) => {
      if (this.#editor.isActive(cmd)) {
        btn.setAttribute("data-state", "active");
      } else {
        btn.removeAttribute("data-state");
      }

      btn.disabled = this.#editor.isDisabled(cmd);
    });
  }
}
