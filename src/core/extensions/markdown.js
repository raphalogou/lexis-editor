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
import { $createImageNode, $isImageNode, ImageNode } from "../nodes/image-node";
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

const IMAGE_IMPORT_REGEX =
  /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"((?:[^"\\]|\\.)*)")?\)/;

const IMAGE = {
  dependencies: [ImageNode],
  export: (node) => {
    if (!$isImageNode(node)) {
      return null;
    }

    const description = escapeMarkdownImageText(node.getDescription());
    const url = node.getUrl();

    return `![${description}](${url} "${description}")`;
  },
  regExp: IMAGE_IMPORT_REGEX,
  replace: (textNode, match) => {
    const [, rawAlt = "", rawUrl = ""] = match;
    if (!rawUrl) {
      return;
    }

    const imageNode = $createImageNode({
      url: rawUrl,
      description: unescapeMarkdownImageText(rawAlt),
    });

    textNode.replace(imageNode);
  },
  trigger: ")",
  type: "text-match",
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
  IMAGE,
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

function escapeMarkdownImageText(value) {
  return value.replace(/([\\"\]])/g, "\\$1");
}

function unescapeMarkdownImageText(value) {
  return value.replace(/\\([\\"\]])/g, "$1");
}
