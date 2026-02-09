import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60_000, // Docker containers can take a moment
    hookTimeout: 30_000,
    include: ["test/**/*.test.ts"],
  },
});
