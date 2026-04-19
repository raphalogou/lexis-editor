import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_EDITOR,
  defineExtension,
  mergeRegister,
} from "lexical";
import { parseSvgIcon } from "../../helper/html";
import { createElement } from "../../helper/jsx-runtime";
import { ListenerRegistry, registerEventListener } from "../../helper/listener";
import { validateUrl } from "../../helper/sanitizer";
import { COMMAND_ICONS } from "../commands/icons";
import {
  commands as imageCommands,
  insertImageNodeAtSelection,
} from "../commands/image";
import { logger } from "../logger";
import {
  $createImageNode,
  $isImageNode,
  ImageNode,
  INSERT_IMAGE_COMMAND,
} from "../nodes/image-node";
import { LexisExtension } from "./extension";

export class ImageExtension extends LexisExtension {
  name = "image";

  #uid = Math.random().toString(36).slice(2, 8);

  /** @type {import('../../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /** @type {HTMLInputElement|null} */
  #srcInput = null;

  /** @type {HTMLInputElement|null} */
  #altInput = null;

  /** @type {import('../../elements/popover').PopoverElement | null} */
  #popoverEl = null;

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/image",
      nodes: [ImageNode],
      register: (lexicalEditor) => {
        return mergeRegister(
          lexicalEditor.registerCommand(
            INSERT_IMAGE_COMMAND,
            (payload) => {
              if (!payload || typeof payload.src !== "string") {
                return false;
              }

              lexicalEditor.update(() => {
                insertImageNodeAtSelection($createImageNode(payload));
              });

              return true;
            },
            COMMAND_PRIORITY_EDITOR,
          ),
        );
      },
    });
  }

  get commands() {
    return imageCommands;
  }

  /**
   * @param {import('../../elements').LexisToolbarElement} toolbarEl
   * @returns {HTMLElement|null}
   */
  render(toolbarEl) {
    this.element =
      toolbarEl.querySelector("[data-lexis-extension='image']") ??
      this.#buildPopover();

    this.#initializeElements();
    this.#attachEventListeners();

    return this.element;
  }

  dispose() {
    this.#listeners.cleanup();

    this.#popoverEl = null;
    this.#srcInput = null;
    this.#altInput = null;
    this.element = null;
  }

  #buildPopover() {
    const popover = createElement("el-popover", {
      "data-lexis-extension": "image",
      label: "Image",
      placement: "bottom",
      offset: "8",
    });

    const trigger = createElement("button", {
      type: "button",
      slot: "trigger",
      class: "lexis-button lexis-button--icon",
      "data-lexis-control": "insert-image",
      "aria-label": "Image",
      title: "Image",
    });

    const triggerIcon = parseSvgIcon(COMMAND_ICONS.image);
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
      trigger.append("Image");
    }

    const panel = createElement("div", {
      slot: "panel",
      class: "lexis-popover-panel lexis-image-popover",
    });

    const srcInput = createElement("input", {
      type: "url",
      id: `lexis-image-src-${this.#uid}`,
      name: "src",
      placeholder: "https://image-url",
      autofocus: "true",
      required: "true",
    });

    const altInput = createElement("input", {
      type: "text",
      id: `lexis-image-alt-${this.#uid}`,
      name: "alt",
      placeholder: "Alternative text (optional)",
    });

    const srcLabel = createElement("label", {
      for: `lexis-image-src-${this.#uid}`,
      children: ["Image URL", srcInput],
    });

    const altLabel = createElement("label", {
      for: `lexis-image-alt-${this.#uid}`,
      children: ["Alt text", altInput],
    });

    const insertButton = createElement("button", {
      type: "button",
      class: "lexis-button lexis-image-popover-submit",
      "data-command": "insert-image",
      children: ["Insert"],
    });

    panel.append(srcLabel, altLabel, insertButton);
    popover.append(trigger, panel);
    return popover;
  }

  #initializeElements() {
    this.#srcInput = this.element.querySelector("[name='src']");
    this.#altInput = this.element.querySelector("[name='alt']");

    if (!this.#srcInput || !this.#altInput) {
      throw new Error("ImageExtension requires src and alt input elements");
    }

    if (!(this.element instanceof HTMLElement)) {
      throw new Error("ImageExtension requires a valid popover host element");
    }

    this.#popoverEl = this.element;
  }

  #attachEventListeners() {
    this.#listeners.track(
      registerEventListener(this.element, "editor:command", (evt) => {
        if (evt.detail.command !== "insert-image") {
          return;
        }

        evt.stopPropagation();
        this.#insertImage();
      }),

      registerEventListener(this.#srcInput, "keydown", (evt) => {
        if (evt.key !== "Enter") {
          return;
        }

        evt.preventDefault();
        this.#insertImage();
      }),

      registerEventListener(this.#altInput, "keydown", (evt) => {
        if (evt.key !== "Enter") {
          return;
        }

        evt.preventDefault();
        this.#insertImage();
      }),

      registerEventListener(this.#popoverEl, "popover:open", () => {
        this.editor.lexicalEditor.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return;
          }

          const node = $getNearestNodeOfType(
            selection.focus.getNode(),
            ImageNode,
          );
          if ($isImageNode(node)) {
            this.#srcInput.value = node.getSrc();
            this.#altInput.value = node.getAlt();
          }
        });
      }),

      registerEventListener(this.#popoverEl, "popover:close", () => {
        this.#srcInput.value = "";
        this.#altInput.value = "";
      }),
    );
  }

  #insertImage() {
    const src = this.#srcInput.value.trim();
    const alt = this.#altInput.value.trim();

    this.#srcInput.value = src;
    this.#altInput.value = alt;

    if (!src || !this.#srcInput.checkValidity()) {
      this.#srcInput.reportValidity();
      return;
    }

    if (!validateUrl(src)) {
      this.#srcInput.setCustomValidity("Invalid image URL format or protocol");
      this.#srcInput.reportValidity();
      logger.debug(`Invalid image URL provided: ${src}`);
      return;
    }

    this.#srcInput.setCustomValidity("");
    this.editor.runCommand("insert-image", {
      src,
      alt,
      title: null,
    });
    this.#popoverEl?.hide();
    this.#srcInput.value = "";
    this.#altInput.value = "";
  }
}
