import "./style.css";

import { logger } from "./core/logger";
import {
  LexisEditorElement,
  LexisToolbarElement,
  PopoverElement,
  ProgressElement,
} from "./elements";

setTimeout(() => {
  customElements.define("ui-progress", ProgressElement);
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

document.addEventListener("editor:image:insert", (event) => {
  logger.debug("Insert image", event.detail);
  // event.preventDefault();
});

document.addEventListener("editor:image:upload", (event) => {
  logger.debug("Upload image", event.detail);

  const { file, upload } = event.detail;

  console.log(file, upload);

  let progress = 0;
  const interval = setInterval(() => {
    progress += 10;
    upload.progress(progress);

    if (progress === 100) {
      clearInterval(interval);
      upload.success({ url: URL.createObjectURL(file) });
    }
  }, 1000);
});
