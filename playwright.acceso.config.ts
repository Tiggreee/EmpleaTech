import { defineConfig, devices } from "@playwright/test";
import { urlBaseE2e } from "./e2e/preparar-base";

const PUERTO = 3300;

/**
 * La app tal como vive en internet: con contraseña (EMPLEATECH_AUTH=1). Usa la base de pruebas, claves de prueba y su
 * propia carpeta de build, así no pisa la de las otras pruebas ni la tuya.
 */
export const CODIGO_PRUEBA = "codigo-de-prueba-e2e-123";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.acceso.ts",
  globalSetup: "./e2e/preparar-base.ts",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}`, trace: "retain-on-failure" },
  projects: [{ name: "con-contrasena", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next build && npx next start -H 127.0.0.1 -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/entrar`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: urlBaseE2e(),
      EMPLEATECH_FUENTES_FALSAS: "1",
      EMPLEATECH_DIST_DIR: ".next-acceso",
      EMPLEATECH_AUTH: "1",
      EMPLEATECH_SECRETO: "secreto-de-prueba-e2e-no-sirve-fuera-de-aqui-0123456789",
      EMPLEATECH_CODIGO_INICIAL: CODIGO_PRUEBA,
    },
  },
});
