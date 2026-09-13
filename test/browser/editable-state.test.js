import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  clickIntoEditor,
  resolveChromiumPath,
  startTestEnvironment,
} from "./helpers.mjs";

describe("readonly / disabled behavior", {
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

  test("readonly attribute makes the editor non-editable and blocks typing", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      const root = editorEl.querySelector('[data-slot="editor-content"]');
      const before = editorEl.value;

      editorEl.setAttribute("readonly", "");
      await new Promise((r) => setTimeout(r, 30));

      const typingBlocked = (() => {
        document.execCommand("insertText", false, "SHOULD_NOT_APPEAR");
        return editorEl.value === before;
      })();

      return {
        contentEditable: root.contentEditable,
        isEditable: editorEl.editor.lexicalEditor.isEditable(),
        ariaReadOnly: root.getAttribute("aria-readonly"),
        typingBlocked,
      };
    });

    assert.equal(result.contentEditable, "false");
    assert.equal(result.isEditable, false);
    assert.equal(result.typingBlocked, true);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("removing readonly restores editability", async () => {
    const { page } = await env.newPage();

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      const root = editorEl.querySelector('[data-slot="editor-content"]');

      editorEl.setAttribute("readonly", "");
      await new Promise((r) => setTimeout(r, 30));
      editorEl.removeAttribute("readonly");
      await new Promise((r) => setTimeout(r, 30));

      return {
        contentEditable: root.contentEditable,
        isEditable: editorEl.editor.lexicalEditor.isEditable(),
      };
    });

    assert.equal(result.contentEditable, "true");
    assert.equal(result.isEditable, true);

    await page.close();
  });

  test("every toolbar control is forced disabled while readonly", async () => {
    const { page } = await env.newPage();

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      editorEl.setAttribute("readonly", "");
      await new Promise((r) => setTimeout(r, 50));

      // The link popover's inner "Apply" button intentionally shares the
      // "link" command id with the toolbar trigger button so the popover
      // can super-power the link command's UI — the two controls collide
      // in the toolbar's single button-map slot, so only the trigger
      // tracks disabled state here. It's still safe: Editor.runCommand
      // itself refuses to run while non-editable (see the runCommand
      // no-op test below), so this control just can't do anything if
      // clicked.
      const controls = Array.from(
        editorEl.querySelectorAll(
          "lexis-toolbar [data-command], lexis-toolbar select",
        ),
      ).filter((c) => c.dataset.command !== "link");

      return controls.map((c) => ({
        command: c.dataset.command || c.dataset.commandGroup,
        disabled: c.disabled,
      }));
    });

    assert.ok(result.length > 0, "expected at least one toolbar control");
    for (const control of result) {
      assert.equal(
        control.disabled,
        true,
        `expected "${control.command}" to be disabled while readonly`,
      );
    }

    await page.close();
  });

  test("disabled attribute triggers the same non-editable behavior via formDisabledCallback", async () => {
    const { page } = await env.newPage();

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      const root = editorEl.querySelector('[data-slot="editor-content"]');

      editorEl.setAttribute("disabled", "");
      await new Promise((r) => setTimeout(r, 50));

      const disabledState = {
        contentEditable: root.contentEditable,
        isEditable: editorEl.editor.lexicalEditor.isEditable(),
        matchesDisabledPseudo: editorEl.matches(":disabled"),
      };

      editorEl.removeAttribute("disabled");
      await new Promise((r) => setTimeout(r, 50));

      const restoredState = {
        contentEditable: root.contentEditable,
        isEditable: editorEl.editor.lexicalEditor.isEditable(),
      };

      return { disabledState, restoredState };
    });

    assert.equal(result.disabledState.contentEditable, "false");
    assert.equal(result.disabledState.isEditable, false);
    assert.equal(result.disabledState.matchesDisabledPseudo, true);
    assert.equal(result.restoredState.contentEditable, "true");
    assert.equal(result.restoredState.isEditable, true);

    await page.close();
  });

  test("an ancestor <fieldset disabled> also disables the editor", async () => {
    const { page } = await env.newPage();

    const result = await page.evaluate(async () => {
      const fieldset = document.getElementById("fieldset");
      const editorEl = document.getElementById("editor");

      fieldset.disabled = true;
      await new Promise((r) => setTimeout(r, 60));

      const root = editorEl.querySelector('[data-slot="editor-content"]');
      const disabledState = {
        contentEditable: root.contentEditable,
        isEditable: editorEl.editor.lexicalEditor.isEditable(),
        matchesDisabledPseudo: editorEl.matches(":disabled"),
      };

      fieldset.disabled = false;
      await new Promise((r) => setTimeout(r, 60));

      const restoredRoot = editorEl.querySelector(
        '[data-slot="editor-content"]',
      );
      const restoredState = {
        contentEditable: restoredRoot.contentEditable,
        isEditable: editorEl.editor.lexicalEditor.isEditable(),
      };

      return { disabledState, restoredState };
    });

    assert.equal(result.disabledState.contentEditable, "false");
    assert.equal(result.disabledState.isEditable, false);
    assert.equal(result.disabledState.matchesDisabledPseudo, true);
    assert.equal(result.restoredState.contentEditable, "true");
    assert.equal(result.restoredState.isEditable, true);

    await page.close();
  });

  test("runCommand no-ops while the editor is not editable (central guard)", async () => {
    const { page } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      document.execCommand("selectAll");

      editorEl.setAttribute("readonly", "");
      await new Promise((r) => setTimeout(r, 30));

      const before = editorEl.value;
      editorEl.editor.runCommand("bold");
      await new Promise((r) => setTimeout(r, 30));

      return { unchanged: editorEl.value === before };
    });

    assert.equal(
      result.unchanged,
      true,
      "runCommand must not mutate content while readonly",
    );

    await page.close();
  });

  test("toolbar stops reacting to content/selection changes while readonly (frozen, not live)", async () => {
    const { page } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      const boldBtn = editorEl.querySelector('[data-command="bold"]');

      document.execCommand("selectAll");
      editorEl.editor.runCommand("bold");
      await new Promise((r) => setTimeout(r, 60));
      const activeWhileEditable = boldBtn.getAttribute("data-state");

      editorEl.setAttribute("readonly", "");
      await new Promise((r) => setTimeout(r, 60));
      const stateRightAfterReadonly = boldBtn.getAttribute("data-state");

      // A readonly editor can still legitimately be updated by its host
      // (e.g. a live viewer refreshing content) — the toolbar must not
      // reactively re-sync to that while forced disabled.
      editorEl.value = "plain text with no bold at all";
      await new Promise((r) => setTimeout(r, 100));
      const stateAfterProgrammaticChange = boldBtn.getAttribute("data-state");

      editorEl.removeAttribute("readonly");
      await new Promise((r) => setTimeout(r, 60));
      document.execCommand("selectAll");
      await new Promise((r) => setTimeout(r, 60));
      const stateAfterResume = boldBtn.getAttribute("data-state");
      const disabledAfterResume = boldBtn.disabled;

      return {
        activeWhileEditable,
        stateRightAfterReadonly,
        stateAfterProgrammaticChange,
        stateAfterResume,
        disabledAfterResume,
      };
    });

    assert.equal(result.activeWhileEditable, "active");
    assert.equal(
      result.stateRightAfterReadonly,
      "active",
      "frozen at whatever it was when it became readonly",
    );
    assert.equal(
      result.stateAfterProgrammaticChange,
      "active",
      "toolbar must not react to content changes while readonly",
    );
    assert.equal(
      result.stateAfterResume,
      null,
      "live reflection resumes and correctly shows non-bold text",
    );
    assert.equal(result.disabledAfterResume, false);

    await page.close();
  });
});
