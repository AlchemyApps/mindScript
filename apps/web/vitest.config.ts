import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "*.config.ts",
        "src/test/",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mindscript/schemas": path.resolve(__dirname, "../../packages/schemas/src"),
      "@mindscript/types": path.resolve(__dirname, "../../packages/types/src"),
      "@mindscript/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@mindscript/auth": path.resolve(__dirname, "../../packages/auth/src"),
    },
  },
});