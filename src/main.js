import "./style.css";

import { logger } from "./core/logger";
import {
  LexisEditorElement,
  LexisToolbarElement,
  PopoverElement,
} from "./elements";

setTimeout(() => {
  customElements.define("el-popover", PopoverElement);
  customElements.define("lexis-toolbar", LexisToolbarElement);
  customElements.define("lexis-editor", LexisEditorElement);
}, 0);

document
  .querySelector("lexis-editor")
  ?.addEventListener("editor:initialize", (event) => {
    event.detail.configure({
      markdown: true,
      extensionMode: "append",
      lexical: {
        theme: {
          text: {
            underline: "underline text-underline",
          },
        },
      },
    });
  });

document.addEventListener("editor:ready", (event) => {
  logger.debug("Editor ready", event.detail);
});
