import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/constants.ts", "src/providers/ElevenLabsCloning.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@mindscript/schemas"],
});