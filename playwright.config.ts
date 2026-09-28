import { defineConfig, devices } from "@playwright/test";
import { urlBaseE2e } from "./e2e/preparar-base";

const PUERTO = 3200;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/preparar-base.ts",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Las pruebas usan su propia base (nunca la tuya), corren en serie y cada una la limpia (e2e/base.ts).
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}`, trace: "retain-on-failure" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Fuentes de vacantes simuladas: las pruebas no dependen de internet ni gastan el límite de las plataformas.
    env: { DATABASE_URL: urlBaseE2e(), EMPLEATECH_FUENTES_FALSAS: "1" },
  },
});
