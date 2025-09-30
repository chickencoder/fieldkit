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
  // Bundle all dependencies except Node.js built-ins and modules that need to remain external
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
    // External modules that need access to their original file structure
    "@anthropic-ai/claude-agent-sdk",
    "@anthropic-ai/sdk",
  ],
  // Add shebang for executable
  banner: {
    js: "#!/usr/bin/env node\n",
  },
  // Bundle most dependencies but exclude those that need to remain external
  noExternal: [/^(?!@anthropic-ai\/(claude-agent-sdk|sdk)$).*/],
});
