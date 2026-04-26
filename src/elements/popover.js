import { createElement } from "../helper/html";
import { ListenerRegistry, registerEventListener } from "../helper/listener";
import { createShortId } from "../helper/utils";

const DEFAULT_LABEL = "Open popover";
const DEFAULT_PLACEMENT = "bottom-end";
const DEFAULT_OFFSET = 8;

export class PopoverElement extends HTMLElement {
  static observedAttributes = ["label", "placement", "offset", "open"];

  #listeners = new ListenerRegistry();

  #popoverId = `xui-popover-panel-${createShortId()}`;

  #anchorName = `--xui-popover-anchor-${createShortId()}`;

  /** @type {HTMLElement | null} */
  #trigger = null;

  /** @type {HTMLElement | null} */
  #panel = null;

  connectedCallback() {
    this.dataset.slot = this.dataset.slot || "popover-root";

    this.#setupStructure();
    this.#setupSemantics();
    this.#setupListeners();
    this.#syncOpenState();
    this.#reflectState();
  }

  disconnectedCallback() {
    this.#listeners.cleanup();
  }

  attributeChangedCallback(name) {
    if (!this.#trigger || !this.#panel) {
      return;
    }

    if (name === "label") {
      this.#applyLabel();
      return;
    }

    if (name === "placement") {
      this.#applyPlacement();
      return;
    }

    if (name === "offset") {
      this.#applyPlacement();
      return;
    }

    if (name === "open") {
      this.#syncOpenState();
    }
  }

  show() {
    this.#panel?.showPopover();
  }

  hide() {
    this.#panel?.hidePopover();
  }

  toggle() {
    if (!this.#panel) return;

    if (this.#panel.matches(":popover-open")) {
      this.#panel.hidePopover();
      return;
    }

    this.#panel.showPopover();
  }

  #setupStructure() {
    this.#trigger = this.#resolveTrigger();
    this.#panel = this.#resolvePanel();
  }

  #setupSemantics() {
    if (!this.#trigger || !this.#panel) {
      return;
    }

    this.#trigger.dataset.slot =
      this.#trigger.dataset.slot || "popover-trigger";
    this.#panel.dataset.slot = this.#panel.dataset.slot || "popover-panel";

    this.#panel.id = this.#panel.id || this.#popoverId;
    this.#panel.setAttribute("popover", "auto");
    this.#panel.setAttribute("role", "dialog");
    this.#panel.setAttribute("aria-modal", "false");

    this.#trigger.setAttribute("commandfor", this.#panel.id);
    this.#trigger.setAttribute("command", "toggle-popover");
    this.#trigger.setAttribute("aria-haspopup", "dialog");
    this.#trigger.setAttribute("aria-controls", this.#panel.id);

    this.style.setProperty("--popover-anchor-name", this.#anchorName);
    this.style.setProperty("--popover-offset", `${this.offset}px`);

    this.#trigger.style.anchorName = this.#anchorName;

    this.#applyLabel();
  }

  #setupListeners() {
    if (!this.#trigger || !this.#panel) {
      return;
    }

    this.#listeners.cleanup();
    this.#listeners.track(
      registerEventListener(this.#panel, "toggle", () => {
        this.#reflectState();
        this.dispatchEvent(
          new CustomEvent(this.open ? "popover:open" : "popover:close", {
            bubbles: true,
            detail: {
              panel: this.#panel,
              trigger: this.#trigger,
            },
          }),
        );
      }),
    );
  }

  #resolveTrigger() {
    const existingTrigger = this.querySelector(':scope > [slot="trigger"]');
    if (existingTrigger instanceof HTMLElement) {
      return existingTrigger;
    }

    const triggerButton = createElement("button", {
      type: "button",
      slot: "trigger",
      class: "lexis-popover-trigger",
      children: [this.label],
    });
    triggerButton.dataset.generated = "true";

    this.prepend(triggerButton);
    return triggerButton;
  }

  #resolvePanel() {
    const existingPanel = this.querySelector(':scope > [slot="panel"]');
    if (existingPanel instanceof HTMLElement) {
      return existingPanel;
    }

    const panel = createElement("div", {
      slot: "panel",
      class: "lexis-popover-panel",
    });
    panel.dataset.generated = "true";

    const children = Array.from(this.childNodes).filter((node) => {
      return !(
        node instanceof HTMLElement && node.getAttribute("slot") === "trigger"
      );
    });

    for (const child of children) {
      panel.append(child);
    }

    this.append(panel);
    return panel;
  }

  #applyLabel() {
    if (!this.#trigger) {
      return;
    }

    if (this.#trigger.dataset.generated === "true") {
      this.#trigger.replaceChildren(this.label);
    }

    if (!this.#trigger.getAttribute("aria-label")) {
      this.#trigger.setAttribute("aria-label", this.label);
    }

    if (!this.#panel) {
      return;
    }

    if (!this.#panel.getAttribute("aria-label")) {
      this.#panel.setAttribute("aria-label", this.label);
    }
  }

  #applyPlacement() {
    if (!this.#panel) {
      return;
    }

    this.#panel.dataset.placement = this.getAttribute("placement");
  }

  #syncOpenState() {
    if (!this.#panel) {
      return;
    }

    if (this.open && !this.#panel.matches(":popover-open")) {
      this.#panel.showPopover();
      return;
    }

    if (!this.open && this.#panel.matches(":popover-open")) {
      this.#panel.hidePopover();
    }
  }

  #reflectState() {
    if (!this.#panel || !this.#trigger) {
      return;
    }

    const isOpen = this.#panel.matches(":popover-open");
    this.toggleAttribute("open", isOpen);
    this.#trigger.setAttribute("aria-expanded", String(isOpen));
  }

  get label() {
    return this.getAttribute("label")?.trim() || DEFAULT_LABEL;
  }

  get placement() {
    return this.getAttribute("placement")?.trim() || DEFAULT_PLACEMENT;
  }

  get open() {
    return this.hasAttribute("open");
  }

  get offset() {
    const value = Number.parseFloat(this.getAttribute("offset") || "");
    if (!Number.isFinite(value)) {
      return DEFAULT_OFFSET;
    }

    return Math.max(0, value);
  }
}
