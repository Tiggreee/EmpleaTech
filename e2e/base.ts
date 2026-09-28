import { test as base, expect } from "@playwright/test";

/**
 * Todas las pruebas comparten la misma base local (un solo perfil), así que cada una arranca con los datos borrados
 * y corren una a la vez (ver playwright.config.ts).
 */
export const test = base.extend<{ baseLimpia: void }>({
  baseLimpia: [
    async ({ request }, use) => {
      const res = await request.delete("/api/state");
      expect(res.ok(), "no se pudo limpiar la base antes de la prueba").toBeTruthy();
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from "@playwright/test";
