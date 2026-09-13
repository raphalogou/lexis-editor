import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  clickIntoEditor,
  resolveChromiumPath,
  startTestEnvironment,
} from "./helpers.mjs";

describe("table support", {
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

  test("insert-table creates a 3x3 grid with only the first row as headers", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.editor.runCommand("insert-table");
      await new Promise((r) => setTimeout(r, 100));

      const table = document.querySelector(
        '[data-slot="editor-content"] table',
      );
      const rows = Array.from(table?.querySelectorAll("tr") ?? []).map((tr) =>
        Array.from(tr.children).map((cell) => cell.tagName.toLowerCase()),
      );

      return { hasTable: !!table, rows };
    });

    assert.equal(result.hasTable, true);
    assert.deepEqual(result.rows, [
      ["th", "th", "th"],
      ["td", "td", "td"],
      ["td", "td", "td"],
    ]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("the toolbar exposes an insert-table button", async () => {
    const { page } = await env.newPage();

    const present = await page.evaluate(
      () => !!document.querySelector('[data-command="insert-table"]'),
    );

    assert.equal(present, true);

    await page.close();
  });

  test("markdown round-trip: a simple table survives load and re-export unchanged", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const markdown = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const result = await page.evaluate(async (md) => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = md;
      await new Promise((r) => setTimeout(r, 60));

      const table = document.querySelector(
        '[data-slot="editor-content"] table',
      );
      const rows = Array.from(table?.querySelectorAll("tr") ?? []).map((tr) =>
        Array.from(tr.children).map((cell) => cell.textContent.trim()),
      );

      return { hasTable: !!table, rows, roundTripped: editorEl.value };
    }, markdown);

    assert.equal(
      result.hasTable,
      true,
      "expected a real <table>, not flattened text",
    );
    assert.deepEqual(result.rows, [
      ["a", "b"],
      ["1", "2"],
    ]);
    assert.equal(result.roundTripped, markdown);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("markdown round-trip: inline formatting in cells is preserved as real nodes", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const markdown =
      "| a | b |\n| --- | --- |\n| **bold** | [link](https://example.com) |";
    const result = await page.evaluate(async (md) => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = md;
      await new Promise((r) => setTimeout(r, 60));

      const cells = document.querySelectorAll(
        '[data-slot="editor-content"] table td',
      );
      return {
        hasStrong: !!cells[0]?.querySelector("strong"),
        hasLink: cells[1]?.querySelector("a")?.getAttribute("href"),
        roundTripped: editorEl.value,
      };
    }, markdown);

    assert.equal(
      result.hasStrong,
      true,
      "expected a real <strong> node, not literal asterisks",
    );
    assert.equal(result.hasLink, "https://example.com");
    assert.equal(result.roundTripped, markdown);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("markdown round-trip: an escaped pipe inside a cell survives intact", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const markdown = "| a | b |\n| --- | --- |\n| x \\| y | 2 |";
    const result = await page.evaluate(async (md) => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = md;
      await new Promise((r) => setTimeout(r, 60));

      const firstCell = document.querySelector(
        '[data-slot="editor-content"] table td',
      );
      return {
        cellText: firstCell?.textContent.trim(),
        roundTripped: editorEl.value,
      };
    }, markdown);

    assert.equal(
      result.cellText,
      "x | y",
      "the escape should be resolved for display",
    );
    assert.equal(
      result.roundTripped,
      markdown,
      "and re-escaped identically on export",
    );
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("a lone pipe-delimited line with no divider row is not mistaken for a table", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const markdown = "| just some text with a pipe |";
    const result = await page.evaluate(async (md) => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = md;
      await new Promise((r) => setTimeout(r, 60));

      return {
        hasTable: !!document.querySelector(
          '[data-slot="editor-content"] table',
        ),
        roundTripped: editorEl.value,
      };
    }, markdown);

    assert.equal(result.hasTable, false);
    assert.equal(result.roundTripped, markdown);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowDown from the paragraph above a table enters its first cell", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        $getRoot().getFirstChild().selectEnd();
      });
      editorEl.editor.lexicalEditor.focus();
    });
    await new Promise((r) => setTimeout(r, 60));

    await page.keyboard.press("ArrowDown");
    await new Promise((r) => setTimeout(r, 150));

    const selection = await page.evaluate(async () => {
      const { $getSelection, $isRangeSelection } = await import(
        "/test/fixtures/lexical-utils.js"
      );
      const editorEl = document.querySelector("lexis-editor");
      return editorEl.editor.lexicalEditor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return { kind: "other" };
        const node = sel.anchor.getNode();
        return {
          kind: "range",
          insideTable: node.getParents().some((p) => p.getType() === "table"),
          text: node.getTextContent(),
        };
      });
    });

    assert.equal(selection.kind, "range");
    assert.equal(selection.insideTable, true);
    assert.equal(selection.text, "a");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowUp from the paragraph below a table enters its last cell", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        $getRoot().getLastChild().selectStart();
      });
      editorEl.editor.lexicalEditor.focus();
    });
    await new Promise((r) => setTimeout(r, 60));

    await page.keyboard.press("ArrowUp");
    await new Promise((r) => setTimeout(r, 150));

    const selection = await page.evaluate(async () => {
      const { $getSelection, $isRangeSelection } = await import(
        "/test/fixtures/lexical-utils.js"
      );
      const editorEl = document.querySelector("lexis-editor");
      return editorEl.editor.lexicalEditor.getEditorState().read(() => {
        const sel = $getSelection();
        if (!$isRangeSelection(sel)) return { kind: "other" };
        const node = sel.anchor.getNode();
        return {
          kind: "range",
          insideTable: node.getParents().some((p) => p.getType() === "table"),
          text: node.getTextContent(),
        };
      });
    });

    assert.equal(selection.kind, "range");
    assert.equal(selection.insideTable, true);
    assert.equal(selection.text, "2");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("ArrowDown from the last row of a trailing table (no next sibling) inserts a paragraph and focuses it", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[1].getChildren()[1].selectEnd();
      });
      editorEl.editor.lexicalEditor.focus();
    });
    await new Promise((r) => setTimeout(r, 60));

    await page.keyboard.press("ArrowDown");
    await new Promise((r) => setTimeout(r, 150));

    const result = await page.evaluate(async () => {
      const { $getSelection, $isRangeSelection } = await import(
        "/test/fixtures/lexical-utils.js"
      );
      const editorEl = document.querySelector("lexis-editor");
      // Tables render inside a scrollable-wrapper <div>, so check for the
      // trailing paragraph and the table's presence rather than exact tags.
      const topLevel = Array.from(
        document.querySelectorAll('[data-slot="editor-content"] > *'),
      );
      const shape = {
        count: topLevel.length,
        hasTable: !!topLevel[0]?.querySelector("table"),
        lastTag: topLevel[topLevel.length - 1]?.tagName.toLowerCase(),
      };

      const selection = editorEl.editor.lexicalEditor
        .getEditorState()
        .read(() => {
          const sel = $getSelection();
          if (!$isRangeSelection(sel)) return { kind: "other" };
          const node = sel.anchor.getNode();
          return {
            kind: "range",
            insideTable: node.getParents().some((p) => p.getType() === "table"),
            isEmptyParagraph:
              node.getType() === "paragraph" && node.getTextContent() === "",
          };
        });

      return { shape, selection };
    });

    assert.deepEqual(
      result.shape,
      { count: 2, hasTable: true, lastTag: "p" },
      "expected a trailing paragraph after the table",
    );
    assert.equal(result.selection.kind, "range");
    assert.equal(result.selection.insideTable, false);
    assert.equal(result.selection.isEmptyParagraph, true);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("table-add-row inserts an empty row below the focused row", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[1].getChildren()[0].selectStart();
      });

      editorEl.editor.runCommand("table-add-row");
      await new Promise((r) => setTimeout(r, 60));

      const table = document.querySelector(
        '[data-slot="editor-content"] table',
      );
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.children).map((cell) => cell.textContent.trim()),
      );
      return { rows };
    });

    assert.deepEqual(result.rows, [
      ["a", "b"],
      ["1", "2"],
      ["", ""],
    ]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("table-remove-row deletes the focused row", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[1].getChildren()[0].selectStart();
      });

      editorEl.editor.runCommand("table-remove-row");
      await new Promise((r) => setTimeout(r, 60));

      const table = document.querySelector(
        '[data-slot="editor-content"] table',
      );
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.children).map((cell) => cell.textContent.trim()),
      );
      return { rows };
    });

    assert.deepEqual(result.rows, [
      ["a", "b"],
      ["3", "4"],
    ]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("table-add-column inserts an empty column to the right of the focused column", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[0].getChildren()[0].selectStart();
      });

      editorEl.editor.runCommand("table-add-column");
      await new Promise((r) => setTimeout(r, 60));

      const table = document.querySelector(
        '[data-slot="editor-content"] table',
      );
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.children).map((cell) => cell.textContent.trim()),
      );
      return { rows };
    });

    assert.deepEqual(result.rows, [
      ["a", "", "b"],
      ["1", "", "2"],
    ]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("table-remove-column deletes the focused column", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[0].getChildren()[1].selectStart();
      });

      editorEl.editor.runCommand("table-remove-column");
      await new Promise((r) => setTimeout(r, 60));

      const table = document.querySelector(
        '[data-slot="editor-content"] table',
      );
      const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.children).map((cell) => cell.textContent.trim()),
      );
      return { rows };
    });

    assert.deepEqual(result.rows, [
      ["a", "c"],
      ["1", "3"],
    ]);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("table-delete removes the whole table", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nafter";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[0].getChildren()[0].selectStart();
      });

      editorEl.editor.runCommand("table-delete");
      await new Promise((r) => setTimeout(r, 60));

      return {
        hasTable: !!document.querySelector(
          '[data-slot="editor-content"] table',
        ),
        text: document.querySelector('[data-slot="editor-content"]')
          .textContent,
      };
    });

    assert.equal(result.hasTable, false);
    assert.match(result.text, /before/);
    assert.match(result.text, /after/);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("the floating controls panel appears centered above the table and hides outside it", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));
    });

    const outside = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="table-controls"]');
      return { hidden: el?.hidden ?? true };
    });
    assert.equal(outside.hidden, true, "hidden before any cell is focused");

    const inside = await page.evaluate(async () => {
      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      const editorEl = document.querySelector("lexis-editor");

      let tableKey = null;
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[1].getChildren()[1].selectStart();
        tableKey = table.getKey();
      });
      await new Promise((r) => setTimeout(r, 60));

      const controls = document.querySelector('[data-slot="table-controls"]');
      const tableElement =
        editorEl.editor.lexicalEditor.getElementByKey(tableKey);
      const controlsRect = controls.getBoundingClientRect();
      const tableRect = tableElement.getBoundingClientRect();

      return {
        hidden: controls.hidden,
        buttonCount: controls.querySelectorAll("button").length,
        aboveTable: controlsRect.bottom <= tableRect.top,
        centered:
          Math.abs(
            controlsRect.left +
              controlsRect.width / 2 -
              (tableRect.left + tableRect.width / 2),
          ) < 2,
      };
    });

    assert.equal(inside.hidden, false);
    assert.equal(inside.buttonCount, 5);
    assert.equal(inside.aboveTable, true, "panel sits above the table");
    assert.equal(
      inside.centered,
      true,
      "panel is horizontally centered over the table",
    );

    const backOutside = await page.evaluate(async () => {
      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      const editorEl = document.querySelector("lexis-editor");
      editorEl.editor.lexicalEditor.update(() => {
        $getRoot().getFirstChild().selectEnd();
      });
      await new Promise((r) => setTimeout(r, 60));
      return document.querySelector('[data-slot="table-controls"]').hidden;
    });
    assert.equal(
      backOutside,
      true,
      "hidden again once selection leaves the table",
    );
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("the floating controls panel hides once focus truly leaves the editor", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[0].getChildren()[0].selectStart();
      });
    });
    await new Promise((r) => setTimeout(r, 60));

    const whileFocused = await page.evaluate(
      () => document.querySelector('[data-slot="table-controls"]').hidden,
    );
    assert.equal(whileFocused, false, "visible while the table is focused");

    // Selection stays anchored inside the table cell (Lexical doesn't clear
    // it just because the DOM lost focus), but a real blur — focus moving
    // to an unrelated element outside the editor entirely — must still hide
    // the panel rather than leaving it stuck open.
    await page.evaluate(async () => {
      const outside = document.createElement("button");
      outside.textContent = "outside";
      document.body.appendChild(outside);
      outside.focus();
      await new Promise((r) => setTimeout(r, 60));
    });

    const afterBlur = await page.evaluate(
      () => document.querySelector('[data-slot="table-controls"]').hidden,
    );
    assert.equal(afterBlur, true, "hidden once focus leaves the editor");

    // Refocusing the exact same cell can leave the browser selection
    // unchanged (no selectionchange fires), so the panel must still recover
    // via the editor's own focus event rather than staying stuck hidden.
    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.editor.lexicalEditor.focus();
      await new Promise((r) => setTimeout(r, 60));
    });

    const afterRefocus = await page.evaluate(
      () => document.querySelector('[data-slot="table-controls"]').hidden,
    );
    assert.equal(
      afterRefocus,
      false,
      "visible again once focus returns to the still-selected cell",
    );
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("the floating controls panel hides on window blur (alt-tab / devtools)", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[0].getChildren()[0].selectStart();
      });
    });
    await new Promise((r) => setTimeout(r, 60));

    const whileFocused = await page.evaluate(
      () => document.querySelector('[data-slot="table-controls"]').hidden,
    );
    assert.equal(whileFocused, false);

    // document.activeElement never changes on a window-level blur (OS focus
    // moving to another app/tab), so this can't be caught via focusout.
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await new Promise((r) => setTimeout(r, 60));

    const afterWindowBlur = await page.evaluate(
      () => document.querySelector('[data-slot="table-controls"]').hidden,
    );
    assert.equal(afterWindowBlur, true, "hidden on window blur");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("the insert-table toolbar button is active while the caret is inside a table", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value = "before\n\n| a | b |\n| --- | --- |\n| 1 | 2 |";
      await new Promise((r) => setTimeout(r, 60));
    });

    const before = await page.evaluate(
      () =>
        document.querySelector('[data-command="insert-table"]')?.dataset.state,
    );
    assert.notEqual(before, "active");

    await page.evaluate(async () => {
      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      const editorEl = document.querySelector("lexis-editor");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[0].getChildren()[0].selectStart();
      });
    });
    await new Promise((r) => setTimeout(r, 60));

    const inside = await page.evaluate(
      () =>
        document.querySelector('[data-command="insert-table"]')?.dataset.state,
    );
    assert.equal(inside, "active");

    await page.evaluate(async () => {
      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      const editorEl = document.querySelector("lexis-editor");
      editorEl.editor.lexicalEditor.update(() => {
        $getRoot().getFirstChild().selectEnd();
      });
    });
    await new Promise((r) => setTimeout(r, 60));

    const after = await page.evaluate(
      () =>
        document.querySelector('[data-command="insert-table"]')?.dataset.state,
    );
    assert.notEqual(after, "active");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("hovering a control highlights the row/column/table it will affect", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.value =
        "| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |";
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const table = $getRoot()
          .getChildren()
          .find((n) => n.getType() === "table");
        table.getChildren()[1].getChildren()[1].selectStart();
      });
    });
    await new Promise((r) => setTimeout(r, 60));

    const highlightCounts = async () =>
      page.evaluate(() => {
        const classes = [
          "lexis-table-target-row",
          "lexis-table-target-cell",
          "lexis-table-target-table",
          "lexis-table-insert-after-bottom",
          "lexis-table-insert-after-right",
        ];
        return Object.fromEntries(
          classes.map((c) => [c, document.querySelectorAll(`.${c}`).length]),
        );
      });

    const buttons = await page.$$('[data-slot="table-controls"] button');
    assert.equal(buttons.length, 5);

    async function hover(index) {
      const box = await buttons[index].boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await new Promise((r) => setTimeout(r, 80));
    }

    await hover(0); // Add row below
    assert.deepEqual(await highlightCounts(), {
      "lexis-table-target-row": 0,
      "lexis-table-target-cell": 0,
      "lexis-table-target-table": 0,
      "lexis-table-insert-after-bottom": 1,
      "lexis-table-insert-after-right": 0,
    });

    await hover(1); // Remove row
    assert.deepEqual(await highlightCounts(), {
      "lexis-table-target-row": 1,
      "lexis-table-target-cell": 3,
      "lexis-table-target-table": 0,
      "lexis-table-insert-after-bottom": 0,
      "lexis-table-insert-after-right": 0,
    });

    await hover(2); // Add column right
    assert.deepEqual(await highlightCounts(), {
      "lexis-table-target-row": 0,
      "lexis-table-target-cell": 0,
      "lexis-table-target-table": 0,
      "lexis-table-insert-after-bottom": 0,
      "lexis-table-insert-after-right": 3,
    });

    await hover(3); // Remove column
    assert.deepEqual(await highlightCounts(), {
      "lexis-table-target-row": 0,
      "lexis-table-target-cell": 3,
      "lexis-table-target-table": 0,
      "lexis-table-insert-after-bottom": 0,
      "lexis-table-insert-after-right": 0,
    });

    await hover(4); // Delete table
    assert.deepEqual(await highlightCounts(), {
      "lexis-table-target-row": 0,
      "lexis-table-target-cell": 9,
      "lexis-table-target-table": 1,
      "lexis-table-insert-after-bottom": 0,
      "lexis-table-insert-after-right": 0,
    });

    await page.mouse.move(10, 10);
    await new Promise((r) => setTimeout(r, 80));
    assert.deepEqual(await highlightCounts(), {
      "lexis-table-target-row": 0,
      "lexis-table-target-cell": 0,
      "lexis-table-target-table": 0,
      "lexis-table-insert-after-bottom": 0,
      "lexis-table-insert-after-right": 0,
    });

    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("HTML mode (markdown: false) exports a real <table>, not stripped by the sanitizer", async () => {
    const { page, pageErrors } = await env.newPage();

    const result = await page.evaluate(async () => {
      const { TableExtension } = await import("/src/core/extensions/index.js");

      // The "simple" preset has no TableExtension by default — add it
      // explicitly, matching how a consumer would opt into tables in a
      // headless/HTML-mode configuration.
      const el = document.createElement("lexis-editor");
      el.setAttribute("preset", "simple");
      el.addEventListener("editor:initialize", (event) => {
        event.detail.configure({
          markdown: false,
          extensions: [TableExtension],
        });
      });
      document.body.appendChild(el);
      await new Promise((r) => setTimeout(r, 50));

      // Establish real content/selection first — inserting into a
      // never-focused, still-empty editor is a separate edge case (already
      // covered for images) and not what this test is checking.
      el.value = "hello";
      await new Promise((r) => setTimeout(r, 50));

      el.editor.runCommand("insert-table");
      await new Promise((r) => setTimeout(r, 100));

      const html = el.value;
      el.remove();

      return { html };
    });

    assert.match(result.html, /<table[\s>]/);
    assert.match(result.html, /<t[dh][\s>]/);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });
});
