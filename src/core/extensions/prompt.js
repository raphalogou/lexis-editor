import {
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  defineExtension,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  mergeRegister,
} from "lexical";
import { createElement } from "../../helper/html";
import { ListenerRegistry, registerEventListener } from "../../helper/listener";
import { logger } from "../logger";
import { LexisExtension } from "./extension";

/**
 * @typedef {Object} PromptItem
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 */

/**
 * @typedef {Object} PromptMatch
 * @property {string} nodeKey Text node holding the trigger + query.
 * @property {number} startOffset Offset of the trigger character.
 * @property {number} endOffset Offset of the caret (end of the query).
 * @property {string} query Text typed after the trigger.
 */

let menuIdCounter = 0;

/**
 * Base class for "type a trigger character, pick from an inline menu"
 * features (mentions, hashtags, slash commands, emoji…).
 *
 * Subclasses provide:
 * - `name` and `trigger`
 * - `search(query, { signal })` → the items to show
 * - `$createNode(item)` → the Lexical node that replaces `<trigger><query>`
 * - optionally `nodes`, `markdownTransformers` and `renderItem(item)`
 */
export class PromptExtension extends LexisExtension {
  /** Character that opens the menu. */
  trigger = "@";

  /** Longest query (characters after the trigger) still considered a match. */
  maxQueryLength = 32;

  /** Most items shown at once. */
  maxItems = 8;

  /** @type {PromptMatch|null} */
  #match = null;

  /** @type {PromptItem[]} */
  #items = [];

  #activeIndex = 0;

  /** @type {AbortController|null} */
  #searchController = null;

  /**
   * Match the user pressed Escape on. Kept so the menu doesn't immediately
   * reopen while they keep typing in that same `@query`.
   * @type {string|null}
   */
  #dismissedMatchId = null;

  /** @type {HTMLElement|null} */
  #menu = null;

  #menuId = `lexis-prompt-${++menuIdCounter}`;

  /** @type {import('../../helper/listener').ListenerRegistry} */
  #listeners = new ListenerRegistry();

  /**
   * Lexical node classes this prompt inserts.
   * @returns {Array<import('lexical').Klass<import('lexical').LexicalNode>>}
   */
  get nodes() {
    return [];
  }

  /**
   * @param {string} _query
   * @param {{ signal: AbortSignal }} _options
   * @returns {Promise<PromptItem[]> | PromptItem[]}
   */
  search(_query, _options) {
    throw new Error(`${this.constructor.name} must implement search()`);
  }

  /**
   * Called inside a Lexical update.
   * @param {PromptItem} _item
   * @returns {import('lexical').LexicalNode}
   */
  $createNode(_item) {
    throw new Error(`${this.constructor.name} must implement $createNode()`);
  }

  /**
   * Content of one menu option. Override to customize.
   * @param {PromptItem} item
   * @returns {Array<Node|string>}
   */
  renderItem(item) {
    return [
      createElement("span", {
        "data-slot": "prompt-option-label",
        children: [item.label],
      }),
      item.description
        ? createElement("span", {
            "data-slot": "prompt-option-description",
            children: [item.description],
          })
        : null,
    ];
  }

  get isOpen() {
    return this.#match !== null && this.#items.length > 0;
  }

  get lexicalExtension() {
    return defineExtension({
      name: `lexis/prompt/${this.name}`,
      nodes: this.nodes,
      register: (lexicalEditor) => {
        const whenOpen = (handler) => (event) => {
          if (!this.isOpen) {
            return false;
          }

          event?.preventDefault();
          event?.stopImmediatePropagation();
          handler();
          return true;
        };

        // CRITICAL so these win over rich-text.js's decorator navigation
        // (HIGH) and the table/code-block arrow handlers while the menu is
        // open; each one is a no-op (returns false) otherwise.
        return mergeRegister(
          lexicalEditor.registerUpdateListener(({ tags }) => {
            if (tags.has("collaboration")) {
              return;
            }

            lexicalEditor.read(() => this.#sync(lexicalEditor));
          }),
          lexicalEditor.registerCommand(
            KEY_ARROW_DOWN_COMMAND,
            whenOpen(() => this.#moveActive(1)),
            COMMAND_PRIORITY_CRITICAL,
          ),
          lexicalEditor.registerCommand(
            KEY_ARROW_UP_COMMAND,
            whenOpen(() => this.#moveActive(-1)),
            COMMAND_PRIORITY_CRITICAL,
          ),
          // Key commands already run inside a Lexical update, so the insert
          // is applied directly rather than via a nested update().
          lexicalEditor.registerCommand(
            KEY_ENTER_COMMAND,
            whenOpen(() => this.#$selectItem(this.#items[this.#activeIndex])),
            COMMAND_PRIORITY_CRITICAL,
          ),
          lexicalEditor.registerCommand(
            KEY_TAB_COMMAND,
            whenOpen(() => this.#$selectItem(this.#items[this.#activeIndex])),
            COMMAND_PRIORITY_CRITICAL,
          ),
          lexicalEditor.registerCommand(
            KEY_ESCAPE_COMMAND,
            whenOpen(() => {
              this.#dismissedMatchId = matchId(this.#match);
              this.#close();
            }),
            COMMAND_PRIORITY_CRITICAL,
          ),
          lexicalEditor.registerCommand(
            BLUR_COMMAND,
            () => {
              this.#close();
              return false;
            },
            COMMAND_PRIORITY_CRITICAL,
          ),
          () => this.#destroyMenu(),
        );
      },
    });
  }

  dispose() {
    this.#close();
    this.#destroyMenu();
    this.#listeners.cleanup();
  }

  /**
   * Reads the text right before a collapsed caret and decides whether it's
   * `<trigger><query>`. Must run inside a Lexical read/update.
   * @returns {PromptMatch|null}
   */
  $getMatch() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const node = selection.anchor.getNode();
    // isSimpleText() excludes token nodes (e.g. existing mentions) and
    // code-highlight nodes, so prompts never open inside code blocks.
    if (!$isTextNode(node) || !node.isSimpleText()) {
      return null;
    }

    const offset = selection.anchor.offset;
    const textBefore = node.getTextContent().slice(0, offset);
    const triggerIndex = textBefore.lastIndexOf(this.trigger);
    if (triggerIndex === -1) {
      return null;
    }

    const query = textBefore.slice(triggerIndex + this.trigger.length);
    if (query.length > this.maxQueryLength || /\s/.test(query)) {
      return null;
    }

    // Only at a word boundary: `me@example.com` shouldn't open the menu.
    const charBefore = textBefore[triggerIndex - 1];
    if (charBefore !== undefined && !/[\s(]/.test(charBefore)) {
      return null;
    }

    return {
      nodeKey: node.getKey(),
      startOffset: triggerIndex,
      endOffset: offset,
      query,
    };
  }

  /** @param {import('lexical').LexicalEditor} lexicalEditor */
  #sync(lexicalEditor) {
    const match = lexicalEditor.isEditable() ? this.$getMatch() : null;

    if (!match || matchId(match) === this.#dismissedMatchId) {
      if (!match) {
        this.#dismissedMatchId = null;
      }
      this.#close();
      return;
    }

    const needsSearch =
      matchId(match) !== matchId(this.#match) ||
      match.query !== this.#match?.query;
    this.#match = match;

    if (needsSearch) {
      this.#runSearch(match.query);
    } else {
      this.#position(lexicalEditor);
    }
  }

  /** @param {string} query */
  async #runSearch(query) {
    this.#searchController?.abort();
    const controller = new AbortController();
    this.#searchController = controller;

    let items;
    try {
      items = await this.search(query, { signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) {
        logger.error(`Prompt "${this.name}" search failed`, error);
        this.#close();
      }
      return;
    }

    // A newer keystroke (or close) superseded this search.
    if (controller.signal.aborted || this.#match?.query !== query) {
      return;
    }

    this.#items = Array.isArray(items) ? items.slice(0, this.maxItems) : [];
    this.#activeIndex = 0;
    this.#render();
  }

  /**
   * Replaces `<trigger><query>` with the subclass's node, followed by a
   * space so the user can keep typing. Must run inside a Lexical update.
   * @param {PromptItem|undefined} item
   */
  #$selectItem(item) {
    // Re-read the match: the text may have changed while search() was
    // pending, so offsets captured earlier can't be trusted.
    const match = this.$getMatch();
    this.#close();

    if (!item || !match) {
      return;
    }

    const textNode = $getNodeByKey(match.nodeKey);
    if (!$isTextNode(textNode)) {
      return;
    }

    const parts = textNode.splitText(match.startOffset, match.endOffset);
    const target = match.startOffset === 0 ? parts[0] : parts[1];
    const node = this.$createNode(item);
    target.replace(node);

    const next = node.getNextSibling();
    if ($isTextNode(next) && next.getTextContent().startsWith(" ")) {
      next.select(1, 1);
    } else {
      const space = $createTextNode(" ");
      node.insertAfter(space);
      space.select(1, 1);
    }
  }

  /** @param {number} delta */
  #moveActive(delta) {
    const count = this.#items.length;
    this.#activeIndex = (this.#activeIndex + delta + count) % count;
    this.#updateActiveOption();
  }

  #close() {
    this.#searchController?.abort();
    this.#searchController = null;
    this.#match = null;
    this.#items = [];
    this.#activeIndex = 0;
    this.#hideMenu();
  }

  #ensureMenu() {
    if (this.#menu) {
      return this.#menu;
    }

    this.#menu = createElement("div", {
      id: this.#menuId,
      role: "listbox",
      popover: "manual",
      class: "lexis-prompt-menu",
      "data-slot": "prompt-menu",
      "data-lexis-extension": this.name,
    });

    // mousedown, not click: preventDefault keeps focus (and the caret) in
    // the editor, so the selection is still where the query was typed.
    this.#listeners.track(
      registerEventListener(this.#menu, "mousedown", (event) => {
        const option = event.target.closest?.("[role='option']");
        if (!option) {
          return;
        }

        event.preventDefault();
        const item = this.#items[Number(option.dataset.index)];
        this.editor.lexicalEditor.update(() => this.#$selectItem(item));
      }),
    );

    (this.hostElement ?? document.body).append(this.#menu);
    return this.#menu;
  }

  #render() {
    const lexicalEditor = this.editor.lexicalEditor;

    if (!this.isOpen) {
      this.#hideMenu();
      return;
    }

    const menu = this.#ensureMenu();
    menu.replaceChildren(
      ...this.#items.map((item, index) =>
        createElement("div", {
          id: `${this.#menuId}-${index}`,
          role: "option",
          "data-slot": "prompt-option",
          "data-index": String(index),
          children: this.renderItem(item),
        }),
      ),
    );

    this.#updateActiveOption();

    if (!menu.matches(":popover-open")) {
      menu.showPopover?.();
    }

    lexicalEditor.read(() => this.#position(lexicalEditor));

    const root = lexicalEditor.getRootElement();
    root?.setAttribute("aria-controls", this.#menuId);
    root?.setAttribute("aria-expanded", "true");
  }

  #updateActiveOption() {
    if (!this.#menu) {
      return;
    }

    for (const option of this.#menu.children) {
      const active = Number(option.dataset.index) === this.#activeIndex;
      option.setAttribute("aria-selected", String(active));
      if (active) {
        option.scrollIntoView({ block: "nearest" });
      }
    }

    this.editor.lexicalEditor
      .getRootElement()
      ?.setAttribute(
        "aria-activedescendant",
        `${this.#menuId}-${this.#activeIndex}`,
      );
  }

  /**
   * Anchors the menu under the trigger character (not the caret), so it
   * stays put while the query is typed.
   * @param {import('lexical').LexicalEditor} lexicalEditor
   */
  #position(lexicalEditor) {
    if (!this.#menu || !this.isOpen) {
      return;
    }

    const element = lexicalEditor.getElementByKey(this.#match.nodeKey);
    const textNode = element?.firstChild;
    if (!(textNode instanceof Text)) {
      return;
    }

    const range = document.createRange();
    const start = Math.min(this.#match.startOffset, textNode.length);
    range.setStart(textNode, start);
    range.setEnd(textNode, Math.min(start + 1, textNode.length));
    const rect = range.getBoundingClientRect();

    this.#menu.style.left = `${rect.left}px`;
    this.#menu.style.top = `${rect.bottom + 4}px`;
  }

  #hideMenu() {
    if (this.#menu?.matches(":popover-open")) {
      this.#menu.hidePopover();
    }

    const root = this.editor.lexicalEditor?.getRootElement();
    root?.removeAttribute("aria-controls");
    root?.removeAttribute("aria-activedescendant");
    root?.removeAttribute("aria-expanded");
  }

  #destroyMenu() {
    this.#menu?.remove();
    this.#menu = null;
  }
}

/** @param {PromptMatch|null} match */
function matchId(match) {
  return match ? `${match.nodeKey}:${match.startOffset}` : null;
}
