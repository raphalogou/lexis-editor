import { $getNearestNodeOfType } from "@lexical/utils";
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  defineExtension,
  isDOMNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  mergeRegister,
  SELECTION_CHANGE_COMMAND,
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
  #captionInput = null;

  /** @type {import('../../elements/popover').PopoverElement | null} */
  #popoverEl = null;

  /** @type {Set<string>} */
  #previouslySelectedKeys = new Set();

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/image",
      nodes: [ImageNode],
      register: (lexicalEditor, _, _state) => {
        return mergeRegister(
          lexicalEditor.registerCommand(
            INSERT_IMAGE_COMMAND,
            (payload) => {
              if (!payload || typeof payload.src !== "string") {
                return false;
              }

              lexicalEditor.update(() => {
                const imageNode = $createImageNode(payload);
                insertImageNodeAtSelection(imageNode);
              });

              return true;
            },
            COMMAND_PRIORITY_EDITOR,
          ),

          lexicalEditor.registerCommand(
            CLICK_COMMAND,
            (event) => {
              if (!isDOMNode(event.target)) {
                return false;
              }

              const targetNode = $getNearestNodeFromDOMNode(event.target);
              if (!$isImageNode(targetNode)) {
                return false;
              }

              this.#selectImageNode(targetNode);
              this.#syncSelectedClasses(lexicalEditor);
              return true;
            },
            COMMAND_PRIORITY_LOW,
          ),

          lexicalEditor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            (evt) => this.#handleArrowDown(evt),
            COMMAND_PRIORITY_HIGH,
          ),

          lexicalEditor.registerCommand(
            KEY_ARROW_UP_COMMAND,
            (evt) => this.#handleArrowUp(evt),
            COMMAND_PRIORITY_HIGH,
          ),

          lexicalEditor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
              this.#syncSelectedClasses(lexicalEditor);
              return false;
            },
            COMMAND_PRIORITY_EDITOR,
          ),

          lexicalEditor.registerUpdateListener(() => {
            lexicalEditor.read(() => {
              this.#syncSelectedClasses(lexicalEditor);
            });
          }),
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
    this.#captionInput = null;
    this.#previouslySelectedKeys.clear();
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

    const captionInput = createElement("input", {
      type: "text",
      id: `lexis-image-caption-${this.#uid}`,
      name: "caption",
      placeholder: "Caption (optional)",
    });

    const srcLabel = createElement("label", {
      for: `lexis-image-src-${this.#uid}`,
      children: ["Image URL", srcInput],
    });

    const captionLabel = createElement("label", {
      for: `lexis-image-caption-${this.#uid}`,
      children: ["Caption", captionInput],
    });

    const insertButton = createElement("button", {
      type: "button",
      class: "lexis-button lexis-image-popover-submit",
      "data-command": "insert-image",
      children: ["Insert"],
    });

    panel.append(srcLabel, captionLabel, insertButton);
    popover.append(trigger, panel);
    return popover;
  }

  #initializeElements() {
    this.#srcInput = this.element.querySelector("[name='src']");
    this.#captionInput = this.element.querySelector("[name='caption']");

    if (!this.#srcInput || !this.#captionInput) {
      throw new Error("ImageExtension requires src and caption input elements");
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

      registerEventListener(this.#captionInput, "keydown", (evt) => {
        if (evt.key !== "Enter") {
          return;
        }

        evt.preventDefault();
        this.#insertImage();
      }),

      registerEventListener(this.#popoverEl, "popover:open", () => {
        this.editor.lexicalEditor.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) && !$isNodeSelection(selection)) {
            return;
          }

          const focusNode = $isRangeSelection(selection)
            ? selection.focus.getNode()
            : this.#getFirstSelectedNode(selection);
          if (!focusNode) {
            return;
          }

          const node = $getNearestNodeOfType(focusNode, ImageNode);
          if ($isImageNode(node)) {
            this.#srcInput.value = node.getSrc();
            this.#captionInput.value = node.getCaption();
          }
        });
      }),

      registerEventListener(this.#popoverEl, "popover:close", () => {
        this.#srcInput.value = "";
        this.#captionInput.value = "";

        setTimeout(() => {
          this.editor.lexicalEditor.focus();
        }, 50);
      }),
    );
  }

  #insertImage() {
    const src = this.#srcInput.value.trim();
    const caption = this.#captionInput.value.trim();

    this.#srcInput.value = src;
    this.#captionInput.value = caption;

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
      caption,
      title: null,
    });
    this.#popoverEl?.hide();
    this.#srcInput.value = "";
    this.#captionInput.value = "";
  }

  #getFirstSelectedNode(selection) {
    const [firstNode] = Array.from(selection.getNodes());
    return firstNode || null;
  }

  #handleArrowDown(evt) {
    const selection = $getSelection();

    if ($isNodeSelection(selection)) {
      const imageNode = this.#getSingleSelectedImageNode(selection);
      if (!imageNode) {
        return false;
      }

      let nextSibling = imageNode.getNextSibling();
      if (!nextSibling) {
        nextSibling = $createParagraphNode();
        imageNode.insertAfter(nextSibling);
      }

      selectNodeStart(nextSibling);
      evt.preventDefault();
      return true;
    }

    if ($isRangeSelection(selection)) {
      const focusNode = selection.focus.getNode();
      const parentElement = focusNode.getTopLevelElement();
      const nextSibling = parentElement.getNextSibling();

      if ($isDecoratorNode(nextSibling)) {
        const newSelection = $createNodeSelection();
        newSelection.add(nextSibling.getKey());
        $setSelection(newSelection);
        evt.preventDefault();
        return true;
      }

      return false;
    }
  }

  #handleArrowUp(evt) {
    const selection = $getSelection();

    if ($isNodeSelection(selection)) {
      const imageNode = this.#getSingleSelectedImageNode(selection);
      if (!imageNode) {
        return false;
      }

      const previousSibling = imageNode.getPreviousSibling();
      if (!previousSibling) {
        return false;
      }

      selectNodeEnd(previousSibling);
      evt.preventDefault();
      return true;
    }

    if ($isRangeSelection(selection)) {
      const focusNode = selection.focus.getNode();
      const parentElement = focusNode.getTopLevelElement();
      const previousSibling = parentElement.getPreviousSibling();

      if ($isDecoratorNode(previousSibling)) {
        const newSelection = $createNodeSelection();
        newSelection.add(previousSibling.getKey());
        $setSelection(newSelection);
        evt.preventDefault();
        return true;
      }
    }

    return false;
  }

  #selectImageNode(imageNode) {
    const selection = $createNodeSelection();
    selection.add(imageNode.getKey());
    $setSelection(selection);
  }

  #getSingleSelectedImageNode(selection) {
    const nodes = selection.getNodes();
    if (nodes.length !== 1) {
      return null;
    }

    const [node] = nodes;
    return $isImageNode(node) ? node : null;
  }

  #getCurrentSelectedKeys() {
    const selection = $getSelection();
    const keys = new Set();

    if ($isNodeSelection(selection)) {
      for (const node of selection.getNodes()) {
        if ($isImageNode(node)) {
          keys.add(node.getKey());
        }
      }
    }

    return keys;
  }

  #syncSelectedClasses(lexicalEditor) {
    const currentKeys = this.#getCurrentSelectedKeys();

    for (const key of this.#previouslySelectedKeys) {
      if (currentKeys.has(key)) {
        continue;
      }

      const domNode = lexicalEditor.getElementByKey(key);
      if (!domNode) {
        continue;
      }

      domNode.dataset.selected = "false";
    }

    for (const key of currentKeys) {
      if (this.#previouslySelectedKeys.has(key)) {
        continue;
      }

      const domNode = lexicalEditor.getElementByKey(key);
      if (!domNode) {
        continue;
      }

      domNode.dataset.selected = "true";
    }

    this.#previouslySelectedKeys = currentKeys;
  }
}

function selectNodeEnd(node) {
  let targetNode = node;

  while ($isElementNode(targetNode)) {
    const lastChild = targetNode.getLastChild();
    if (!lastChild) {
      break;
    }

    targetNode = lastChild;
  }

  if ($isTextNode(targetNode)) {
    const size = targetNode.getTextContentSize();
    targetNode.select(size, size);
    return;
  }

  targetNode.selectEnd();
}
