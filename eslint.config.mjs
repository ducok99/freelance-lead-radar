import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import safety from "./eslint.safety.mjs";
import rulesEngineSafety from "./eslint.rules-engine.mjs";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "fixtures/**/*.html",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...safety,
  {
    rules: {
      // CLAUDE.md: cấm `any` toàn repo.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  ...rulesEngineSafety,
  prettier,
);
