import { $applyNodeReplacement, TextNode } from "lexical";

/**
 * @typedef {Object} MentionPayload
 * @property {string} id
 * @property {string} label
 * @property {string} [trigger]
 */

/**
 * @typedef {import('lexical').Spread<{
 *  mentionId: string,
 *  label: string,
 *  trigger: string,
 * }, import('lexical').SerializedTextNode>} SerializedMentionNode
 */

/**
 * An inline, atomic reference (e.g. `@Jane`). Implemented as a TextNode in
 * "token" mode rather than a DecoratorNode: Lexical then treats it as one
 * indivisible unit (Backspace removes it whole, the caret can't land inside
 * it) while keeping native caret/arrow-key behavior around it — avoiding the
 * decorator-node selection handling in rich-text.js entirely.
 */
export class MentionNode extends TextNode {
  /** @type {string} */
  __mentionId;

  /** @type {string} */
  __label;

  /** @type {string} */
  __trigger;

  /**
   * @param {MentionPayload} payload
   * @param {import('lexical').NodeKey} [key]
   */
  constructor({ id, label, trigger = "@" }, key) {
    super(`${trigger}${label}`, key);
    this.__mentionId = id;
    this.__label = label;
    this.__trigger = trigger;
  }

  static getType() {
    return "mention";
  }

  /** @param {MentionNode} node */
  static clone(node) {
    return new MentionNode(
      { id: node.__mentionId, label: node.__label, trigger: node.__trigger },
      node.__key,
    );
  }

  /** @param {SerializedMentionNode} serializedNode */
  static importJSON(serializedNode) {
    return $createMentionNode({
      id: serializedNode.mentionId,
      label: serializedNode.label,
      trigger: serializedNode.trigger,
    }).updateFromJSON(serializedNode);
  }

  static importDOM() {
    return {
      a: (domNode) => {
        if (!domNode.hasAttribute("data-mention-id")) {
          return null;
        }

        return {
          conversion: convertMentionElement,
          // Above @lexical/link's `a` conversion (priority 1).
          priority: 2,
        };
      },
      span: (domNode) => {
        if (!domNode.hasAttribute("data-mention-id")) {
          return null;
        }

        return { conversion: convertMentionElement, priority: 2 };
      },
    };
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: "mention",
      version: 1,
      mentionId: this.__mentionId,
      label: this.__label,
      trigger: this.__trigger,
    };
  }

  /** @param {import('lexical').EditorConfig} config */
  createDOM(config) {
    const element = super.createDOM(config);
    element.className = config.theme.mention ?? "mention";
    element.setAttribute("data-mention-id", this.__mentionId);
    element.spellcheck = false;
    return element;
  }

  /**
   * Exported as an `<a>` without `href`: `a` and `data-*` attributes already
   * pass the sanitizer's allowlist (`src/helper/sanitizer.js`), so a mention
   * survives HTML output without loosening it.
   */
  exportDOM() {
    const element = document.createElement("a");
    element.setAttribute("data-mention-id", this.__mentionId);
    element.setAttribute("data-mention-trigger", this.__trigger);
    element.textContent = this.getTextContent();
    return { element };
  }

  getMentionId() {
    return this.getLatest().__mentionId;
  }

  getLabel() {
    return this.getLatest().__label;
  }

  getTrigger() {
    return this.getLatest().__trigger;
  }

  canInsertTextBefore() {
    return false;
  }

  canInsertTextAfter() {
    return false;
  }

  isTextEntity() {
    return true;
  }
}

/** @param {HTMLElement} domNode */
function convertMentionElement(domNode) {
  const trigger = domNode.getAttribute("data-mention-trigger") || "@";
  const text = domNode.textContent ?? "";
  const label = text.startsWith(trigger) ? text.slice(trigger.length) : text;

  return {
    node: $createMentionNode({
      id: domNode.getAttribute("data-mention-id"),
      label,
      trigger,
    }),
  };
}

/**
 * @param {MentionPayload} payload
 * @returns {MentionNode}
 */
export function $createMentionNode(payload) {
  const node = new MentionNode(payload);
  node.setMode("token").toggleDirectionless();
  return $applyNodeReplacement(node);
}

/**
 * @param {import('lexical').LexicalNode | null | undefined} node
 * @returns {node is MentionNode}
 */
export function $isMentionNode(node) {
  return node instanceof MentionNode;
}
