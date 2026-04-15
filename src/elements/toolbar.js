import "./popover";

export class LexisToolbarElement extends HTMLElement {
  /**
   * @type {import('../core/editor').Editor}
   */
  #editor = null;

  #teardownFunction = null;

  #buttonMap = new Map();

  connectedCallback() {
    // Register command controls
    for (const btn of this.querySelectorAll("[data-command]")) {
      btn.type = "button";
      this.#buttonMap.set(btn.dataset.command, btn);
    }

    this.addEventListener("click", this.dispatchCommandEvent);
    this.addEventListener("editor:command", this.handleEditorCommand);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.dispatchCommandEvent);
    this.removeEventListener("editor:command", this.handleEditorCommand);
    this.#teardownFunction?.();

    this.#buttonMap.forEach((btn) => {
      btn.removeEventListener("click", this.dispatchCommandEvent);
    });
    this.#buttonMap.clear();
  }

  /**
   * @param {import('../core/editor').Editor} editor
   */
  attachEditor(editor) {
    this.#editor = editor;

    this.#teardownFunction = editor.lexicalEditor.registerUpdateListener(() => {
      this.reflectEditorState();
    });

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
      console.error(
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
