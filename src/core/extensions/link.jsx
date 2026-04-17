import { ListenerRegistry, registerEventListener } from "../../helper/listener";
import { $getLinkNode } from "../commands/link";
import { LexisExtension } from "./extension";

export class LinkExtension extends LexisExtension {
  name = "link";

  /** @type {HTMLInputElement|null} */
  #urlInput = null;

  /** @type {HTMLElement} */
  #popoverEl = null;

  /** @type {import('../../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /**
   * @param {import('../../elements').LexisToolbarElement} toolbarEl
   * @returns {HTMLElement|null}
   */
  render(toolbarEl) {
    this.element =
      toolbarEl.querySelector("[data-lexis-extension='link']") ??
      this.#buildPopover();

    this.#initializeElements();
    this.#attachEventListeners();

    return this.element;
  }

  dispose() {
    this.#listeners.cleanup();

    this.#popoverEl = null;
    this.#urlInput = null;
    this.element = null;
  }

  #buildPopover() {
    return (
      <el-popover data-lexis-extension="link">
        <button
          type="button"
          class="lexis-button"
          command="toggle-popover"
          commandfor="link-popover"
        >
          Link
        </button>

        <div id="link-popover" popover="auto">
          <input
            type="url"
            name="url"
            placeholder="https://"
            autofocus
            form="lexis/popover"
          />

          <button type="button" data-command="link" class="lexis-button">
            Link
          </button>
          <button type="button" data-command="unlink" class="lexis-button">
            Unlink
          </button>
        </div>
      </el-popover>
    );
  }

  /**
   * Initialize and validate required DOM elements
   * @private
   */
  #initializeElements() {
    this.#urlInput = this.element.querySelector("[name='url']");
    if (!this.#urlInput) {
      throw new Error("LinkExtension requires an input[name='url'] element");
    }

    this.#popoverEl = this.element.querySelector("[popover]");
    if (!this.#popoverEl) {
      throw new Error("LinkExtension requires a [popover] element");
    }

    this.#popoverEl.popover = "auto";
  }

  /**
   * Attach all event listeners
   * @private
   */
  #attachEventListeners() {
    this.#listeners.track(
      registerEventListener(this.element, "editor:command", (evt) => {
        const { command } = evt.detail;

        if (!["link", "unlink"].includes(command)) {
          return;
        }

        evt.stopPropagation();
        command === "link" ? this.#insertLink() : this.#removeLink();
      }),
    );

    this.#listeners.track(
      registerEventListener(this.#urlInput, "change", () => this.#insertLink()),
    );

    this.#listeners.track(
      registerEventListener(this.#popoverEl, "toggle", (evt) => {
        if (evt.newState === "open" && this.editor.isActive("link")) {
          this.editor.lexicalEditor.read(() => {
            const linkNode = $getLinkNode();
            if (linkNode) {
              this.#urlInput.value = linkNode.getURL();
            }
          });

          return;
        }

        this.#urlInput.value = "";
      }),
    );
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

    this.editor.runCommand("link", { url });
    this.#popoverEl?.hidePopover();
    this.#urlInput.value = "";
  }

  /**
   * Remove link
   * @private
   */
  #removeLink() {
    this.editor.runCommand("unlink");
    this.#popoverEl?.hidePopover();
    this.#urlInput.value = "";
  }
}
