import { createJiti } from "jiti";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const jiti = createJiti(import.meta.url);
const litePlugin = (await jiti.import("./lib/eslint-rules/index.ts")).default;

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
  {
    // Custom Lite rules — enforce the adapter-boundary discipline from
    // FOUNDATIONS §11.2 / §11.6 / §11.7. Scoped to feature code only;
    // the adapter folders themselves are carved out.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: [
      "lib/channels/**",
      "lib/ai/**",
      // brand-dna generate-insight is an LLM caller (same boundary as lib/ai/) — BDA-2
      "lib/brand-dna/generate-insight.ts",
      "lib/stripe/**",
      "lib/pdf/**",
      "lib/crypto/vault.ts",
      "lib/internal-only.ts",
      "lib/eslint-rules/**",
    ],
    plugins: {
      lite: litePlugin,
    },
    rules: {
      "lite/no-direct-anthropic-import": "error",
      "lite/no-direct-stripe-customer-create": "error",
      "lite/no-direct-resend-send": "error",
      "lite/no-direct-crypto": "error",
    },
  },
]);

export default eslintConfig;
