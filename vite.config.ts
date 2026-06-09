import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsxImportSource: "hono/jsx/dom",
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: mode !== "server",
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
}));
