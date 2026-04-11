/**
 * Base Controller class
 * Provides lifecycle hooks for command registration and UI mounting
 */
export class Controller {
  /** @type {HTMLElement} The element this controller manages */
  element = null;

  /**
   * Initialize controller with element
   * @param {HTMLElement} element - Pre-existing or newly created element
   */
  constructor(element) {
    this.element = element;
  }

  /**
   * STATIC: Register controller logic with editor
   * Called once per editor to register commands and configure the editor
   * Should be idempotent - safe to call multiple times
   * Override in subclasses to register commands, etc.
   *
   * @param {import('../editor').Editor} editor - Editor instance to configure
   */
  static register(editor) {}

  /**
   * INSTANCE: Mount controller - initialize popover UI and listeners
   * Called for each popover instance after the element is available
   * Must be idempotent - safe to call multiple times
   * Override in subclasses to attach listeners, cache elements, etc.
   *
   * @param {import('../editor').Editor} editor - Reference to editor instance
   */
  mount(editor) {}
}
