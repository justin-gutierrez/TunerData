import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    /**
     * Run in Node.js — all lib code is pure TS/JS with no browser APIs.
     * React components are NOT imported by these tests.
     */
    environment: "node",

    /** Make `describe`, `it`, `expect`, etc. available without imports */
    globals: true,

    include: ["src/__tests__/**/*.test.ts"],

    /**
     * Keep each test-file suite isolated so shared state in module-level
     * constants (e.g. pre-generated demo CSV rows) can't bleed between files.
     */
    isolate: true,
  },

  resolve: {
    alias: {
      /** Mirror the @/* path alias defined in tsconfig.json */
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
