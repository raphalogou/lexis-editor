import {
  $createNodeSelection,
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  defineExtension,
  isDOMNode,
  mergeRegister,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { parseSvgIcon } from "../../helper/html";
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
  IMAGE_SOURCE,
  ImageNode,
  INSERT_IMAGE_COMMAND,
  UPLOAD_STATUS,
} from "../nodes/image-node";
import { LexisExtension } from "./extension";

export class ImageExtension extends LexisExtension {
  name = "image";

  /** @type {import('../../elements/popover').PopoverElement | null} */
  element = null;

  static INSERT_MODE = {
    UPLOAD: "upload",
    URL: "url",
  };

  #insertMode = null; // upload | url

  #uid = Math.random().toString(36).slice(2, 8);

  /** @type {import('../../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /** @type {HTMLInputElement|null} */
  #urlInput = null;

  /** @type {HTMLInputElement|null} */
  #fileInput = null;

  /** @type {HTMLElement | null} */
  #popoverEl = null;

  /** @type {Set<string>} */
  #previouslySelectedKeys = new Set();

  /** @type {ImageNode|null} */
  #lastInsertedNode = null;

  /** @type {Map<string, {file: File, blobUrl: string}>} */
  #fileEntriesByNodeKey = new Map();

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/image",
      nodes: [ImageNode],
      register: (lexicalEditor, _, _state) => {
        return mergeRegister(
          lexicalEditor.registerCommand(
            INSERT_IMAGE_COMMAND,
            (payload) => {
              if (!payload || typeof payload.url !== "string") {
                return false;
              }

              lexicalEditor.update(() => {
                const imageNode = $createImageNode(payload);
                insertImageNodeAtSelection(imageNode);
                this.#lastInsertedNode = imageNode;
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
              this.#syncSelectedStates(lexicalEditor);
              return true;
            },
            COMMAND_PRIORITY_LOW,
          ),

          lexicalEditor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
              this.#syncSelectedStates(lexicalEditor);
              return false;
            },
            COMMAND_PRIORITY_EDITOR,
          ),

          lexicalEditor.registerUpdateListener(() => {
            lexicalEditor.read(() => {
              this.#syncSelectedStates(lexicalEditor);
            });
          }),

          lexicalEditor.registerMutationListener(
            ImageNode,
            (mutations) => {
              for (const [nodeKey, mutation] of mutations) {
                if (mutation !== "destroyed") {
                  continue;
                }

                this.#releaseNodeFileEntry(nodeKey);
              }
            },
            { skipInitialization: true },
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

    this.#resetToFirstTab();

    return this.element;
  }

  dispose() {
    this.#listeners.cleanup();

    for (const nodeKey of this.#fileEntriesByNodeKey.keys()) {
      this.#releaseNodeFileEntry(nodeKey);
    }

    this.#popoverEl = null;
    this.#urlInput = null;
    this.#fileInput = null;
    this.#previouslySelectedKeys.clear();
    this.element = null;
  }

  #releaseNodeFileEntry(nodeKey) {
    const entry = this.#fileEntriesByNodeKey.get(nodeKey);
    if (!entry) {
      return;
    }

    URL.revokeObjectURL(entry.blobUrl);
    this.#fileEntriesByNodeKey.delete(nodeKey);
  }

  #buildPopover() {
    const uid = this.#uid;
    const triggerIcon = parseSvgIcon(COMMAND_ICONS.image);

    // Clone and prepare the icon
    let iconElement = null;
    if (triggerIcon) {
      iconElement = triggerIcon.cloneNode(true);
      iconElement.setAttribute("data-slot", "toolbar-icon");
      iconElement.setAttribute("aria-hidden", "true");
    }

    return (
      <xui-popover
        data-lexis-extension="image"
        label="Insert image"
        placement="bottom-start"
        offset="8"
      >
        <button
          slot="trigger"
          type="button"
          class="lexis-button lexis-button--icon"
          data-lexis-control="image"
          aria-label="Insert image"
          title="Insert image"
        >
          {iconElement ?? "Insert image"}
        </button>

        <div slot="panel" id={`popover-panel-${uid}`}>
          <div data-slot="tabs-root">
            {/* Tab group */}
            <div class="lexis-tab-group" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected="true"
                aria-controls={`lexis-image-upload-${uid}`}
                class="lexis-tab-button"
              >
                Upload File
              </button>
              <button
                type="button"
                role="tab"
                aria-selected="false"
                aria-controls={`lexis-image-url-${uid}`}
                class="lexis-tab-button"
              >
                From URL
              </button>
            </div>

            {/* Upload File Tab Panel */}
            <div
              id={`lexis-image-upload-${uid}`}
              role="tabpanel"
              aria-hidden="false"
            >
              <label>
                Choose file
                <input type="file" name="file" accept="image/*" required />
              </label>

              <label>
                Description
                <input
                  type="text"
                  name="description"
                  placeholder="Description (optional)"
                />
              </label>
            </div>

            {/* From URL Tab Panel */}
            <div
              id={`lexis-image-url-${uid}`}
              role="tabpanel"
              aria-hidden="true"
            >
              <label>
                Image URL
                <input
                  type="url"
                  name="url"
                  placeholder="https://picsum.photos/600/400"
                  required
                />
              </label>

              <label>
                Description
                <input
                  type="text"
                  name="description"
                  placeholder="Description (optional)"
                />
              </label>
            </div>
          </div>

          <div class="lexis-popover-actions">
            <button
              type="button"
              class="lexis-button"
              data-action="insert-image"
            >
              Confirm
            </button>

            {/*
            <button
              type="button"
              class="lexis-button"
              command="hide-popover"
              commandfor={`popover-panel-${uid}`}
              value="cancel"
            >
              Cancel
              </button>
            */}
          </div>
        </div>
      </xui-popover>
    );
  }

  #initializeElements() {
    this.#urlInput = this.element.querySelector("[name='url']");
    this.#fileInput = this.element.querySelector("[name='file']");

    if (!this.#urlInput || !this.#fileInput) {
      throw new Error("ImageExtension requires src and file input elements");
    }

    if (!(this.element instanceof HTMLElement)) {
      throw new Error("ImageExtension requires a valid popover host element");
    }

    this.#popoverEl = this.element.querySelector("[slot='panel']");
  }

  #attachEventListeners() {
    this.#listeners.track(
      registerEventListener(this.#popoverEl, "click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        // Handle tab switching
        const tab = target.closest('[role="tab"]');
        if (tab) {
          event.preventDefault();
          this.#selectTab(tab);
          return;
        }

        // Handle insert image action
        const targetButton = target.closest("[type='button'][data-action]");
        if (targetButton?.getAttribute("data-action") !== "insert-image") {
          return;
        }

        this.#insertImage();
      }),

      // Upload description Enter key
      registerEventListener(this.#popoverEl, "keydown", (evt) => {
        if (evt.key !== "Enter") {
          return;
        }

        const target = evt.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (!this.#activeTabPanel?.contains(target)) {
          return;
        }

        evt.preventDefault();
        this.#insertImage();
      }),

      registerEventListener(this.element, "popover:close", () => {
        this.#urlInput.value = "";
        this.#fileInput.value = "";

        // Reset all description inputs
        this.#popoverEl
          .querySelectorAll('input[name="description"]')
          .forEach((input) => {
            input.value = "";
          });

        // Clear validation errors
        this.#urlInput.setCustomValidity("");
        this.#fileInput.setCustomValidity("");

        // Reset to Upload File tab
        this.#resetToFirstTab();

        requestAnimationFrame(() => {
          this.editor.lexicalEditor.update(() => {
            const rootNode = $getRoot();
            const lastChild = rootNode.getLastChild() ?? rootNode;
            lastChild?.selectEnd();
          });
        });
      }),
    );
  }

  #selectTab(tabElement) {
    const tablist = tabElement.closest('[role="tablist"]');
    const panelId = tabElement.getAttribute("aria-controls");

    if (!tablist || !panelId) {
      return;
    }

    // Update aria-selected on all tabs
    for (const tab of tablist.querySelectorAll('[role="tab"]')) {
      const isSelected = tab === tabElement;
      tab.setAttribute("aria-selected", String(isSelected));
    }

    for (const panel of this.#popoverEl.querySelectorAll('[role="tabpanel"]')) {
      panel.setAttribute("aria-hidden", String(panel.id !== panelId));
    }

    // Focus the first input in the active panel
    const activePanel = this.#popoverEl.querySelector(`#${panelId}`);
    activePanel?.querySelector("input")?.focus();

    this.#updateInsertMode(activePanel?.id);
  }

  #resetToFirstTab() {
    const firstTab = this.#popoverEl.querySelector('[role="tab"]');
    if (firstTab) {
      this.#selectTab(firstTab);
    }
  }

  #updateInsertMode(panelId) {
    this.#insertMode = panelId?.includes("upload")
      ? ImageExtension.INSERT_MODE.UPLOAD
      : ImageExtension.INSERT_MODE.URL;
  }

  get #activeTabPanel() {
    const panelId = this.element
      .querySelector('[role="tab"][aria-selected="true"]')
      ?.getAttribute("aria-controls");

    if (!panelId) {
      return null;
    }

    return this.#popoverEl.querySelector(`#${panelId}`);
  }

  #insertImage() {
    if (this.#insertMode === ImageExtension.INSERT_MODE.URL) {
      this.#insertImageFromUrl();
      return;
    }

    if (this.#insertMode === ImageExtension.INSERT_MODE.UPLOAD) {
      this.#insertImageFromFile();
      return;
    }
  }

  #insertImageFromFile() {
    this.#fileInput.setCustomValidity("");

    const file = this.#fileInput.files[0] || null;
    if (!file || !this.#fileInput.checkValidity()) {
      this.#fileInput.reportValidity();
      return;
    }

    // We're about to insert an image file. Let's notify the consumer
    const event = new CustomEvent("editor:image:insert", {
      bubbles: true,
      cancelable: true,
      detail: { file },
    });
    this.hostElement.dispatchEvent(event);

    if (event.defaultPrevented) {
      // Don't proceed to image insertion if default is `preventDefault` was called and hide the popover
      logger.debug("Image inserted cancelled");
      this.element.hide();
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    this.#insertImageWithData({ url: previewUrl, source: IMAGE_SOURCE.FILE });

    const insertedNodeKey = this.#lastInsertedNode?.getKey() || null;
    if (insertedNodeKey) {
      this.#fileEntriesByNodeKey.set(insertedNodeKey, {
        file,
        blobUrl: previewUrl,
      });
    }

    // Proceed with file upload
    this.hostElement.dispatchEvent(
      new CustomEvent("editor:image:upload", {
        bubbles: true,
        detail: {
          file,
          upload: {
            success: ({ url }) => {
              if (!insertedNodeKey) {
                return;
              }

              this.editor.lexicalEditor.update(() => {
                const node = $getNodeByKey(insertedNodeKey);
                if (!$isImageNode(node)) {
                  return;
                }

                node.setImagePayload({
                  url,
                  source: IMAGE_SOURCE.URL,
                });
                node.setUploadStatus({
                  status: UPLOAD_STATUS.IDLE,
                  progress: 100,
                  error: null,
                });
              });

              this.#releaseNodeFileEntry(insertedNodeKey);
            },
            progress: (progress) => {
              if (!insertedNodeKey) {
                return;
              }

              this.editor.lexicalEditor.update(() => {
                const node = $getNodeByKey(insertedNodeKey);
                if (!$isImageNode(node)) {
                  return;
                }

                node.updateProgress(progress);
              });
            },
            error: ({ _code, message }) => {
              if (!insertedNodeKey) {
                return;
              }

              this.editor.lexicalEditor.update(() => {
                const node = $getNodeByKey(insertedNodeKey);
                if (!$isImageNode(node)) {
                  return;
                }

                node.setUploadStatus({
                  status: UPLOAD_STATUS.ERROR,
                  progress: 0,
                  error: message,
                });
              });
            },
          },
        },
      }),
    );
  }

  #insertImageFromUrl() {
    const url = this.#urlInput.value.trim();
    this.#urlInput.value = url;
    this.#urlInput.setCustomValidity("");

    if (!url || !this.#urlInput.checkValidity()) {
      this.#urlInput.reportValidity();
      return;
    }

    if (!validateUrl(url)) {
      this.#urlInput.setCustomValidity("Invalid image URL format or protocol");
      this.#urlInput.reportValidity();
      logger.debug(`Invalid image URL provided: ${url}`);
      return;
    }

    this.#urlInput.setCustomValidity("");
    this.#insertImageWithData({ url, source: IMAGE_SOURCE.URL });
  }

  #insertImageWithData({ url, source }) {
    const descriptionInput = this.#activeTabPanel.querySelector(
      'input[name="description"]',
    );
    const description = descriptionInput?.value.trim() || "";

    this.editor.runCommand("insert-image", {
      url,
      description,
      source,
    });

    this.element?.hide();
  }

  #selectImageNode(imageNode) {
    const selection = $createNodeSelection();
    selection.add(imageNode.getKey());
    $setSelection(selection);
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

  #syncSelectedStates(lexicalEditor) {
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
