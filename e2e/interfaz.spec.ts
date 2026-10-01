import { expect, test } from "./base";

test.describe("Estados de carga, vacío y error", () => {
  test("mientras llegan tus datos no aparece «aún no tienes CV»; después sí, si de verdad no hay", async ({ page }) => {
    let soltar!: () => void;
    const espera = new Promise<void>((r) => (soltar = r));
    await page.route("**/api/state", async (ruta) => {
      if (ruta.request().method() === "GET") await espera;
      await ruta.continue();
    });
    await page.goto("/cv");
    await expect(page.getByRole("status").filter({ hasText: "Cargando tus datos…" })).toBeAttached();
    await expect(page.getByText("Aún no guardas ningún CV")).toHaveCount(0);
    soltar();
    await expect(page.getByText("Aún no guardas ningún CV")).toBeVisible();
  });

  test("si el servidor falla lo dice y deja reintentar, en vez de pedirte que subas tu CV", async ({ page }) => {
    let fallar = true;
    await page.route("**/api/state", async (ruta) => {
      if (fallar && ruta.request().method() === "GET") {
        await ruta.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Error inesperado en el servidor." }) });
      } else await ruta.continue();
    });
    await page.goto("/hoy");
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos cargar tus datos" })).toBeVisible();
    await expect(page.getByText("Primero sube tu CV")).toHaveCount(0);

    fallar = false;
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Primero sube tu CV")).toBeVisible();
  });
});

test.describe("Teclado", () => {
  test("lo primero con el tabulador es saltarse el menú", async ({ page, isMobile }) => {
    test.skip(isMobile, "en el teléfono no hay tabulador");
    await page.goto("/panel");
    await page.keyboard.press("Tab");
    const saltar = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(saltar).toBeFocused();
    await saltar.press("Enter");
    await expect(page.locator("#contenido")).toBeFocused();
  });
});

test.describe("Menú en pantallas chicas", () => {
  test("los enlaces van detrás de «Menú» y se cierra al elegir uno", async ({ page, isMobile }) => {
    test.skip(!isMobile, "en escritorio los enlaces van a la vista");
    await page.goto("/panel");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Vacantes" })).toBeHidden();

    const menu = nav.getByRole("button", { name: "Menú" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    expect((await menu.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await menu.click();
    await expect(nav.getByRole("button", { name: "Cerrar" })).toHaveAttribute("aria-expanded", "true");

    await nav.getByRole("link", { name: "Vacantes" }).click();
    await expect(page).toHaveURL(/\/vacantes$/);
    await expect(nav.getByRole("link", { name: "Vacantes" })).toBeHidden();

    await nav.getByRole("button", { name: "Menú" }).click();
    await page.keyboard.press("Escape");
    await expect(nav.getByRole("button", { name: "Menú" })).toHaveAttribute("aria-expanded", "false");
  });
});
