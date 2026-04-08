import { commands } from "../core/commands";

export class LexisToolbar extends HTMLElement {
  /**
   * @type {import('../core/editor').Editor}
   */
  #editor = null;

  #teardownFunction = null;

  #commands = [];

  #buttonMap = new Map();

  connectedCallback() {
    this.addEventListener("click", this.handleEditorCommand);

    this.#commands = commands.map((cmd) => cmd.id);

    // Cache button references for efficient updates
    this.#commands.forEach((cmd) => {
      const btn = this.querySelector(`[data-command='${cmd}']`);
      if (btn) {
        this.#buttonMap.set(cmd, btn);
      }
    });
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleEditorCommand);
    this.#teardownFunction?.();
    this.#buttonMap.clear();
  }

  /**
   * @param {import('../core/editor').Editor} editor
   */
  attachEditor(editor) {
    this.#teardownFunction = editor.lexicalEditor.registerUpdateListener(() => {
      this.reflectEditorState();
    });

    this.#editor = editor;
  }

  handleEditorCommand = (evt) => {
    if (!this.#editor) {
      console.error(
        "No editor has been attached to this toolbar. Did you forget to map it to the editor through the `toolbar` attribute?",
      );
      return;
    }

    const control = evt.target.closest("[data-command]");
    if (!control) {
      return;
    }

    this.#editor.runCommand(control.dataset.command);
  };

  reflectEditorState() {
    this.#buttonMap.forEach((btn, cmd) => {
      if (this.#editor.isActive(cmd)) {
        btn.setAttribute("data-state", "active");
      } else {
        btn.removeAttribute("data-state");
      }
    });
  }
}

customElements.define("lexis-toolbar", LexisToolbar);
