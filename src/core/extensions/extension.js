export class LexisExtension {
  /**
   * @type {import('../editor').Editor}
   * @protected
   */
  editor;

  get name() {
    throw new Error("This method should be implemented");
  }

  /**
   * @param {import('../editor').Editor} editor
   */
  constructor(editor) {
    this.editor = editor;
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
}
