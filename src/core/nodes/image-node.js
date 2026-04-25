import {
  $applyNodeReplacement,
  createCommand,
  DecoratorNode,
  HISTORY_MERGE_TAG,
} from "lexical";
import { h, parseSvgIcon } from "../../helper/html";
import { UI_ICONS } from "../commands/icons";

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
 *  description: string,
 *  url: string,
 *  source: string,
 *  upload: {status: string, progress: number, error: string|null},
 * }, import('lexical').SerializedLexicalNode>} SerializedImageNode
 */

export class ImageNode extends DecoratorNode {
  /** @type {string} */
  __url;

  /** @type {string} */
  __description;

  /** @type {string | null} */
  __source = null; // url | file

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

    cloned.__upload = { ...node.__upload };

    return cloned;
  }

  /** @param {SerializedImageNode} serializedNode */
  static importJSON(serializedNode) {
    const source =
      serializedNode.source === IMAGE_SOURCE.FILE
        ? IMAGE_SOURCE.FILE
        : IMAGE_SOURCE.URL;

    const upload =
      serializedNode.upload && typeof serializedNode.upload === "object"
        ? serializedNode.upload
        : null;

    const status =
      upload?.status === UPLOAD_STATUS.ERROR ||
      upload?.status === UPLOAD_STATUS.UPLOADING ||
      upload?.status === UPLOAD_STATUS.IDLE
        ? upload.status
        : source === IMAGE_SOURCE.FILE
          ? UPLOAD_STATUS.UPLOADING
          : UPLOAD_STATUS.IDLE;

    const progress =
      typeof upload?.progress === "number" && Number.isFinite(upload.progress)
        ? Math.max(0, Math.min(100, upload.progress))
        : 0;

    const error = typeof upload?.error === "string" ? upload.error : null;

    const newNode = $createImageNode({
      url: serializedNode.url,
      description: serializedNode.description || "",
      source,
    });

    newNode.__upload = {
      status,
      progress,
      error,
    };

    return newNode;
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
      source: this.__source,
      upload: this.__upload,
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
    const image = h("img", {
      src: this.__url,
      alt: this.__description,
      title: this.__description ?? undefined,
      draggable: false,
    });

    // Let's build the overlay
    const overlay = h("div", {
      class: "editor-image-overlay",
      children: [
        h("div", {
          "data-slot": "upload-progress",
          children: [
            h("ui-progress", {
              "data-slot": "progress-bar",
              value: 0,
              contentEditable: false,
            }),
          ],
        }),
        h("div", {
          "data-slot": "upload-error",
          children: [
            parseSvgIcon(UI_ICONS.error, {
              "data-slot": "error-icon",
              width: "36px",
              size: "36px",
            }),
            h("div", {
              children: [
                h("div", {
                  "data-slot": "error-title",
                  children: ["Upload failed"],
                }),
                h("div", { "data-slot": "error-message" }),
              ],
            }),
          ],
        }),
      ],
    });

    const input = h("input", {
      type: "text",
      class: "editor-image-caption-input",
      placeholder: "Add a caption...",
      value: this.__description,
      onBlur: () => {
        editor.update(
          () => (this.getWritable().__description = input.value.trim()),
        );
      },
      onKeyDown: (evt) => {
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
      },
    });

    const caption = h("figcaption", {
      "data-slot": "image-caption",
      children: [input],
    });

    return h("figure", {
      class: "editor-image",
      "data-selected": "false",
      "data-upload-status":
        this.__upload.status !== UPLOAD_STATUS.IDLE
          ? this.__upload.status
          : undefined,
      children: [image, overlay, caption],
    });
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
      image.title = this.__description || "";
      captionInput.value = this.__description;

      if (!this.__description) {
        image.removeAttribute("title");
      }
    }

    // Handle upload status
    const uploadStatus = this.__upload.status ?? UPLOAD_STATUS.IDLE;
    if (uploadStatus !== UPLOAD_STATUS.IDLE) {
      dom.setAttribute("data-upload-status", uploadStatus);
    } else {
      dom.removeAttribute("data-upload-status");
      return false;
    }

    if (uploadStatus === UPLOAD_STATUS.ERROR) {
      const errorMessage = dom.querySelector("[data-slot='error-message']");
      if (errorMessage) {
        errorMessage.textContent = this.__upload.error;
      }
    } else {
      const progressBar = dom.querySelector("ui-progress");
      if (progressBar) {
        progressBar.value = this.__upload.progress;
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

  getUrl() {
    return this.getLatest().__url;
  }

  getDescription() {
    const caption = this.getLatest().__description;
    return caption || "";
  }

  /** @param {{url?: string, description?: string|null, source?: string|null}} payload */
  setImagePayload(payload) {
    const writable = this.getWritable();

    if (typeof payload.url === "string") {
      writable.__url = payload.url;
    }

    if (typeof payload.description === "string") {
      writable.__description = payload.description;
    }

    if (
      payload.source === IMAGE_SOURCE.URL ||
      payload.source === IMAGE_SOURCE.FILE
    ) {
      writable.__source = payload.source;
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
