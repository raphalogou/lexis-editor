import { createElement, parseSvgIcon } from "../../helper/html";
import { ListenerRegistry, registerEventListener } from "../../helper/listener";
import { validateUrl } from "../../helper/sanitizer";
import { COMMAND_ICONS } from "../commands/icons";
import { $getLinkNode } from "../commands/link";
import { logger } from "../logger";
import { LexisExtension } from "./extension";

export class LinkExtension extends LexisExtension {
  name = "link";

  /** @type {HTMLInputElement|null} */
  #urlInput = null;

  /** @type {import('../../elements/popover').PopoverElement | null} */
  element = null;

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

    this.#urlInput = null;
    this.element = null;
  }

  #buildPopover() {
    const popover = createElement("el-popover", {
      "data-lexis-extension": "link",
      label: "Link",
      placement: "bottom",
      offset: "8",
    });

    const trigger = createElement("button", {
      type: "button",
      slot: "trigger",
      class: "lexis-button lexis-button--icon",
      "data-lexis-control": "link",
      "aria-label": "Link",
      title: "Link",
    });

    const triggerIcon = parseSvgIcon(COMMAND_ICONS.link);
    if (triggerIcon) {
      triggerIcon.setAttribute("data-slot", "toolbar-icon");
      triggerIcon.setAttribute("aria-hidden", "true");
      trigger.append(
        createElement("span", {
          "data-slot": "toolbar-icon-wrapper",
          children: [triggerIcon],
        }),
      );
    } else {
      trigger.append("Link");
    }

    const panel = createElement("div", {
      slot: "panel",
      class: "link-popover-panel",
    });

    const input = createElement("input", {
      type: "url",
      name: "url",
      placeholder: "https://",
      autofocus: "",
    });

    const linkButton = createElement("button", {
      type: "button",
      class: "lexis-button",
      "data-command": "link",
      children: ["Link"],
    });

    const unlinkButton = createElement("button", {
      type: "button",
      class: "lexis-button",
      value: "cancel",
      "data-command": "unlink",
      children: ["Unlink"],
    });

    const actions = createElement("div", {
      "data-slot": "link-popover-actions",
      children: [linkButton, unlinkButton],
    });

    panel.append(input, actions);
    popover.append(trigger, panel);

    return popover;
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

    if (!(this.element instanceof HTMLElement)) {
      throw new Error("LinkExtension requires a valid popover host element");
    }
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
      registerEventListener(this.element, "popover:open", () => {
        if (this.editor.isActive("link")) {
          this.editor.lexicalEditor.read(() => {
            const linkNode = $getLinkNode();
            if (linkNode) {
              this.#urlInput.value = linkNode.getURL();
            }
          });
        }
      }),
      registerEventListener(this.element, "popover:close", () => {
        this.#urlInput.value = "";
        this.#urlInput.setCustomValidity("");
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

    // Validate URL format and protocol
    if (!validateUrl(url)) {
      this.#urlInput.setCustomValidity("Invalid URL format or protocol");
      this.#urlInput.reportValidity();
      logger.debug(`Invalid URL provided: ${url}`);
      return;
    }

    this.editor.runCommand("link", { url });
    this.element?.hide();
    this.#urlInput.value = "";
  }

  /**
   * Remove link
   * @private
   */
  #removeLink() {
    this.editor.runCommand("unlink");
    this.element?.hide();
    this.#urlInput.value = "";
  }
}
