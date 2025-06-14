import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  // Base ESLint recommended config
  js.configs.recommended,

  // TypeScript recommended config
  ...tseslint.configs.recommended,
  {
    plugins: { prettier: prettierPlugin },
    rules: { "prettier/prettier": "error" }
  },
  eslintConfigPrettier,

  // Project-specific config for source files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn"
    }
  },

  // Config for test files
  {
    files: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node, ...globals.jest},
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: "."
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off"
    }
  }
];
