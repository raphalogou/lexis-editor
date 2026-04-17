import { $generateNodesFromDOM } from "@lexical/html";
import DOMPurify from "dompurify";
import {
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_NORMAL,
  defineExtension,
  PASTE_COMMAND,
  PASTE_TAG,
} from "lexical";
import { marked } from "marked";
import { LexisExtension } from "./extension";

export class ClipboardExtension extends LexisExtension {
  name = "clipboard";

  get lexicalExtension() {
    return defineExtension({
      name: "lexis/clipboard",
      register: (lexicalEditor) => {
        return lexicalEditor.registerCommand(
          PASTE_COMMAND,
          this.#handlePaste,
          COMMAND_PRIORITY_NORMAL,
        );
      },
    });
  }

  /** @param {ClipboardEvent} evt  */
  #handlePaste = (evt) => {
    if (
      evt.clipboardData.types.some((type) =>
        ["Files", "text/html"].includes(type),
      )
    ) {
      return false;
    }

    evt.preventDefault();
    const lexicalEditor = this.editor.lexicalEditor;

    const pastedText = evt.clipboardData.getData("text");
    lexicalEditor.update(
      () => {
        const parsed = DOMPurify.sanitize(marked.parse(pastedText));
        const dom = new DOMParser().parseFromString(parsed, "text/html");

        const lexicalNodes = $generateNodesFromDOM(lexicalEditor, dom);

        ($getSelection() ?? $getRoot().selectEnd()).insertNodes(lexicalNodes);
      },
      { tag: PASTE_TAG },
    );

    return true;
  };
}
