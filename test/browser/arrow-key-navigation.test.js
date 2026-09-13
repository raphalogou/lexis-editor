import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  clickIntoEditor,
  resolveChromiumPath,
  startTestEnvironment,
} from "./helpers.mjs";

/**
 * ArrowUp/ArrowDown across decorator (image) nodes is the single
 * most-patched, most regression-prone area in this codebase (see
 * RichTextExtension in src/core/extensions/rich-text.js and
 * PROJECT_STATE.md). These tests build a real document —
 * `<p>before</p><figure image1/><figure image2/><p>after</p>` — and drive
 * genuine keyboard events through it, covering the full matrix: entering a
 * decorator from a paragraph, moving between consecutive decorators, and
 * leaving a decorator back into a paragraph, in both directions.
 */
describe("arrow key navigation across decorator nodes", {
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

  /**
   * Moves the caret to the start/end of the document's first or last
   * paragraph via Lexical's own selection API, then focuses the editor so
   * subsequent real keyboard events land on it. Positioning the caret
   * this way (rather than clicking pixel coordinates) is what's actually
   * robust here: the test images use fake URLs that never load, and a
   * collapsed/broken <img> box makes coordinate-based clicks near it
   * unreliable — exactly the kind of flakiness this file must not have,
   * given what it's guarding against.
   */
  async function placeCaretInParagraph(page, which, caretPosition) {
    await page.evaluate(
      async ({ which, caretPosition }) => {
        const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
        const editorEl = document.querySelector("lexis-editor");

        editorEl.editor.lexicalEditor.update(() => {
          const root = $getRoot();
          const paragraph =
            which === "first" ? root.getFirstChild() : root.getLastChild();
          if (caretPosition === "start") {
            paragraph.selectStart();
          } else {
            paragraph.selectEnd();
          }
        });
        editorEl.editor.lexicalEditor.focus();
      },
      { which, caretPosition },
    );
    await new Promise((r) => setTimeout(r, 30));
  }

  /** Builds `<p>before</p><figure image1/><figure image2/><p>after</p>`. */
  async function setUpDocument(page) {
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "before";
      await new Promise((r) => setTimeout(r, 30));
    });

    await placeCaretInParagraph(page, "first", "end");

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.editor.runCommand("insert-image", {
        url: "https://example.com/1.png",
        description: "img1",
        source: "url",
      });
      await new Promise((r) => setTimeout(r, 30));
      editorEl.editor.runCommand("insert-image", {
        url: "https://example.com/2.png",
        description: "img2",
        source: "url",
      });
      await new Promise((r) => setTimeout(r, 30));
    });

    await page.keyboard.type("after");
    await new Promise((r) => setTimeout(r, 60));

    // Sanity-check the fixture actually built the shape these tests assume.
    // Excludes Lexical's invisible `[data-lexical-decorator-boundary]`
    // marker element (0.50+), which isn't one of our nodes.
    const shape = await page.evaluate(() => {
      const root = document.querySelector(
        'lexis-editor [data-slot="editor-content"]',
      );
      return Array.from(root.children)
        .filter((el) => !el.hasAttribute("data-lexical-decorator-boundary"))
        .map((el) => el.tagName.toLowerCase());
    });
    assert.deepEqual(
      shape,
      ["p", "figure", "figure", "p"],
      "unexpected document shape",
    );
  }

  /**
   * Presses an arrow key, then polls for the expected `data-selected`
   * state instead of sleeping a fixed delay — firing keys back-to-back
   * with no yield to the event loop is a real race against Lexical's
   * update listener chain (which drives the `data-selected` DOM sync), so
   * a fixed sleep is exactly the kind of thing that's fast enough on one
   * run and flaky on the next. Polling for the actual end state is the
   * correct fix regardless of how much slack turns out to be needed.
   */
  async function pressArrowAndWaitForSelection(page, key, expectedSelected) {
    await page.keyboard.press(key);
    await page.waitForFunction(
      (expected) => {
        const figures = Array.from(
          document.querySelectorAll(
            '[data-slot="editor-content"] figure.editor-image',
          ),
        );
        return (
          JSON.stringify(figures.map((f) => f.dataset.selected === "true")) ===
          expected
        );
      },
      { timeout: 2000 },
      JSON.stringify(expectedSelected),
    );
  }

  /** @returns {Promise<boolean[]>} data-selected of each figure, in document order */
  async function getSelectedFigures(page) {
    return page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '[data-slot="editor-content"] figure.editor-image',
        ),
      ).map((fig) => fig.dataset.selected === "true"),
    );
  }

  /** Reads the current Lexical selection kind + a text sample of its anchor, for verifying range selections. */
  async function readSelectionKind(page) {
    return page.evaluate(async () => {
      const { $getSelection, $isNodeSelection, $isRangeSelection } =
        await import("/test/fixtures/lexical-utils.js");
      const editorEl = document.querySelector("lexis-editor");

      return editorEl.editor.lexicalEditor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          return { kind: "node", count: selection.getNodes().length };
        }
        if ($isRangeSelection(selection)) {
          return {
            kind: "range",
            text: selection.anchor.getNode().getTextContent(),
          };
        }
        return { kind: "other" };
      });
    });
  }

  test("ArrowDown from the end of a paragraph selects the following image", async () => {
    const { page, pageErrors } = await env.newPage();
    await setUpDocument(page);
    await placeCaretInParagraph(page, "first", "end"); // end of "before"

    await pressArrowAndWaitForSelection(page, "ArrowDown", [true, false]);

    assert.deepEqual(await getSelectedFigures(page), [true, false]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowDown between two consecutive images moves selection to the next one", async () => {
    const { page, pageErrors } = await env.newPage();
    await setUpDocument(page);
    await placeCaretInParagraph(page, "first", "end"); // end of "before"

    await pressArrowAndWaitForSelection(page, "ArrowDown", [true, false]); // paragraph -> image1
    await pressArrowAndWaitForSelection(page, "ArrowDown", [false, true]); // image1 -> image2

    assert.deepEqual(await getSelectedFigures(page), [false, true]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowDown from the last image moves into the following paragraph", async () => {
    const { page, pageErrors } = await env.newPage();
    await setUpDocument(page);
    await placeCaretInParagraph(page, "first", "end"); // end of "before"

    await pressArrowAndWaitForSelection(page, "ArrowDown", [true, false]); // paragraph -> image1
    await pressArrowAndWaitForSelection(page, "ArrowDown", [false, true]); // image1 -> image2
    await pressArrowAndWaitForSelection(page, "ArrowDown", [false, false]); // image2 -> "after" paragraph

    assert.deepEqual(await getSelectedFigures(page), [false, false]);
    const selection = await readSelectionKind(page);
    assert.equal(selection.kind, "range");
    assert.equal(selection.text, "after");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowUp from the start of a paragraph selects the preceding image", async () => {
    const { page, pageErrors } = await env.newPage();
    await setUpDocument(page);
    await placeCaretInParagraph(page, "last", "start"); // start of "after"

    await pressArrowAndWaitForSelection(page, "ArrowUp", [false, true]);

    assert.deepEqual(await getSelectedFigures(page), [false, true]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowUp between two consecutive images moves selection to the previous one", async () => {
    const { page, pageErrors } = await env.newPage();
    await setUpDocument(page);
    await placeCaretInParagraph(page, "last", "start"); // start of "after"

    await pressArrowAndWaitForSelection(page, "ArrowUp", [false, true]); // paragraph -> image2
    await pressArrowAndWaitForSelection(page, "ArrowUp", [true, false]); // image2 -> image1

    assert.deepEqual(await getSelectedFigures(page), [true, false]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowUp from the first image moves into the preceding paragraph", async () => {
    const { page, pageErrors } = await env.newPage();
    await setUpDocument(page);
    await placeCaretInParagraph(page, "last", "start"); // start of "after"

    await pressArrowAndWaitForSelection(page, "ArrowUp", [false, true]); // paragraph -> image2
    await pressArrowAndWaitForSelection(page, "ArrowUp", [true, false]); // image2 -> image1
    await pressArrowAndWaitForSelection(page, "ArrowUp", [false, false]); // image1 -> "before" paragraph

    assert.deepEqual(await getSelectedFigures(page), [false, false]);
    const selection = await readSelectionKind(page);
    assert.equal(selection.kind, "range");
    assert.equal(selection.text, "before");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowDown from a trailing image with no next sibling inserts a paragraph instead of crashing", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "";
      await new Promise((r) => setTimeout(r, 30));
      editorEl.editor.runCommand("insert-image", {
        url: "https://example.com/only.png",
        description: "only",
        source: "url",
      });
      await new Promise((r) => setTimeout(r, 30));
    });

    // Re-select the image directly (insertion already moved the caret into
    // the auto-created trailing paragraph) so ArrowDown starts from the
    // image itself, matching the "decorator with no next sibling" branch.
    // Click the figure, not the <img> — the src is a fake URL that never
    // loads, and a broken image can end up with no clickable box.
    await page.click('[data-slot="editor-content"] figure.editor-image');
    await new Promise((r) => setTimeout(r, 30));

    await page.keyboard.press("ArrowDown");
    // Lexical (0.50+) renders an invisible, zero-size marker element
    // (`[data-lexical-decorator-boundary]`) as a sibling next to whichever
    // decorator currently has NodeSelection — exclude it, it isn't one of
    // our nodes.
    const contentSelector =
      '[data-slot="editor-content"] > *:not([data-lexical-decorator-boundary])';
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length === 2,
      { timeout: 2000 },
      contentSelector,
    );

    const shape = await page.evaluate(
      (selector) =>
        Array.from(document.querySelectorAll(selector)).map((el) =>
          el.tagName.toLowerCase(),
        ),
      contentSelector,
    );

    assert.deepEqual(
      shape,
      ["figure", "p"],
      "expected a trailing paragraph after the lone image",
    );
    assert.deepEqual(pageErrors, []);

    await page.close();
  });
});
