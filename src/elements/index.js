import { LexisEditorElement } from "./editor";
import { PopoverElement } from "./popover";
import { ProgressElement } from "./progress";
import { LexisToolbarElement } from "./toolbar";

export { LexisEditorElement } from "./editor";
export { PopoverElement } from "./popover";
export { ProgressElement } from "./progress";
export { LexisToolbarElement } from "./toolbar";

export function defineElements() {
  const elements = {
    "xui-progress": ProgressElement,
    "xui-popover": PopoverElement,
    "lexis-toolbar": LexisToolbarElement,
    "lexis-editor": LexisEditorElement,
  };

  for (const [name, element] of Object.entries(elements)) {
    customElements.define(name, element);
  }
}
