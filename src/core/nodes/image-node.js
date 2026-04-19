import {
  $applyNodeReplacement,
  $getNearestNodeFromDOMNode,
  createCommand,
  DecoratorNode,
} from "lexical";

export const INSERT_IMAGE_COMMAND = createCommand("INSERT_IMAGE_COMMAND");

/**
 * @typedef {import('lexical').Spread<{
 *  caption: string,
 *  src: string,
 *  title: string | null,
 * }, import('lexical').SerializedLexicalNode>} SerializedImageNode
 */

export class ImageNode extends DecoratorNode {
  /** @type {string} */
  __src;

  /** @type {string} */
  __caption;

  /** @type {string | null} */
  __title;

  /**
   * @param {string} src
   * @param {string} [caption]
   * @param {string | null} [title]
   * @param {import('lexical').NodeKey} [key]
   */
  constructor(src, caption = "", title = null, key) {
    super(key);
    this.__src = src;
    this.__caption = caption;
    this.__title = title;
  }

  static getType() {
    return "image";
  }

  /** @param {ImageNode} node */
  static clone(node) {
    return new ImageNode(node.__src, node.__caption, node.__title, node.__key);
  }

  /** @param {SerializedImageNode} serializedNode */
  static importJSON(serializedNode) {
    return $createImageNode({
      src: serializedNode.src,
      caption: serializedNode.caption || serializedNode.alt || "",
      title: serializedNode.title,
    });
  }

  static importDOM() {
    return {
      img: () => ({
        conversion: (domNode) => {
          if (!(domNode instanceof HTMLImageElement) || !domNode.src) {
            return null;
          }

          return {
            node: $createImageNode({
              src: domNode.src,
              caption: domNode.alt || "",
              title: domNode.title || null,
            }),
          };
        },
        priority: 1,
      }),
      figure: () => ({
        conversion: (domNode) => {
          if (!(domNode instanceof HTMLElement)) {
            return null;
          }

          const image = domNode.querySelector("img");
          if (!(image instanceof HTMLImageElement) || !image.src) {
            return null;
          }

          const figcaption = domNode.querySelector("figcaption");
          return {
            node: $createImageNode({
              src: image.src,
              caption: figcaption?.textContent?.trim() || image.alt || "",
              title: image.title || null,
            }),
          };
        },
        priority: 2,
      }),
    };
  }

  exportJSON() {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      caption: this.__caption,
      title: this.__title,
    };
  }

  exportDOM() {
    const figure = document.createElement("figure");
    figure.className = "editor-image";

    const image = document.createElement("img");
    image.src = this.__src;
    image.alt = this.__caption || "";

    if (this.__title) {
      image.title = this.__title;
    }

    const caption = document.createElement("figcaption");
    caption.setAttribute("data-slot", "image-caption");
    caption.textContent = this.__caption;

    figure.append(image, caption);
    return { element: figure };
  }

  createDOM(_config, editor) {
    const figure = document.createElement("figure");
    figure.className = "editor-image";
    figure.dataset.selected = "false";

    const image = document.createElement("img");
    image.src = this.__src;
    image.alt = this.__caption || "";

    if (this.__title) {
      image.title = this.__title;
    }

    image.draggable = false;

    const caption = document.createElement("figcaption");
    caption.setAttribute("data-slot", "image-caption");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "editor-image-caption-input";
    input.placeholder = "Add caption...";
    input.value = this.__caption;

    input.oninput = () => {
      const captionText = input.value;

      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(figure);
        if (!$isImageNode(node)) {
          return;
        }

        node.setImagePayload({ caption: captionText });
      });
    };

    input.onkeydown = (evt) => evt.stopPropagation();

    caption.append(input);

    figure.append(image, caption);
    return figure;
  }

  /** @param {ImageNode} prevNode @param {HTMLElement} dom */
  updateDOM(prevNode, dom) {
    const image = dom.querySelector("img");
    const caption = dom.querySelector("figcaption");
    const captionInput = dom.querySelector(".editor-image-caption-input");
    if (
      !(image instanceof HTMLImageElement) ||
      !(caption instanceof HTMLElement) ||
      !(captionInput instanceof HTMLInputElement)
    ) {
      return true;
    }

    if (prevNode.__src !== this.__src) {
      image.src = this.__src;
    }

    if (prevNode.__caption !== this.__caption) {
      image.alt = this.__caption || "";
      captionInput.value = this.__caption;
    }

    if (prevNode.__title !== this.__title) {
      if (this.__title) {
        image.title = this.__title;
      } else {
        image.removeAttribute("title");
      }
    }

    return false;
  }

  isInline() {
    return false;
  }

  isKeyboardSelectable() {
    return true;
  }

  getTextContent() {
    return "";
  }

  getSrc() {
    return this.getLatest().__src;
  }

  getAlt() {
    const caption = this.getLatest().__caption;
    return caption || "";
  }

  getCaption() {
    return this.getLatest().__caption;
  }

  getTitle() {
    return this.getLatest().__title;
  }

  /** @param {{src?: string, caption?: string, title?: string | null}} payload */
  setImagePayload(payload) {
    const writable = this.getWritable();

    if (typeof payload.src === "string") {
      writable.__src = payload.src;
    }

    if (typeof payload.caption === "string") {
      writable.__caption = payload.caption;
    }

    if (payload.title !== undefined) {
      writable.__title = payload.title;
    }

    return writable;
  }
}

/**
 * @param {{src: string, caption?: string, title?: string | null}} payload
 */
export function $createImageNode(payload) {
  const { src, caption = "", title = null } = payload;
  return $applyNodeReplacement(new ImageNode(src, caption, title));
}

/** @param {import('lexical').LexicalNode | null | undefined} node */
export function $isImageNode(node) {
  return node instanceof ImageNode;
}
