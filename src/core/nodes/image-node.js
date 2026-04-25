import {
  $applyNodeReplacement,
  $getEditor,
  createCommand,
  DecoratorNode,
  HISTORY_MERGE_TAG,
} from "lexical";

export const INSERT_IMAGE_COMMAND = createCommand("INSERT_IMAGE_COMMAND");

export const UPLOAD_STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  ERROR: "error",
};

export const IMAGE_SOURCE = {
  URL: "url",
  FILE: "file",
};

/**
 * @typedef {import('lexical').Spread<{
 *  caption: string,
 *  src: string,
 *  title: string | null,
 * }, import('lexical').SerializedLexicalNode>} SerializedImageNode
 */

export class ImageNode extends DecoratorNode {
  /** @type {string} */
  __url;

  /** @type {string} */
  __description;

  /** @type {string | null} */
  __source = null; // url | upload

  /** @type {{status: string, progress: number, error: string|null}} */
  __upload = null;

  /**
   * @param {string} src
   * @param {string} [caption]
   * @param {string | null} [title]
   * @param {import('lexical').NodeKey} [key]
   */
  constructor({ url, description = "", source = IMAGE_SOURCE.URL }, key) {
    super(key);
    this.__url = url;
    this.__description = description;
    this.__source = source;
    this.__upload = {
      status:
        source === IMAGE_SOURCE.URL
          ? UPLOAD_STATUS.IDLE
          : UPLOAD_STATUS.UPLOADING,
      progress: 0,
      error: null,
    };

    this.editor = $getEditor();
  }

  static getType() {
    return "image";
  }

  /** @param {ImageNode} node */
  static clone(node) {
    const cloned = new ImageNode(
      {
        url: node.__url,
        description: node.__description,
        source: node.__source,
      },
      node.__key,
    );

    return cloned;
  }

  /** @param {SerializedImageNode} serializedNode */
  static importJSON(serializedNode) {
    return $createImageNode({
      url: serializedNode.url,
      description: serializedNode.description || "",
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
              url: domNode.src,
              description: domNode.alt || "",
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
              url: image.src,
              description: figcaption?.textContent?.trim() || image.alt || "",
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
      url: this.__url,
      description: this.__description,
    };
  }

  exportDOM() {
    const figure = document.createElement("figure");
    figure.className = "editor-image";

    const image = document.createElement("img");
    image.src = this.__url;
    image.alt = this.__description || "";

    if (this.__description) {
      image.title = this.__description;
    }

    const caption = document.createElement("figcaption");
    caption.setAttribute("data-slot", "image-caption");
    caption.textContent = this.__description;

    figure.append(image, caption);
    return { element: figure };
  }

  createDOM(_config, editor) {
    const figure = document.createElement("figure");
    figure.className = "editor-image";
    figure.dataset.selected = "false";
    if (this.__upload.status !== UPLOAD_STATUS.IDLE) {
      figure.dataset.uploadStatus = this.__upload.status;
    }

    const image = document.createElement("img");
    image.src = this.__url;
    image.alt = this.__description || "";

    if (this.__description) {
      image.title = this.__description;
    }

    image.draggable = false;

    // Let's build the overlay
    const overlay = document.createElement("div");
    overlay.className = "editor-image-overlay";

    const progressSlot = document.createElement("div");
    progressSlot.setAttribute("data-slot", "upload-progress");

    /** @type {import("../../elements/progress").ProgressElement} */
    const progressBar = document.createElement("ui-progress");
    progressBar.setAttribute("data-slot", "progress-bar");
    progressBar.value = 0;
    progressBar.contentEditable = false;

    progressSlot.append(progressBar);

    const errorSlot = document.createElement("div");
    errorSlot.setAttribute("data-slot", "upload-error");

    const errorMessage = document.createElement("p");
    errorMessage.setAttribute("data-slot", "error-message");

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "Retry";

    errorSlot.append(errorMessage, retryButton);

    overlay.append(progressSlot, errorSlot);

    // Let's build the caption element
    const caption = document.createElement("figcaption");
    caption.setAttribute("data-slot", "image-caption");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "editor-image-caption-input";
    input.placeholder = "Add caption...";
    input.value = this.__description;

    input.onblur = () => {
      editor.update(
        () => (this.getWritable().__description = input.value.trim()),
      );
    };

    input.onkeydown = (evt) => {
      evt.stopPropagation();

      if (!["Enter", "Escape"].includes(evt.key)) {
        return;
      }

      evt.target.blur();
      editor.update(
        () => {
          this.selectNext(0, 0);
        },
        { tag: HISTORY_MERGE_TAG },
      );
    };

    caption.append(input);
    figure.append(image, overlay, caption);

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

    if (prevNode.__url !== this.__url) {
      image.src = this.__url;
    }

    if (prevNode.__description !== this.__description) {
      image.alt = this.__description || "";
      captionInput.value = this.__description;

      if (!this.__description) {
        image.removeAttribute("title");
      }
    }

    // Handle upload status
    if (this.__upload.status !== UPLOAD_STATUS.IDLE) {
      dom.setAttribute("data-upload-status", this.__upload.status);
    } else {
      dom.removeAttribute("data-upload-status");
    }

    const progressBar = dom.querySelector("ui-progress");
    if (progressBar) {
      progressBar.value = this.__upload.progress;
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

  getUrl() {
    return this.getLatest().__url;
  }

  getDescription() {
    const caption = this.getLatest().__description;
    return caption || "";
  }

  /** @param {{url?: string, description?: string|null}} payload */
  setImagePayload(payload) {
    const writable = this.getWritable();

    if (typeof payload.url === "string") {
      writable.__url = payload.url;
    }

    if (typeof payload.description === "string") {
      writable.__description = payload.description;
    }

    return writable;
  }

  /** @param {{status: "idle" | "uploading" | "error", error: string|null, progress: Number}} payload */
  setUploadStatus(payload) {
    const writable = this.getWritable();

    const { status = UPLOAD_STATUS.IDLE, error = null, progress = 0 } = payload;

    writable.__upload = {
      status,
      progress,
      error,
    };

    return writable;
  }

  updateProgress(progress) {
    const latest = this.getLatest();

    this.setUploadStatus({
      ...latest.__upload,
      progress,
      status: progress === 100 ? UPLOAD_STATUS.IDLE : latest.__upload.status,
    });
  }
}

/**
 * @param {{url: string, description?: string, source?: string | null}} payload
 */
export function $createImageNode(payload) {
  const { url, description = "", source = IMAGE_SOURCE.URL } = payload;
  return $applyNodeReplacement(new ImageNode({ url, description, source }));
}

/** @param {import('lexical').LexicalNode | null | undefined} node */
export function $isImageNode(node) {
  return node instanceof ImageNode;
}
