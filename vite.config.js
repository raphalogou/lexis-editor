import { resolve } from "node:path";
import { defineConfig } from "vite";

const r = (p) => resolve(import.meta.dirname, p);

export default defineConfig({
  oxc: {
    jsx: {
      pragma: "h",
      pragmaFrag: "Fragment",
      importSource: "jsx-runtime",
      development: false,
    },
  },
  resolve: {
    alias: {
      "jsx-runtime": r("src/helper"),
    },
  },
  build: {
    cssCodeSplit: true,
    lib: {
      entry: {
        core: r("src/core.js"),
        index: r("src/index.js"),
        "lexis-editor.css": r("src/styles/editor.css"),
        "lexis-content.css": r("src/styles/content.css"),
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        format === "es" ? `${entryName}.esm.js` : `${entryName}.cjs`,
    },
    rolldownOptions: {
      external: [
        /^@lexical\//,
        "lexical",
        "dompurify",
        "marked",
        "prismjs",
        /^prismjs\//,
      ],
    },
  },
});
