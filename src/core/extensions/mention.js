import {
  $createMentionNode,
  $isMentionNode,
  MentionNode,
} from "../nodes/mention-node";
import { PromptExtension } from "./prompt";

// `@[Jane Doe](user-42)` — the leading trigger keeps it from being read as
// a plain link by the built-in LINK transformer.
const MENTION_IMPORT_REGEX = /@\[((?:[^\]\\]|\\.)+)\]\(([^\s()]+)\)/;

/**
 * `@`-mentions. Items come from the host page through the
 * `editor:mention:search` event (bubbling, dispatched on `<lexis-editor>`):
 *
 * ```js
 * editor.addEventListener("editor:mention:search", (event) => {
 *   const { query, signal, respond } = event.detail;
 *   fetch(`/users?q=${query}`, { signal })
 *     .then((r) => r.json())
 *     .then((users) => respond(users.map((u) => ({ id: u.id, label: u.name }))));
 * });
 * ```
 *
 * Or subclass and override `search(query, { signal })` directly.
 */
export class MentionExtension extends PromptExtension {
  name = "mention";

  trigger = "@";

  get nodes() {
    return [MentionNode];
  }

  /**
   * @param {string} query
   * @param {{ signal: AbortSignal }} options
   * @returns {Promise<import('./prompt').PromptItem[]>}
   */
  search(query, { signal }) {
    const host = this.hostElement;
    if (!host) {
      return Promise.resolve([]);
    }

    return new Promise((resolve) => {
      host.dispatchEvent(
        new CustomEvent("editor:mention:search", {
          bubbles: true,
          detail: {
            query,
            trigger: this.trigger,
            signal,
            respond: (items) => resolve(sanitizeItems(items)),
          },
        }),
      );
    });
  }

  /** @param {import('./prompt').PromptItem} item */
  $createNode(item) {
    return $createMentionNode({
      id: item.id,
      label: item.label,
      trigger: this.trigger,
    });
  }

  get markdownTransformers() {
    return [
      {
        dependencies: [MentionNode],
        export: (node) => {
          if (!$isMentionNode(node)) {
            return null;
          }

          return `${node.getTrigger()}[${escapeLabel(node.getLabel())}](${node.getMentionId()})`;
        },
        importRegExp: MENTION_IMPORT_REGEX,
        regExp: new RegExp(`${MENTION_IMPORT_REGEX.source}$`),
        replace: (textNode, match) => {
          const [, label, id] = match;
          textNode.replace(
            $createMentionNode({
              id,
              label: unescapeLabel(label),
              trigger: this.trigger,
            }),
          );
        },
        trigger: ")",
        type: "text-match",
      },
    ];
  }
}

/**
 * Items come from host-page code: keep only well-formed ones, and ids that
 * can round-trip through the markdown syntax above.
 * @param {unknown} items
 * @returns {import('./prompt').PromptItem[]}
 */
function sanitizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item) =>
        item &&
        typeof item.label === "string" &&
        item.label.trim() !== "" &&
        (typeof item.id === "string" || typeof item.id === "number"),
    )
    .map((item) => ({
      id: String(item.id),
      label: item.label.trim(),
      description:
        typeof item.description === "string" ? item.description : undefined,
    }))
    .filter((item) => /^[^\s()]+$/.test(item.id));
}

function escapeLabel(value) {
  return value.replace(/([\\\]])/g, "\\$1");
}

function unescapeLabel(value) {
  return value.replace(/\\([\\\]])/g, "$1");
}
