import path from "node:path";
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
      "jsx-runtime": path.resolve(__dirname, "src/helper"),
    },
  },
});
