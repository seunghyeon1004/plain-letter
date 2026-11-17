import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: { input: { main: resolve(import.meta.dirname, "index.html"), verify: resolve(import.meta.dirname, "verify.html") } },
  },
  server: { host: "127.0.0.1", port: 5190, strictPort: true },
  preview: { host: "127.0.0.1", port: 5191, strictPort: true },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
