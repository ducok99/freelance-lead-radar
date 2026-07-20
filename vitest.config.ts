import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "{apps,packages,workers}/*/src/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    // TEST-PLAN.md §2: mọi unit test bị chặn network qua setup này.
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/rules-engine/src/**/*.ts"],
      exclude: [
        "packages/rules-engine/src/**/*.test.ts",
        "packages/rules-engine/src/fixtures/**",
        "packages/rules-engine/src/index.ts",
      ],
      thresholds: {
        lines: 90,
      },
    },
  },
});
