import { $applyNodeReplacement, createCommand, DecoratorNode } from "lexical";

export const INSERT_IMAGE_COMMAND = createCommand("INSERT_IMAGE_COMMAND");

/**
 * @typedef {import('lexical').Spread<{
 *  alt: string,
 *  src: string,
 *  title: string | null,
 * }, import('lexical').SerializedLexicalNode>} SerializedImageNode
 */

export class ImageNode extends DecoratorNode {
  /** @type {string} */
  __src;

  /** @type {string} */
  __alt;

  /** @type {string | null} */
  __title;

  /**
   * @param {string} src
   * @param {string} [alt]
   * @param {string | null} [title]
   * @param {import('lexical').NodeKey} [key]
   */
  constructor(src, alt = "", title = null, key) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__title = title;
  }

  static getType() {
    return "image";
  }

  /** @param {ImageNode} node */
  static clone(node) {
    return new ImageNode(node.__src, node.__alt, node.__title, node.__key);
  }

  /** @param {SerializedImageNode} serializedNode */
  static importJSON(serializedNode) {
    return $createImageNode({
      src: serializedNode.src,
      alt: serializedNode.alt,
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
              alt: domNode.alt || "",
              title: domNode.title || null,
            }),
          };
        },
        priority: 1,
      }),
    };
  }

  exportJSON() {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      alt: this.__alt,
      title: this.__title,
    };
  }

  exportDOM() {
    const element = document.createElement("img");
    element.src = this.__src;
    element.alt = this.__alt;

    if (this.__title) {
      element.title = this.__title;
    }

    return { element };
  }

  createDOM() {
    const image = document.createElement("img");
    image.className = "editor-image";
    image.src = this.__src;
    image.alt = this.__alt;

    if (this.__title) {
      image.title = this.__title;
    }

    image.draggable = false;
    return image;
  }

  /** @param {ImageNode} prevNode @param {HTMLElement} dom */
  updateDOM(prevNode, dom) {
    if (prevNode.__src !== this.__src) {
      dom.src = this.__src;
    }

    if (prevNode.__alt !== this.__alt) {
      dom.alt = this.__alt;
    }

    if (prevNode.__title !== this.__title) {
      if (this.__title) {
        dom.title = this.__title;
      } else {
        dom.removeAttribute("title");
      }
    }

    return false;
  }

  isInline() {
    return false;
  }

  getTextContent() {
    return "";
  }

  getSrc() {
    return this.getLatest().__src;
  }

  getAlt() {
    return this.getLatest().__alt;
  }

  getTitle() {
    return this.getLatest().__title;
  }

  /** @param {{src?: string, alt?: string, title?: string | null}} payload */
  setImagePayload(payload) {
    const writable = this.getWritable();

    if (typeof payload.src === "string") {
      writable.__src = payload.src;
    }

    if (typeof payload.alt === "string") {
      writable.__alt = payload.alt;
    }

    if (payload.title !== undefined) {
      writable.__title = payload.title;
    }

    return writable;
  }
}

/**
 * @param {{src: string, alt?: string, title?: string | null}} payload
 */
export function $createImageNode(payload) {
  const { src, alt = "", title = null } = payload;
  return $applyNodeReplacement(new ImageNode(src, alt, title));
}

/** @param {import('lexical').LexicalNode | null | undefined} node */
export function $isImageNode(node) {
  return node instanceof ImageNode;
}
