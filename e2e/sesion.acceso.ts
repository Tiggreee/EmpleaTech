import { expect, test } from "@playwright/test";
import pg from "pg";
import { CODIGO_PRUEBA } from "../playwright.acceso.config";
import { urlBaseE2e } from "./preparar-base";

const CONTRASENA = "una frase larga de prueba";
const FORMULARIO = "https://jobs.lever.co/acme/123";

// Las pruebas siguen una historia (crear, salir, entrar…): van en orden.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Sin contraseña guardada: como la primera vez que abres tu EmpleaTech en internet.
  const cliente = new pg.Client({ connectionString: urlBaseE2e() });
  await cliente.connect();
  await cliente.query("delete from acceso");
  await cliente.end();
});

test("sin sesión no se ve nada: las páginas mandan a entrar y las APIs responden 401", async ({ page, request }) => {
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/entrar\?volver=%2Fhoy$/);
  await expect(page.getByRole("heading", { name: "Crea tu contraseña" })).toBeVisible();
  expect((await request.get("/api/state")).status()).toBe(401);
  expect((await request.get(`/api/autollenado?url=${encodeURIComponent(FORMULARIO)}`, { headers: { "x-empleatech": "extension" } })).status()).toBe(401);
});

test("la primera vez pide el código de acceso; con el correcto creas tu contraseña y entras", async ({ page }) => {
  await page.goto("/entrar?volver=/perfil");
  await page.getByLabel("Código de acceso").fill("codigo-que-no-es");
  await page.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
  await page.getByLabel("Repite la contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Crear y entrar" }).click();
  await expect(page.getByText("El código de acceso no es correcto.")).toBeVisible();

  await page.getByLabel("Código de acceso").fill(CODIGO_PRUEBA);
  await page.getByRole("button", { name: "Crear y entrar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
});

test("nadie puede crear otra contraseña encima de la tuya", async ({ request }) => {
  const r = await request.post("/api/acceso", { data: { accion: "crear", codigo: CODIGO_PRUEBA, contrasena: "otra contraseña cualquiera" } });
  expect(r.status()).toBe(409);
});

test("salir y volver a entrar; una contraseña incorrecta no pasa", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/hoy$/);

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get("/api/state")).status()).toBe(401);

  await page.getByLabel("Contraseña").fill("no es mi contraseña");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/hoy$/);
});

test("la extensión entra solo con su token", async ({ page, request }) => {
  await page.goto("/entrar");
  await page.getByLabel("Contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/hoy$/);

  await page.goto("/autollenado");
  await page.getByRole("button", { name: "Generar token" }).click();
  const token = await page.getByLabel("Token de conexión").inputValue();
  expect(token).toMatch(/^extension\.\d+\./);

  const ruta = `/api/autollenado?url=${encodeURIComponent(FORMULARIO)}`;
  // Con token pasa el filtro: responde con datos (200) o pide subir un CV (409) según lo que haya en la base de pruebas.
  const conToken = await request.get(ruta, { headers: { "x-empleatech": "extension", Authorization: `Bearer ${token}` } });
  expect([200, 409]).toContain(conToken.status());
  const falso = await request.get(ruta, { headers: { "x-empleatech": "extension", Authorization: `Bearer ${token.slice(0, -2)}xx` } });
  expect(falso.status()).toBe(401);
  // Un token de sesión no sirve como token de extensión (y viceversa).
  const cookie = (await page.context().cookies()).find((c) => c.name === "et_sesion")?.value ?? "";
  expect((await request.get(ruta, { headers: { "x-empleatech": "extension", Authorization: `Bearer ${cookie}` } })).status()).toBe(401);
});

test("después de 5 intentos fallidos hay que esperar", async ({ request }) => {
  for (let i = 0; i < 5; i++) {
    expect((await request.post("/api/acceso", { data: { accion: "entrar", contrasena: `intento-${i}` } })).status()).toBe(401);
  }
  const bloqueado = await request.post("/api/acceso", { data: { accion: "entrar", contrasena: CONTRASENA } });
  expect(bloqueado.status()).toBe(429);
  expect(((await bloqueado.json()) as { error: string }).error).toMatch(/Demasiados intentos/);
});
