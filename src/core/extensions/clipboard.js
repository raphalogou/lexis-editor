import { $generateNodesFromDOM } from "@lexical/html";
import {
  $getRoot,
  $getSelection,
  COMMAND_PRIORITY_NORMAL,
  defineExtension,
  PASTE_COMMAND,
  PASTE_TAG,
} from "lexical";
import { marked } from "marked";
import { sanitizeHtml } from "../../helper/sanitizer";
import { logger } from "../logger";
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

    try {
      const pastedText = evt.clipboardData.getData("text");
      lexicalEditor.update(
        () => {
          try {
            const htmlText = marked.parse(pastedText);
            const sanitized = sanitizeHtml(htmlText);
            const htmlDocument = new DOMParser().parseFromString(
              sanitized,
              "text/html",
            );

            const lexicalNodes = $generateNodesFromDOM(
              lexicalEditor,
              htmlDocument,
            );

            ($getSelection() ?? $getRoot().selectEnd()).insertNodes(
              lexicalNodes,
            );
          } catch (error) {
            logger.debug("Error processing pasted content:", error);
          }
        },
        { tag: PASTE_TAG },
      );
    } catch (error) {
      logger.debug("Error handling paste event:", error);
    }

    return true;
  };
}
