import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/.next/**", "**/out/**", "**/dist/**", "**/node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/**/*.{ts,tsx,js,jsx}"],
    plugins: { react, "react-hooks": hooks, "jsx-a11y": jsxA11y },
    rules: { ...react.configs.recommended.rules, ...jsxA11y.configs.recommended.rules, ...hooks.configs.recommended.rules, "react/react-in-jsx-scope": "off", "react/prop-types": "off", "react-hooks/set-state-in-effect": "off", "react/no-unescaped-entities": "off" },
    settings: { react: { version: "detect" } }
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  }
);
