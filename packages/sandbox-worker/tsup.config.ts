import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [],
  // Configuration for standalone bundle
  bundle: true,
  minify: false, // Keep readable for debugging
  target: "node18",
  platform: "node",
  // Create additional standalone bundle
  outDir: "dist",
  // Add banner for executable
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
