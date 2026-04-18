import { commands } from "../core/commands";
import { Editor } from "../core/editor";
import { createElement } from "../helper/jsx-runtime";
import { ListenerRegistry, registerEventListener } from "../helper/listener";
import { LexisToolbarElement } from "./toolbar";

export class LexisEditorElement extends HTMLElement {
  /** @type {import('../core/editor').Editor} */
  #editorInstance;

  /** @type {ElementInternals} */
  #internals;

  /** @type {HTMLTextAreaElement} */
  #innerTextArea = document.createElement("textarea");

  /** @type {String} */
  #defaultValue = "";

  /** @type {String} */
  #lastValue = "";

  /** @type {Boolean} */
  #isFocused = false;

  /** @type {import('../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /**
   * @type {import('./toolbar').LexisToolbarElement}
   */
  toolbar = null;

  static formAssociated = true;
  static observedAttributes = ["required"];

  constructor() {
    super();

    this.#setupInternals();
  }

  connectedCallback() {
    this.#setupContentRoot();
    this.#setupEditor();

    this.#setupListeners();
    this.#setupEditorUpdateListener();
    this.#validate();

    this.#attachToolbar();

    this.#defaultValue = this.getAttribute("value") ?? "";
    this.editor.value = this.#defaultValue;

    this.tabIndex = -1;

    if (this.hasAttribute("autofocus")) {
      queueMicrotask(() => this.editor.lexicalEditor.focus());
    }
  }

  disconnectedCallback() {
    this.#listeners.cleanup();
    this.editor.destroy();

    this.toolbar = null;
    this.#defaultValue = null;
    this.#editorInstance = null;
  }

  attributeChangedCallback(name) {
    if (name === "required") {
      const isRequired = this.hasAttribute("required");
      this.#innerTextArea.required = isRequired;
      this.#internals.ariaRequired = isRequired;
    }
  }

  formResetCallback() {
    this.editor.value = this.#defaultValue;
    this.#internals.setFormValue(this.#defaultValue);

    this.#validate();
  }

  formStateRestoreCallback(state) {
    this.editor.value = state ?? this.#defaultValue;
  }

  /**
   * @returns {import('../core/editor').Editor}
   */
  get editor() {
    return this.#editorInstance;
  }

  get value() {
    return this.editor.value;
  }

  set value(value) {
    this.editor.value = value;
  }

  get form() {
    return this.#internals.form;
  }

  /**
   * Setup form association and accessibility
   * @private
   */
  #setupInternals() {
    this.#internals = this.attachInternals();

    this.#internals.role = "textbox";
    this.#internals.ariaMultiLine = "true";
    this.#internals.ariaReadOnly = "false";
  }

  /**
   * Create and append contenteditable root element
   * @private
   */
  #setupContentRoot() {
    this.$rootEl = createElement("div", {
      class: "lexis-content",
      "data-slot": "editor-content",
      contentEditable: true,
    });
    this.append(this.$rootEl);
  }

  /**
   * Initialize editor instance and register commands
   * @private
   */
  #setupEditor() {
    this.#editorInstance = new Editor(this.$rootEl);

    for (const cmd of commands) {
      this.#editorInstance.registerCommand(cmd);
    }
  }

  #attachToolbar() {
    this.toolbar = this.#getToolbar() ?? this.#buildToolbar();

    for (const ext of this.editor.enabledExtensions) {
      const control = ext.render(this.toolbar);
      control && this.toolbar.append(control);
    }

    this.toolbar.attachEditor(this);
  }

  /**
   * Find toolbar element in DOM
   * @private
   * @returns {LexisToolbarElement|null}
   */
  #getToolbar() {
    let toolbar = this.querySelector("lexis-toolbar");

    if (!toolbar && this.hasAttribute("toolbar")) {
      const toolbarId = this.getAttribute("toolbar");
      toolbar = document.getElementById(toolbarId);
    }

    return toolbar instanceof LexisToolbarElement ? toolbar : null;
  }

  /**
   * Create new toolbar element
   * @private
   * @returns {LexisToolbarElement}
   */
  #buildToolbar() {
    return document.createElement("lexis-toolbar");
  }

  /**
   * Setup event listeners
   * @private
   */
  #setupListeners() {
    this.#listeners.track(
      registerEventListener(this, "focusin", this.#handleFocusIn),
    );
    this.#listeners.track(
      registerEventListener(this, "focusout", this.#handleFocusOut),
    );
  }

  #handleFocusIn = () => {
    if (this.#isFocused) return;

    this.#isFocused = true;
    this.#lastValue = this.editor.value;
    this.dispatchEvent(new CustomEvent("editor:focus", { bubbles: true }));
  };

  #handleFocusOut = (e) => {
    if (this.contains(e.relatedTarget)) return;

    this.#isFocused = false;

    if (this.editor.value !== this.#lastValue) {
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }

    this.dispatchEvent(new CustomEvent("editor:blur", { bubbles: true }));
  };

  get hasFocus() {
    return this.#isFocused;
  }

  /**
   * Setup editor update listener for form integration
   * @private
   */
  #setupEditorUpdateListener() {
    this.#listeners.track(
      this.#editorInstance.lexicalEditor.registerUpdateListener(
        ({ dirtyElements, dirtyLeaves }) => {
          // Ignore selection-only changes — those aren't content changes
          if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

          const value = this.editor.value;
          this.#internals.setFormValue(value);
          this.#innerTextArea.value = value;

          this.#validate();

          this.dispatchEvent(
            new CustomEvent("editor:change", {
              bubbles: true,
              detail: { value },
            }),
          );
        },
      ),
    );
  }

  /**
   * Validate form element
   * @private
   */
  #validate() {
    if (!this.#innerTextArea.validity.valid) {
      this.#internals.setValidity(
        this.#innerTextArea.validity,
        this.#innerTextArea.validationMessage,
        this.$rootEl,
      );
      return;
    }

    this.#internals.setValidity({});
  }
}
