import "./style.css";

import { ControllerRegistry, LinkController } from "./core/controllers";
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

ControllerRegistry.register("link", LinkController);
