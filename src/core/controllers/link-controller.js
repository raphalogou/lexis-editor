import { $getLinkNode } from "../commands/link";
import { Controller } from "./controller";

export class LinkController extends Controller {
  /** @type {HTMLInputElement|null} */
  #urlInput = null;

  /** @type {HTMLElement} */
  #popoverEl = null;

  /** @type {import('../editor').Editor|null} */
  #editor = null;

  /**
   * @param {import('../editor').Editor} editor
   */
  mount(editor) {
    this.#editor = editor;
    this.#initializeElements();
    this.#attachEventListeners();
  }

  /**
   * Initialize and validate required DOM elements
   * @private
   */
  #initializeElements() {
    this.#urlInput = this.element.querySelector("[name='url']");
    if (!this.#urlInput) {
      throw new Error("LinkController requires an input[name='url'] element");
    }

    this.#popoverEl = this.element.querySelector("[popover]");
    if (!this.#popoverEl) {
      throw new Error("LinkController requires a [popover] element");
    }

    this.#popoverEl.popover = "auto";
  }

  /**
   * Attach all event listeners
   * @private
   */
  #attachEventListeners() {
    this.element.addEventListener("editor:command", (evt) => {
      const { command } = evt.detail;

      if (!["link", "unlink"].includes(command)) {
        return;
      }

      evt.stopPropagation();
      command === "link" ? this.#insertLink() : this.#removeLink();
    });

    this.#urlInput.addEventListener("change", () => this.#insertLink());

    this.#popoverEl.addEventListener("toggle", (evt) => {
      if (evt.newState === "open" && this.#editor.isActive("link")) {
        this.#editor.lexicalEditor.read(() => {
          const linkNode = $getLinkNode();
          if (linkNode) {
            this.#urlInput.value = linkNode.getURL();
          }
        });

        return;
      }

      this.#urlInput.value = "";
    });
  }

  /**
   * Insert or update link
   * @private
   */
  #insertLink() {
    const url = this.#urlInput.value.trim();
    this.#urlInput.value = url;

    if (!url || !this.#urlInput.checkValidity()) {
      this.#urlInput.reportValidity();
      return;
    }

    this.#editor.runCommand("link", { url });
    this.#popoverEl?.hidePopover();
    this.#urlInput.value = "";
  }

  /**
   * Remove link
   * @private
   */
  #removeLink() {
    this.#editor.runCommand("unlink");
    this.#popoverEl?.hidePopover();
    this.#urlInput.value = "";
  }
}
