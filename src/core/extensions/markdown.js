import {
  BOLD_STAR,
  HEADING,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  registerMarkdownShortcuts,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from "@lexical/markdown";
import { defineExtension } from "lexical";
import { LexisExtension } from "./extension";

export const MARKDOWN_TRANSFORMERS = [
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  LINK,
];

export class MarkdownExtension extends LexisExtension {
  get name() {
    return "markdown";
  }

  get enabled() {
    return this.editor.supportsMarkdown;
  }

  /**
   * @returns {import('lexical').LexicalExtension}
   */
  get lexicalExtension() {
    return defineExtension({
      name: "lexis/markdown",
      register: (lexicalEditor) => {
        return registerMarkdownShortcuts(lexicalEditor, MARKDOWN_TRANSFORMERS);
      },
    });
  }
}
