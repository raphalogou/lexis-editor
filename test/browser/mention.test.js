import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { resolveChromiumPath, startTestEnvironment } from "./helpers.mjs";

const FIXTURE = "/test/fixtures/mention.html";
const MENU = '[data-slot="prompt-menu"]';

describe("mention extension (PromptExtension)", {
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

  /** Empties the document and puts the caret in it via Lexical's API. */
  async function focusEmptyEditor(page) {
    await page.evaluate(async () => {
      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      const { lexicalEditor } = document.querySelector("lexis-editor").editor;
      lexicalEditor.update(() => $getRoot().selectEnd());
      lexicalEditor.focus();
    });
    await page.waitForFunction(
      () => document.activeElement?.closest("lexis-editor") !== null,
    );
  }

  function waitForMenu(page, { open = true, options } = {}) {
    return page.waitForFunction(
      (selector, open, options) => {
        const menu = document.querySelector(selector);
        const isOpen = Boolean(menu?.matches(":popover-open"));
        if (isOpen !== open) return false;
        if (options === undefined) return true;
        const labels = [...menu.querySelectorAll('[role="option"]')].map(
          (o) => o.textContent,
        );
        return JSON.stringify(labels) === JSON.stringify(options);
      },
      {},
      MENU,
      open,
      options,
    );
  }

  function readEditor(page) {
    return page.evaluate(() => {
      const el = document.querySelector("lexis-editor");
      const mentions = [
        ...el.querySelectorAll('[data-slot="editor-content"] .mention'),
      ].map((m) => ({ id: m.dataset.mentionId, text: m.textContent }));
      return { value: el.value, mentions };
    });
  }

  test("typing @ opens a filtered menu; Enter inserts an atomic mention", async () => {
    const { page, pageErrors } = await env.newPage(FIXTURE);
    await focusEmptyEditor(page);

    await page.keyboard.type("Hi @");
    await waitForMenu(page, {
      options: ["Ada Lovelace", "Alan Turing", "Grace Hopper"],
    });

    await page.keyboard.type("a");
    await page.keyboard.type("l");
    await waitForMenu(page, { options: ["Alan Turing"] });

    await page.keyboard.press("Enter");
    await waitForMenu(page, { open: false });

    const state = await readEditor(page);
    assert.deepEqual(state.mentions, [{ id: "alan", text: "@Alan Turing" }]);
    assert.equal(state.value.trim(), "Hi @[Alan Turing](alan)");

    // Caret lands after the inserted space; typing continues as plain text.
    await page.keyboard.type("ok");
    assert.equal(
      (await readEditor(page)).value.trim(),
      "Hi @[Alan Turing](alan) ok",
    );

    assert.deepEqual(pageErrors, []);
    await page.close();
  });

  test("Backspace deletes the mention as a single unit", async () => {
    const { page } = await env.newPage(FIXTURE);
    await focusEmptyEditor(page);

    await page.keyboard.type("@gr");
    await waitForMenu(page, { options: ["Grace Hopper"] });
    await page.keyboard.press("Enter");
    await waitForMenu(page, { open: false });

    // First Backspace removes the trailing space, the second the whole chip.
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.waitForFunction(
      () => !document.querySelector("lexis-editor .mention"),
    );

    assert.equal((await readEditor(page)).value.trim(), "");
    await page.close();
  });

  test("ArrowDown moves the active option; Escape closes and stays closed for that query", async () => {
    const { page } = await env.newPage(FIXTURE);
    await focusEmptyEditor(page);

    await page.keyboard.type("@");
    await waitForMenu(page, {
      options: ["Ada Lovelace", "Alan Turing", "Grace Hopper"],
    });

    await page.keyboard.press("ArrowDown");
    const active = await page.evaluate(
      (menu) =>
        document.querySelector(`${menu} [aria-selected="true"]`)?.textContent,
      MENU,
    );
    assert.equal(active, "Alan Turing");

    await page.keyboard.press("Escape");
    await waitForMenu(page, { open: false });

    // Still typing the same @query: the menu must not pop back open.
    await page.keyboard.type("a");
    await new Promise((r) => setTimeout(r, 50));
    await waitForMenu(page, { open: false });
    assert.deepEqual((await readEditor(page)).mentions, []);

    await page.close();
  });

  test("clicking an option inserts it", async () => {
    const { page } = await env.newPage(FIXTURE);
    await focusEmptyEditor(page);

    await page.keyboard.type("@");
    await waitForMenu(page, {
      options: ["Ada Lovelace", "Alan Turing", "Grace Hopper"],
    });
    await page.click(`${MENU} [role="option"]:nth-child(3)`);
    await waitForMenu(page, { open: false });

    assert.deepEqual((await readEditor(page)).mentions, [
      { id: "grace", text: "@Grace Hopper" },
    ]);
    await page.close();
  });

  test("an @ inside a word (e.g. an email address) does not open the menu", async () => {
    const { page } = await env.newPage(FIXTURE);
    await focusEmptyEditor(page);

    await page.keyboard.type("me@ex");
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(await page.evaluate(() => window.mentionSearches), []);
    await waitForMenu(page, { open: false });

    await page.close();
  });

  test("mentions round-trip through markdown and HTML values", async () => {
    const { page } = await env.newPage(FIXTURE);

    const result = await page.evaluate(async () => {
      const el = document.querySelector("lexis-editor");
      el.value = "Ping @[Ada \\] L](ada) please";
      await new Promise((r) => setTimeout(r, 30));
      const mentions = [...el.querySelectorAll(".mention")].map(
        (m) => m.textContent,
      );
      const markdown = el.value;

      const { editor } = el;
      const { $generateHtmlFromNodes } = await import(
        "/test/fixtures/lexical-html.js"
      );
      const { sanitizeHtml } = await import("/src/helper/sanitizer.js");
      const html = editor.lexicalEditor.read(() =>
        sanitizeHtml($generateHtmlFromNodes(editor.lexicalEditor, null)),
      );
      return { mentions, markdown, html };
    });

    assert.deepEqual(result.mentions, ["@Ada ] L"]);
    assert.equal(result.markdown.trim(), "Ping @[Ada \\] L](ada) please");
    assert.match(
      result.html,
      /<a data-mention-id="ada" data-mention-trigger="@">@Ada \] L<\/a>/,
    );

    await page.close();
  });
});
