import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * Capturas para la ficha de la Chrome Web Store (1280×800), con la misma app y base de pruebas que las e2e y datos
 * ficticios. Se corre a mano: npx playwright test -c playwright.tienda.config.ts
 */
export default defineConfig({
  ...base,
  testMatch: "**/*.tienda.ts",
  timeout: 90_000,
  projects: [{ name: "tienda", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
});
