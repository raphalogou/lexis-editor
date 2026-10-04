export class LexisExtension {
  /**
   * @type {import('../editor').Editor}
   * @protected
   */
  editor;

  get name() {
    throw new Error("Implement name getter");
  }

  /**
   * @param {import('../editor').Editor} editor
   */
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * @returns {import('../../elements/editor').LexisEditorElement|null}
   */
  get hostElement() {
    return this.editor.hostElement;
  }

  /**
   * @returns {import('lexical').LexicalExtension}
   */
  get lexicalExtension() {
    return null;
  }

  get enabled() {
    return true;
  }

  /**
   * @returns {import('../editor').EditorCommand[]}
   */
  get commands() {
    return [];
  }

  /**
   * Markdown transformers this extension contributes. They run before the
   * built-in ones, so an extension-specific syntax (e.g. `@[label](id)`)
   * wins over a more generic match (e.g. a plain `[label](id)` link).
   * @returns {import('@lexical/markdown').Transformer[]}
   */
  get markdownTransformers() {
    return [];
  }

  /**
   * @param {import('../../elements').LexisToolbarElement} _toolbarEl
   * @returns {HTMLElement|null}
   */
  render(_toolbarEl) {
    return null;
  }

  dispose() {}
}
