import { commands } from "../core/commands";
import { Editor } from "../core/editor";
import { createElement } from "../helper";
import { LexisToolbarElement } from "./toolbar";

export class LexisEditorElement extends HTMLElement {
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
    this.dispatchEvent(new CustomEvent("lexis:before-initialize"));

    const toolbar = this.#getToolbar() ?? this.#buildToolbar();

    toolbar.attachEditor(this.#editorInstance);

    this.dispatchEvent(new CustomEvent("lexis:initialize"));
  }

  /**
   * @returns {import('./toolbar').LexisToolbarElement}
   */
  #getToolbar() {
    let toolbar = this.querySelector("lexis-toolbar");

    if (!toolbar && !!this.getAttribute("toolbar")) {
      const toolbarAttr = this.getAttribute("toolbar");
      toolbar = document.getElementById(toolbarAttr);
    }

    return toolbar instanceof LexisToolbarElement ? toolbar : null;
  }

  #buildToolbar() {
    const toolbar = document.createElement("lexis-toolbar");

    return toolbar;
  }
}
