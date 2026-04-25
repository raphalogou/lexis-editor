const SVG_NS = "http://www.w3.org/2000/svg";

export class ProgressElement extends HTMLElement {
  static observedAttributes = ["value", "size", "stroke-width"];

  /** @type {SVGSVGElement|null} */
  #svg = null;

  /** @type {SVGCircleElement|null} */
  #track = null;

  /** @type {SVGCircleElement|null} */
  #progress = null;

  /** @type {HTMLDivElement|null} */
  #label = null;

  /** @type {HTMLDivElement|null} */
  #root = null;

  /** @type {number} */
  #circumference = 0;

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });

    this.setAttribute("role", "progressbar");
    this.setAttribute("aria-valuemin", "0");
    this.setAttribute("aria-valuemax", "100");
    this.setAttribute("aria-valuenow", "0");

    const stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(`
      :host {
        display: inline-block;
        width: var(--size, 80px);
        height: var(--size, 80px);
      }
      
      div {
        display: grid;
        width: 100%;
        height: 100%;
      }
      
      svg, .label {
        grid-area: 1 / 1;
      }
      
      svg {
        transform: rotate(-90deg);
      }
      
      .label {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--label-size, 0.22em);
        font-weight: 600;
        letter-spacing: -0.02em;
        color: var(--accent-color, white);
        font-family: var(--font-family, monospace);
      }
      
      circle.progress {
        transition: stroke-dashoffset 0.3s ease;
        stroke: var(--accent-color, white);
      }
      
      circle.track {
        stroke: var(--track-color, rgba(255, 255, 255, 0.15));
      }
    `);
    shadow.adoptedStyleSheets = [stylesheet];

    this.#root = document.createElement("div");

    this.#svg = document.createElementNS(SVG_NS, "svg");

    this.#track = document.createElementNS(SVG_NS, "circle");
    this.#track.setAttribute("fill", "none");

    this.#progress = document.createElementNS(SVG_NS, "circle");
    this.#progress.setAttribute("fill", "none");
    this.#progress.setAttribute("stroke-linecap", "round");

    this.#label = document.createElement("div");
    this.#label.setAttribute("aria-hidden", "true");

    this.#svg.append(this.#track, this.#progress);
    this.#root.append(this.#svg, this.#label);
    shadow.append(this.#root);

    this.#applyGeometry();
    this.#applyValue();
  }

  attributeChangedCallback(name) {
    if (!this.#svg) return;

    if (name === "value") {
      this.#applyValue();
    } else {
      this.#applyGeometry();
      this.#applyValue();
    }
  }

  get value() {
    const val = parseFloat(this.getAttribute("value") ?? 0);
    return Number.isNaN(val) ? 0 : val;
  }

  set value(value) {
    const clamped = Math.max(0, Math.min(100, parseFloat(value) || 0));
    this.setAttribute("value", clamped);
  }

  // Recomputes everything that depends on size / stroke-width
  #applyGeometry() {
    const size = Math.max(1, parseFloat(this.getAttribute("size") ?? 80));
    const strokeWidth = Math.max(
      0,
      parseFloat(this.getAttribute("stroke-width") ?? 6),
    );
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    this.style.setProperty("--size", `${size}px`);
    this.style.setProperty("--label-size", `${size * 0.22}px`);

    this.#svg.setAttribute("width", size);
    this.#svg.setAttribute("height", size);

    for (const circle of [this.#track, this.#progress]) {
      circle.setAttribute("cx", center);
      circle.setAttribute("cy", center);
      circle.setAttribute("r", radius);
      circle.setAttribute("stroke-width", strokeWidth);
    }

    this.#track.setAttribute("class", "track");
    this.#progress.setAttribute("class", "progress");
    this.#label.setAttribute("class", "label");

    this.#circumference = 2 * Math.PI * radius;
    this.#progress.setAttribute("stroke-dasharray", this.#circumference);
  }

  // Only touches stroke-dashoffset and label text
  #applyValue() {
    const value = Math.min(100, Math.max(0, this.value));
    const offset = this.#circumference - (value / 100) * this.#circumference;

    this.#progress.setAttribute("stroke-dashoffset", offset);
    this.#label.textContent = `${Math.round(value)}%`;

    this.setAttribute("aria-valuenow", Math.round(value));
    this.setAttribute("aria-valuetext", `${Math.round(value)} percent`);
  }
}
