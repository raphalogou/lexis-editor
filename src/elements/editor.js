import { commands } from "../core/commands";
import { Editor } from "../core/editor";
import { createElement } from "../helper";
import { LexisToolbarElement } from "./toolbar";

export class LexisEditorElement extends HTMLElement {
  /** @type {import('../core/editor').Editor} */
  #editorInstance;

  /** @type {ElementInternals} */
  #internals;

  /** @type {HTMLTextAreaElement} */
  #innerTextArea = document.createElement("textarea");

  /** @type {String} */
  #lastValue = "";

  static formAssociated = true;
  static observedAttributes = ["required"];

  constructor() {
    super();
    this.#setupInternals();
    this.#setupContentRoot();
    this.#setupEditor();
  }

  connectedCallback() {
    this.tabIndex = -1;

    const toolbar = this.#getToolbar() ?? this.#buildToolbar();
    toolbar.attachEditor(this.editor);

    this.#setupBlurListener();
    this.#setupEditorUpdateListener();
    this.#validate();
  }

  attributeChangedCallback(name) {
    if (name === "required") {
      const isRequired = this.hasAttribute("required");
      this.#innerTextArea.required = isRequired;
      this.#internals.ariaRequired = isRequired;
    }
  }

  /**
   * @returns {import('../core/editor').Editor}
   */
  get editor() {
    return this.#editorInstance;
  }

  get value() {
    return this.editor.markdownValue;
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
    this.$rootEl = createElement(
      "div",
      {
        class: "lexis-content",
        "data-slot": "editor-content",
        contentEditable: true,
      },
      {},
    );
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
   * Setup blur event listener for change detection
   * @private
   */
  #setupBlurListener() {
    this.$rootEl.addEventListener("blur", () => {
      if (this.#lastValue !== this.value) {
        this.#lastValue = this.value;
        this.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  /**
   * Setup editor update listener for form integration
   * @private
   */
  #setupEditorUpdateListener() {
    this.#editorInstance.lexicalEditor.registerUpdateListener(() => {
      const contentValue = this.value;

      this.dispatchEvent(
        new CustomEvent("editor:change", {
          detail: { value: contentValue },
          bubbles: true,
        }),
      );

      this.#innerTextArea.value = this.#editorInstance.textValue;
      this.#internals.setFormValue(contentValue);

      this.#validate();
    });
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
