import { logger } from "../core/logger";
import { ListenerRegistry, registerEventListener } from "../helper/listener";
import "./popover";

export class LexisToolbarElement extends HTMLElement {
  /**
   * @type {import('../core/editor').Editor}
   */
  #editor = null;

  #buttonMap = new Map();

  #buttonStateCache = new Map();

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
    this.#buttonStateCache.clear();
  }

  /**
   * @param {import('./editor').LexisEditorElement} editorEl
   */
  attachEditor(editorEl) {
    this.#editor = editorEl.editor;

    for (const control of this.querySelectorAll("[data-lexis-control]")) {
      const commandId = control.dataset.lexisControl;
      this.#buttonMap.set(commandId, control);
    }

    this.#listeners.track(
      registerEventListener(editorEl, "editor:focus", () =>
        this.reflectEditorState(),
      ),
      registerEventListener(editorEl, "editor:blur", () =>
        this.#clearActiveStates(),
      ),
    );

    this.#listeners.track(
      this.#editor.lexicalEditor.registerUpdateListener(() => {
        editorEl.hasFocus && this.reflectEditorState();
      }),
    );

    this.reflectEditorState();
  }

  /**
   * Register a control element for a command
   * @param {string} commandId
   * @param {HTMLElement} element
   */
  registerControl(commandId, element) {
    this.#buttonMap.set(commandId, element);
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
      const isActive = this.#editor.isActive(cmd);
      const isDisabled = this.#editor.isDisabled(cmd);
      const cachedState = this.#buttonStateCache.get(cmd);

      // Only update if state has changed
      if (
        !cachedState ||
        cachedState.active !== isActive ||
        cachedState.disabled !== isDisabled
      ) {
        if (isActive) {
          btn.setAttribute("data-state", "active");
        } else {
          btn.removeAttribute("data-state");
        }

        btn.disabled = isDisabled;

        // Cache the new state
        this.#buttonStateCache.set(cmd, {
          active: isActive,
          disabled: isDisabled,
        });
      }
    });
  }

  #clearActiveStates() {
    this.#buttonMap.forEach((btn) => {
      btn.removeAttribute("data-state");
    });

    this.#buttonStateCache.clear();
  }
}
