import "./style.css";

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
