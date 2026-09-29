import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const GLOBALES_DE_NAVEGADOR = ["window", "document", "localStorage", "sessionStorage", "navigator", "indexedDB", "location"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Frontera de arquitectura: el dominio es TypeScript puro, sin React, Next ni navegador.
    files: ["src/core/**/*.ts"],
    ignores: ["src/core/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "react/*", "next", "next/*"], message: "core no puede depender de React ni de Next." },
            { group: ["@/storage/*", "@/ui/*", "@/features/*", "@/components/*", "@/app/*", "@/content/*"], message: "core no puede depender de capas superiores." },
          ],
        },
      ],
      "no-restricted-globals": ["error", ...GLOBALES_DE_NAVEGADOR.map((name) => ({ name, message: "core no puede tocar el navegador; usa storage/." }))],
    },
  },
  globalIgnores([".next/**", ".next-app/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", "recon/out/**"]),
]);

export default eslintConfig;
