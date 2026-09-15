import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  clickIntoEditor,
  resolveChromiumPath,
  startTestEnvironment,
} from "./helpers.mjs";

describe("image paste & drag-and-drop", {
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

  test("pastes an image file after a real click", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const root = document.querySelector(
        'lexis-editor [data-slot="editor-content"]',
      );
      const b64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "pasted.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const before = root.querySelectorAll("figure.editor-image").length;
      const defaultPrevented = !root.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
      await new Promise((r) => setTimeout(r, 200));
      const after = root.querySelectorAll("figure.editor-image").length;
      const src = root.querySelector("figure.editor-image img")?.src ?? null;

      return { before, after, defaultPrevented, src };
    });

    assert.equal(result.before, 0);
    assert.equal(result.after, 1);
    assert.equal(result.defaultPrevented, true);
    assert.match(result.src ?? "", /^blob:/);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("drops an image file after a real click", async () => {
    const { page, pageErrors } = await env.newPage();
    const box = await clickIntoEditor(page);

    const result = await page.evaluate(
      async ({ cx, cy }) => {
        const root = document.querySelector(
          'lexis-editor [data-slot="editor-content"]',
        );
        const b64 =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], "dropped.png", { type: "image/png" });
        const dt = new DataTransfer();
        dt.items.add(file);

        const before = root.querySelectorAll("figure.editor-image").length;
        root.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            dataTransfer: dt,
          }),
        );
        root.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            dataTransfer: dt,
          }),
        );
        await new Promise((r) => setTimeout(r, 200));
        const after = root.querySelectorAll("figure.editor-image").length;

        return { before, after };
      },
      { cx: box.x, cy: box.y },
    );

    assert.equal(result.before, 0);
    assert.equal(result.after, 1);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("drops an image file with no prior click/focus (regression: nested-update crash)", async () => {
    // This is the scenario that originally crashed Lexical's reconciler:
    // establishing a fallback selection in the same update pass as the node
    // insertion, and running the insert-image command's update nested
    // inside the DROP_COMMAND handler's own active update. Both were fixed
    // (see #ensureSelection / queueMicrotask in ImageExtension). No prior
    // click here on purpose — the editor is never focused before dropping.
    const { page, pageErrors } = await env.newPage();

    const result = await page.evaluate(async () => {
      const root = document.querySelector(
        'lexis-editor [data-slot="editor-content"]',
      );
      const rect = root.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const b64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "dropped.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);

      const before = root.querySelectorAll("figure.editor-image").length;
      root.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX: cx,
          clientY: cy,
          dataTransfer: dt,
        }),
      );
      root.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX: cx,
          clientY: cy,
          dataTransfer: dt,
        }),
      );
      await new Promise((r) => setTimeout(r, 200));
      const after = root.querySelectorAll("figure.editor-image").length;

      return { before, after };
    });

    assert.equal(result.before, 0);
    assert.equal(
      result.after,
      1,
      "image should still insert without a prior click",
    );
    assert.deepEqual(pageErrors, [], "no Lexical reconciliation errors");

    await page.close();
  });

  test("plain-text paste is unaffected and still runs through markdown conversion", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const result = await page.evaluate(async () => {
      const root = document.querySelector(
        'lexis-editor [data-slot="editor-content"]',
      );
      const dt = new DataTransfer();
      dt.setData("text/plain", "**bold text**");

      const defaultPrevented = !root.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
      await new Promise((r) => setTimeout(r, 150));

      return { defaultPrevented, html: root.innerHTML };
    });

    assert.equal(result.defaultPrevented, true);
    assert.match(result.html, /<strong[^>]*>bold text<\/strong>/);
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("dropping a non-image file is ignored and does not navigate the page away", async () => {
    const { page, pageErrors } = await env.newPage();
    const box = await clickIntoEditor(page);
    const urlBefore = page.url();

    const result = await page.evaluate(
      async ({ cx, cy }) => {
        const root = document.querySelector(
          'lexis-editor [data-slot="editor-content"]',
        );
        const file = new File(["hello"], "notes.txt", { type: "text/plain" });
        const dt = new DataTransfer();
        dt.items.add(file);

        root.dispatchEvent(
          new DragEvent("dragover", {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            dataTransfer: dt,
          }),
        );
        const dropDefaultPrevented = !root.dispatchEvent(
          new DragEvent("drop", {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
            dataTransfer: dt,
          }),
        );
        await new Promise((r) => setTimeout(r, 150));

        return {
          dropDefaultPrevented,
          figureCount: root.querySelectorAll("figure.editor-image").length,
        };
      },
      { cx: box.x, cy: box.y },
    );

    assert.equal(
      result.dropDefaultPrevented,
      true,
      "drop should be prevented to avoid navigating away",
    );
    assert.equal(result.figureCount, 0);
    assert.equal(page.url(), urlBefore, "page must not navigate");
    assert.deepEqual(pageErrors, []);

    await page.close();
  });

  test("warns when a file image is never resolved via editor:image:upload", async () => {
    const { page, consoleMessages } = await env.newPage();
    await clickIntoEditor(page);

    // The test fixture has no editor:image:upload listener wired up by
    // default, so this genuinely leaves the image unresolved. Shrink the
    // grace period so the test doesn't have to wait out the real default.
    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      const imageExtension = editorEl.editor.extensions.find(
        (ext) => ext.name === "image",
      );
      imageExtension.constructor.UPLOAD_WARNING_DELAY_MS = 150;

      const root = document.querySelector(
        'lexis-editor [data-slot="editor-content"]',
      );
      const b64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "x.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      root.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
    });

    await new Promise((r) => setTimeout(r, 400));

    const warned = consoleMessages.some(
      (m) => m.type === "warn" && m.text.includes("still 'uploading'"),
    );
    assert.equal(
      warned,
      true,
      "expected an upload warning after the grace period",
    );

    await page.close();
  });

  test("does not warn when editor:image:upload is properly resolved", async () => {
    const { page, consoleMessages } = await env.newPage();
    await clickIntoEditor(page);

    await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");
      const imageExtension = editorEl.editor.extensions.find(
        (ext) => ext.name === "image",
      );
      imageExtension.constructor.UPLOAD_WARNING_DELAY_MS = 150;

      document.addEventListener("editor:image:upload", (event) => {
        event.detail.upload.success({
          url: "https://example.com/resolved.png",
        });
      });

      const root = document.querySelector(
        'lexis-editor [data-slot="editor-content"]',
      );
      const b64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "x.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      root.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        }),
      );
    });

    await new Promise((r) => setTimeout(r, 400));

    const warned = consoleMessages.some(
      (m) => m.type === "warning" && m.text.includes("still 'uploading'"),
    );
    assert.equal(
      warned,
      false,
      "resolved uploads must not trigger the warning",
    );

    await page.close();
  });

  test("dispatches editor:image:remove with the last known url/description when an image node is deleted", async () => {
    const { page, pageErrors } = await env.newPage();
    await clickIntoEditor(page);

    const removed = await page.evaluate(async () => {
      const editorEl = document.querySelector("lexis-editor");

      let removedDetail = null;
      document.addEventListener("editor:image:remove", (event) => {
        removedDetail = event.detail;
      });

      editorEl.editor.runCommand("insert-image", {
        url: "https://example.com/photo.png",
        description: "a photo",
        source: "url",
      });
      await new Promise((r) => setTimeout(r, 60));

      const { $getRoot } = await import("/test/fixtures/lexical-utils.js");
      editorEl.editor.lexicalEditor.update(() => {
        const findImage = (nodes) => {
          for (const node of nodes) {
            if (node.getType() === "image") return node;
            const found = node.getChildren?.() && findImage(node.getChildren());
            if (found) return found;
          }
          return null;
        };
        findImage($getRoot().getChildren())?.remove();
      });
      await new Promise((r) => setTimeout(r, 60));

      return removedDetail;
    });

    assert.deepEqual(removed, {
      url: "https://example.com/photo.png",
      description: "a photo",
    });
    assert.deepEqual(pageErrors, []);

    await page.close();
  });
});
