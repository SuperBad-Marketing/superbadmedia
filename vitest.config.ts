import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    // Primitive import smoke tests cold-start Next's compile pipeline
    // for each module; raise the default 5s ceiling accordingly.
    // 60s ceiling: handler registry smoke tests take ~28s in isolation; CPU
    // contention in a 290-file suite run pushes them past 30s.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
