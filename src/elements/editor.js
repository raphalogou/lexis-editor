import { commands } from "../core/commands";
import { Editor } from "../core/editor";
import { createElement } from "../helper/jsx-runtime";
import { ListenerRegistry, registerEventListener } from "../helper/listener";
import { LexisToolbarElement } from "./toolbar";

export class LexisEditorElement extends HTMLElement {
  /**
   * @type {{
   * markdown: boolean,
   * extensions: Array<typeof import('../core/extensions/extension').LexisExtension>,
   * extensionMode: 'append' | 'replace',
   * lexical: { namespace?: string, theme?: Record<string, any> }
   * }}
   */
  static defaultConfig = {
    markdown: true,
    extensions: [],
    extensionMode: "append",
    lexical: {},
  };

  static defaultToolbarTemplate =
    "bold italic underline code | heading-2 heading-3 paragraph quote divider code-block | number-list bullet-list | link ~ undo redo";

  /** @type {import('../core/editor').Editor} */
  #editorInstance;

  /** @type {Record<string, any>} */
  #resolvedConfig = null;

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
  static observedAttributes = ["placeholder", "required"];

  constructor() {
    super();

    this.#setupInternals();
  }

  connectedCallback() {
    this.#setupContentRoot();
    this.#resolvedConfig = this.#resolveInitialConfig();
    this.#setupEditor(this.#resolvedConfig);

    this.#setupListeners();
    this.#setupEditorUpdateListener();
    this.#validate();

    this.#attachToolbar();

    this.#defaultValue = this.getAttribute("value") ?? "";
    this.editor.value = this.#defaultValue;
    this.#syncPlaceholderState();

    this.#dispatchEditorReady(this.#resolvedConfig);

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

    if (name === "placeholder") {
      this.#syncPlaceholderText();
      this.#syncPlaceholderState();
    }
  }

  formResetCallback() {
    this.editor.value = this.#defaultValue;
    this.#internals.setFormValue(this.#defaultValue);
    this.#syncPlaceholderState();

    this.#validate();
    this.editor.selectEnd();
  }

  formStateRestoreCallback(state) {
    this.editor.value = state ?? this.#defaultValue;
    this.#syncPlaceholderState();
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

    this.#syncPlaceholderText();

    this.append(this.$rootEl);
  }

  /**
   * Initialize editor instance and register commands
   * @private
   */
  #setupEditor(config) {
    this.#editorInstance = new Editor(this.$rootEl, config);
    this.#editorInstance.attachHostElement(this);

    for (const cmd of commands) {
      this.#editorInstance.registerCommand(cmd);
    }
  }

  #attachToolbar() {
    if (this.#isToolbarDisabled()) {
      this.toolbar = null;
      return;
    }

    this.toolbar = this.#getToolbar() ?? this.#buildToolbar();

    if (!this.toolbar.isConnected) {
      this.prepend(this.toolbar);
    }

    this.toolbar.attachEditor(this);
  }

  #isToolbarDisabled() {
    return this.getAttribute("toolbar")?.trim() === "false";
  }

  /**
   * Find toolbar element in DOM
   * @private
   * @returns {LexisToolbarElement|null}
   */
  #getToolbar() {
    const inlineToolbar = this.querySelector("lexis-toolbar");
    if (inlineToolbar instanceof LexisToolbarElement) {
      return inlineToolbar;
    }

    if (!this.hasAttribute("toolbar")) {
      return null;
    }

    const toolbarValue = this.getAttribute("toolbar")?.trim();
    if (!toolbarValue || toolbarValue === "false") {
      return null;
    }

    const toolbarById = document.getElementById(toolbarValue);
    if (toolbarById instanceof LexisToolbarElement) {
      return toolbarById;
    }

    return this.#buildToolbar(toolbarValue);
  }

  /**
   * Create new toolbar element
   * @private
   * @returns {LexisToolbarElement}
   */
  #buildToolbar(template = LexisEditorElement.defaultToolbarTemplate) {
    const toolbar = document.createElement("lexis-toolbar");
    const controlsByToken = new Map();

    for (const ext of this.editor.enabledExtensions) {
      const control = ext.render(toolbar);
      if (!control) {
        continue;
      }

      const token =
        control.dataset.lexisControl ||
        control.dataset.command ||
        ext.name ||
        "";

      if (!token) {
        continue;
      }

      controlsByToken.set(token, control);
    }

    toolbar.buildFromTemplate(template, this.editor, (token) => {
      const control = controlsByToken.get(token);
      if (!control) {
        return null;
      }

      controlsByToken.delete(token);
      return control;
    });

    return toolbar;
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
          this.#syncPlaceholderState();

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

  #syncPlaceholderText() {
    if (!this.$rootEl) return;

    const placeholder = this.getAttribute("placeholder") ?? "";
    this.$rootEl.dataset.placeholder = placeholder;

    if (placeholder) {
      this.#internals.ariaPlaceholder = placeholder;
      return;
    }

    this.#internals.ariaPlaceholder = null;
  }

  #syncPlaceholderState() {
    if (!this.$rootEl || !this.#editorInstance) return;

    this.$rootEl.dataset.empty = String(this.editor.isEmpty);
  }

  #resolveInitialConfig() {
    const draftConfig = {
      ...LexisEditorElement.defaultConfig,
      extensions: [...LexisEditorElement.defaultConfig.extensions],
      lexical: { ...LexisEditorElement.defaultConfig.lexical },
    };

    if (this.hasAttribute("markdown")) {
      draftConfig.markdown = this.getAttribute("markdown") !== "false";
    }

    let canConfigure = true;
    const configure = (patch) => {
      if (!canConfigure) {
        return;
      }

      applyConfigPatch(draftConfig, patch);
    };

    this.dispatchEvent(
      new CustomEvent("editor:initialize", {
        bubbles: true,
        composed: true,
        detail: {
          config: Object.freeze({
            ...draftConfig,
            extensions: [...draftConfig.extensions],
            lexical: { ...(draftConfig.lexical || {}) },
          }),
          configure,
          editorElement: this,
        },
      }),
    );

    canConfigure = false;

    return normalizeEditorConfig(draftConfig);
  }

  #dispatchEditorReady(config) {
    this.dispatchEvent(
      new CustomEvent("editor:ready", {
        bubbles: true,
        composed: true,
        detail: {
          editor: this.#editorInstance,
          config: Object.freeze({
            ...config,
            lexical: { ...(config.lexical || {}) },
          }),
        },
      }),
    );
  }
}

function normalizeEditorConfig(input) {
  return {
    markdown: input.markdown === true,
    extensions: Array.isArray(input.extensions) ? input.extensions : [],
    extensionMode: input.extensionMode === "replace" ? "replace" : "append",
    lexical:
      input.lexical && typeof input.lexical === "object" ? input.lexical : {},
  };
}

function applyConfigPatch(target, patch) {
  if (!isPlainObject(patch)) {
    return;
  }

  const { markdown, extensions, extensionMode, lexical } = patch;

  if (markdown !== undefined) {
    target.markdown = markdown === true;
  }

  if (Array.isArray(extensions)) {
    target.extensions = [...extensions];
  }

  if (extensionMode !== undefined) {
    target.extensionMode = extensionMode === "replace" ? "replace" : "append";
  }

  if (isPlainObject(lexical)) {
    target.lexical = deepMergeObjects(target.lexical || {}, lexical);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMergeObjects(base, overrides) {
  const output = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(output[key]) && isPlainObject(value)) {
      output[key] = deepMergeObjects(output[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}
