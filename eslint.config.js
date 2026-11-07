import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
export default tseslint.config(
  { ignores: ["dist", "node_modules", "public", "test-results", "artifacts", "src/lib/sealAssets.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"], plugins: { "react-hooks": reactHooks }, rules: {
    "react-hooks/rules-of-hooks": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-empty-function": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-unused-expressions": "off",
    "@typescript-eslint/no-unused-expressions": "off",
    "no-control-regex": "off",
    "preserve-caught-error": "off",
    "no-useless-assignment": "off",
    "prefer-const": ["error", { destructuring: "all" }],
    "@typescript-eslint/no-non-null-assertion": "off"
  } },
  { files: ["scripts/**/*.mjs"], languageOptions: { globals: { console: "readonly", process: "readonly", Buffer: "readonly" } } }
);
