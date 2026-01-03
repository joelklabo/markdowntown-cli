import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import promise from "eslint-plugin-promise";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "storybook-static/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
  {
    plugins: {
      promise,
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='useMemo'] CallExpression[callee.object.name=/^(window|document)$/][callee.property.name=/^(addEventListener|removeEventListener)$/]",
          message:
            "Do not add/remove event listeners inside useMemo. Use useEffect so listeners aren't created during render.",
        },
      ],
      "promise/catch-or-return": ["error", { allowFinally: true }],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          vars: "all",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
