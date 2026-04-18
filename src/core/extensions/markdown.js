import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from "@lexical/extension";
import {
  BOLD_STAR,
  CODE,
  HEADING,
  INLINE_CODE,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  registerMarkdownShortcuts,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from "@lexical/markdown";
import { $createParagraphNode, defineExtension } from "lexical";
import { LexisExtension } from "./extension";

const DIVIDER_REGEX = /^(?:---|\*\*\*|___)\s?$/;

const DIVIDER = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    if (!$isHorizontalRuleNode(node)) {
      return null;
    }

    return "---";
  },
  regExp: DIVIDER_REGEX,
  replace: (parentNode, _children, _match, isImport) => {
    const divider = $createHorizontalRuleNode();
    parentNode.replace(divider);

    if (isImport) {
      return;
    }

    const paragraph = $createParagraphNode();
    divider.insertAfter(paragraph);
    paragraph.selectStart();
  },
  type: "element",
};

export const MARKDOWN_TRANSFORMERS = [
  HEADING,
  QUOTE,
  DIVIDER,
  CODE,
  INLINE_CODE,
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
