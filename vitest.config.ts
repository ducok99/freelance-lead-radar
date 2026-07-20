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
      include: [
        "packages/rules-engine/src/**/*.ts",
        "packages/facebook-adapter/src/**/*.ts",
      ],
      exclude: [
        "packages/{rules-engine,facebook-adapter}/src/**/*.test.ts",
        "packages/facebook-adapter/src/**/*.d.ts",
        "packages/facebook-adapter/src/selectors.ts",
        "packages/facebook-adapter/src/index.ts",
        "packages/rules-engine/src/fixtures/**",
        "packages/rules-engine/src/index.ts",
      ],
      thresholds: {
        lines: 80,
        "packages/rules-engine/src/**": {
          lines: 90,
        },
        "packages/facebook-adapter/src/**": {
          lines: 80,
        },
      },
    },
  },
});
