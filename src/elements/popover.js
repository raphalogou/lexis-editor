import { createElement } from "../helper/jsx-runtime";
import { ListenerRegistry, registerEventListener } from "../helper/listener";

const DEFAULT_LABEL = "Open popover";
const DEFAULT_PLACEMENT = "bottom-end";
const DEFAULT_OFFSET = 8;
const VALID_SIDES = new Set(["top", "right", "bottom", "left"]);
const VALID_ALIGNMENTS = new Set(["start", "center", "end"]);

export class PopoverElement extends HTMLElement {
  static observedAttributes = ["label", "placement", "offset", "open"];

  #listeners = new ListenerRegistry();

  #popoverId = `el-popover-panel-${createShortId()}`;

  #anchorName = `--el-popover-anchor-${createShortId()}`;

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

    this.#trigger.style.anchorName = this.#anchorName;

    this.#panel.style.position = "absolute";
    this.#panel.style.positionAnchor = this.#anchorName;

    this.#applyLabel();
    this.#applyPlacement();
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

    const { side, align } = parsePlacement(this.placement.toLowerCase());
    const style = placementToStyle(side, align, this.offset);

    this.#panel.dataset.placement = `${side}-${align}`;
    this.#panel.style.top = style.top;
    this.#panel.style.bottom = style.bottom;
    this.#panel.style.left = style.left;
    this.#panel.style.right = style.right;
    this.#panel.style.transform = style.transform;
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

function parsePlacement(placement) {
  const [rawSide = "bottom", rawAlign = "center"] = placement.split("-");
  const side = VALID_SIDES.has(rawSide) ? rawSide : "bottom";
  const align = VALID_ALIGNMENTS.has(rawAlign) ? rawAlign : "center";

  return {
    side,
    align,
  };
}

function placementToStyle(side, align, offset) {
  const offsetPx = `${offset}px`;
  const style = {
    top: "auto",
    bottom: "auto",
    left: "auto",
    right: "auto",
    transform: "none",
  };

  if (side === "top") {
    style.bottom = `calc(anchor(top) + ${offsetPx})`;
  } else if (side === "left") {
    style.right = `calc(anchor(left) + ${offsetPx})`;
  } else if (side === "right") {
    style.left = `calc(anchor(right) + ${offsetPx})`;
  } else {
    style.top = `calc(anchor(bottom) + ${offsetPx})`;
  }

  if (side === "left" || side === "right") {
    if (align === "start") {
      style.top = "anchor(top)";
    } else if (align === "end") {
      style.bottom = "anchor(bottom)";
    } else {
      style.top = "anchor(center)";
      style.transform = "translateY(-50%)";
    }

    return style;
  }

  if (align === "start") {
    style.left = "anchor(left)";
  } else if (align === "end") {
    style.right = "anchor(right)";
  } else {
    style.left = "anchor(center)";
    style.transform = "translateX(-50%)";
  }

  return style;
}

function createShortId(length = 8) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}
