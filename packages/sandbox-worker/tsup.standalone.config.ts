import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  clean: false,
  sourcemap: false,
  bundle: true,
  minify: false,
  target: "node18",
  platform: "node",
  outDir: "dist/standalone",
  outExtension: () => ({ js: ".js" }),
  // Bundle all dependencies except Node.js built-ins
  external: [
    // Node.js built-ins
    "fs",
    "path",
    "crypto",
    "os",
    "url",
    "util",
    "events",
    "stream",
    "buffer",
    "process",
    "child_process",
    "worker_threads",
    "cluster",
    "net",
    "http",
    "https",
    "tls",
    "zlib",
    "querystring",
    "assert",
    "console",
    "timers",
    "dns",
  ],
  // Add shebang for executable
  banner: {
    js: "#!/usr/bin/env node\n",
  },
  // Ensure all dependencies are bundled (remove from external list)
  noExternal: [/.*/], // Bundle everything except Node.js built-ins
});