import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resolveChromiumPath, startTestEnvironment } from "./helpers.mjs";

describe("extension registration & config", {
  skip:
    !resolveChromiumPath() &&
    "no Chromium/Chrome binary found (set PUPPETEER_EXECUTABLE_PATH)",
}, () => {
  /** @type {Awaited<ReturnType<typeof startTestEnvironment>>} */
  let env;

  before(async () => {
    env = await startTestEnvironment();
  });

  after(async () => {
    await env?.close();
  });

  test("registering two extensions under the same name logs a collision warning", async () => {
    const { page, consoleMessages } = await env.newPage();

    await page.evaluate(async () => {
      const { LexisExtension } = await import("/src/core/extensions/index.js");

      class ExtA extends LexisExtension {
        get name() {
          return "duplicate";
        }
      }
      class ExtB extends LexisExtension {
        get name() {
          return "duplicate";
        }
      }

      const el = document.createElement("lexis-editor");
      el.setAttribute("preset", "simple");
      el.addEventListener("editor:initialize", (event) => {
        event.detail.configure({ extensions: [ExtA, ExtB] });
      });
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));
      el.remove();
    });

    const warned = consoleMessages.some(
      (m) =>
        m.type === "warn" &&
        m.text.includes('"duplicate"') &&
        m.text.includes("already registered"),
    );
    assert.equal(warned, true);

    await page.close();
  });

  test("Editor.value setter treats content as markdown whenever the getter would (even without MarkdownExtension registered)", async () => {
    const { page, pageErrors } = await env.newPage();

    const result = await page.evaluate(async () => {
      const { $getRoot, $isTextNode } = await import(
        "/test/fixtures/lexical-utils.js"
      );

      // The "simple" preset (CoreEditor) does not register MarkdownExtension
      // by default. Overriding `markdown: true` here without adding it is
      // exactly the gap that used to make the setter fall back to parsing
      // input as HTML while the getter still serialized as markdown.
      const el = document.createElement("lexis-editor");
      el.setAttribute("preset", "simple");
      el.addEventListener("editor:initialize", (event) => {
        event.detail.configure({ markdown: true });
      });
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      el.value = "**hello world**";
      await new Promise((r) => setTimeout(r, 50));

      const isBoldTextNode = el.editor.lexicalEditor
        .getEditorState()
        .read(() => {
          const paragraph = $getRoot().getFirstChild();
          const textNode = paragraph?.getFirstChild?.();
          return $isTextNode(textNode) && textNode.hasFormat("bold");
        });

      const value = el.value;
      el.remove();

      return { isBoldTextNode, value };
    });

    assert.equal(
      result.isBoldTextNode,
      true,
      "markdown syntax should have been parsed into a bold TextNode, not left as literal HTML text",
    );
    assert.match(result.value, /\*\*hello world\*\*/);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });
});
