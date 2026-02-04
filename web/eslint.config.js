import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["dist", ".svelte-kit", "build", "node_modules", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  ...svelte.configs["flat/prettier"],
  {
    files: ["src/**/*.{js,ts}"],
    plugins: { "@typescript-eslint": tseslint },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./jsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "warn",
    },
  },
  {
    files: ["src/**/*.svelte"],
    plugins: { "@typescript-eslint": tseslint },
    languageOptions: {
      parserOptions: {
        parser: tsParser,
        project: "./jsconfig.json",
        extraFileExtensions: [".svelte"],
      },
    },
    rules: {
      "@typescript-eslint/no-deprecated": "warn",
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
