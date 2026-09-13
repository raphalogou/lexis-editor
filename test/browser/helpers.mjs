import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const CHROMIUM_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
].filter(Boolean);

/**
 * These tests need a real browser (native Selection/Range, DataTransfer,
 * ClipboardEvent/DragEvent, document.caretRangeFromPoint) that jsdom does
 * not implement faithfully enough for Lexical. Rather than depending on
 * `puppeteer`'s bundled Chromium download (slow/network-dependent), this
 * points `puppeteer-core` at whatever Chromium/Chrome is already on the
 * machine.
 * @returns {string|null}
 */
export function resolveChromiumPath() {
  return CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * Boots a throwaway Vite dev server (serving this repo's source directly,
 * same as `npm run dev`) plus a headless Chromium instance, for browser
 * tests to drive.
 */
export async function startTestEnvironment() {
  const executablePath = resolveChromiumPath();
  if (!executablePath) {
    return null;
  }

  const server = await createServer({
    server: { port: 0 },
    logLevel: "silent",
  });
  await server.listen();
  const port = server.httpServer.address().port;
  const baseUrl = `http://localhost:${port}`;

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  return {
    baseUrl,

    /**
     * @param {string} path
     * @returns {Promise<{page: import('puppeteer-core').Page, consoleMessages: {type: string, text: string}[], pageErrors: string[]}>}
     */
    async newPage(path = "/test/fixtures/index.html") {
      const page = await browser.newPage();
      const consoleMessages = [];
      const pageErrors = [];

      page.on("console", (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });

      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle0" });
      await page.waitForSelector('lexis-editor [data-slot="editor-content"]');

      return { page, consoleMessages, pageErrors };
    },

    async close() {
      await browser.close();
      await server.close();
    },
  };
}

/** Clicks the center of the editor's content root, giving it real focus/selection. */
export async function clickIntoEditor(page) {
  const box = await page.evaluate(() => {
    const root = document.querySelector(
      'lexis-editor [data-slot="editor-content"]',
    );
    const rect = root.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.click(box.x, box.y);
  return box;
}
