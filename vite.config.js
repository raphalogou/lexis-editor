import { resolve } from "node:path";
import { defineConfig } from "vite";

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
      "jsx-runtime": resolve(import.meta.dirname, "src/helper"),
    },
  },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.js"),
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
      cssFileName: "style",
    },
  },
});
