export class PopoverElement extends HTMLElement {
  /** @type {Array<HTMLTextareaElement|HTMLInputElement|HTMLSelectElement>} */
  #inputs = [];

  connectedCallback() {
    this.#inputs = Array.from(this.querySelectorAll("input, textarea, select"));
    this.addEventListener("editor:command", this.#handleCommand);
  }

  disconnectedCallback() {
    this.removeEventListener("editor:command", this.#handleCommand);
    this.#inputs = [];
  }

  #handleCommand = (evt) => {
    // Build payload from cached inputs
    const payload = {};

    for (const input of this.#inputs) {
      const name = input.name || input.id;
      if (name) {
        payload[name] = input.value;
      }
    }

    evt.detail.payload = payload;
  };
}
