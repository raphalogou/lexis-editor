import { Editor as BaseEditor, resolveConfiguration } from "../core/editor";

export class Editor extends BaseEditor {
  constructor(rootEl, config = {}) {
    const defaultConfig = {
      markdown: false,
      toolbar: {
        template: "bold italic underline | link ~ undo redo",
        groups: {},
      },
    };

    super(rootEl, resolveConfiguration(defaultConfig, config));
  }
}
