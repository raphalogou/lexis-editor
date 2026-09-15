// Type declarations for `@void/lexis-editor/core` (the "./core" export).
//
// This entry point registers the same custom elements as "." (see
// src/core.js) but only re-exports the low-level listener helpers as JS —
// no extensions, nodes, or sanitizer functions. Use "." instead if you need
// those. See index.d.ts for the full `LexisEditorElement`/`Editor` shapes,
// imported here as types only so the tag-name map stays accurate without
// duplicating them.

import type { LexisEditorElement, LexisToolbarElement } from "./index";

export function registerEventListener(
  element: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): () => void;

export class ListenerRegistry {
  track(...listeners: Array<(() => void) | undefined>): void;
  cleanup(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "lexis-editor": LexisEditorElement;
    "lexis-toolbar": LexisToolbarElement;
  }
}
