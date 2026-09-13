import { Editor as BaseEditor, resolveConfiguration } from "../core/editor";

import {
  ClipboardExtension,
  CodeBlockExtension,
  ImageExtension,
  LinkExtension,
  MarkdownExtension,
  RichTextExtension,
  TableExtension,
} from "../core/extensions";

export const defaultToolbarConfig = {
  template:
    "bold italic underline code | format | link image | number-list bullet-list code-block insert-table divider ~ undo redo",
  groups: {
    format: ["paragraph", "heading-2", "heading-3", "heading-4", "quote"],
  },
};

export class Editor extends BaseEditor {
  constructor(rootEl, config = {}) {
    const defaultConfig = {
      markdown: true,
      extensions: [
        RichTextExtension,
        LinkExtension,
        ImageExtension,
        ClipboardExtension,
        CodeBlockExtension,
        TableExtension,
        MarkdownExtension,
      ],
      toolbar: defaultToolbarConfig,
    };

    super(rootEl, resolveConfiguration(defaultConfig, config));
  }
}
