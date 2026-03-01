import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Disable rules that produce false positives in Next.js apps
  {
    rules: {
      // Allow setState in useEffect for hydration - this is a common and valid pattern
      "react-hooks/set-state-in-effect": "off",
      // Allow Date.now() in component body - common pattern for time-sensitive displays
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
