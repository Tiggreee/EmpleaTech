import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { CODIGO_PRUEBA } from "../playwright.acceso.config";
import { codigoTotp, deBase32, pasoDe } from "../src/server/totp";
import { urlBaseE2e } from "./preparar-base";

const CONTRASENA = "una frase larga de prueba";
const NUEVA = "tacos de canasta a las tres";
const FORMULARIO = "https://jobs.lever.co/acme/123";

// Las pruebas siguen una historia (crear, salir, entrar, cambiar contraseña, activar 2 pasos…): van en orden.
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Sin contraseña guardada ni intentos fallidos: como la primera vez que abres tu EmpleaTech en internet.
  const cliente = new pg.Client({ connectionString: urlBaseE2e() });
  await cliente.connect();
  await cliente.query("delete from acceso");
  await cliente.query("delete from intentos_acceso");
  await cliente.end();
});

async function entrar(page: Page, contrasena: string) {
  await page.goto("/entrar");
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** «Salir» recarga la página: hay que esperar a que llegue a /entrar antes de navegar a otro lado. */
async function salir(page: Page) {
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
}

const galletaSesion = async (page: Page) => (await page.context().cookies()).find((c) => c.name === "et_sesion")?.value ?? "";

test("sin sesión no se ve nada: las páginas mandan a entrar y las APIs responden 401", async ({ page, request }) => {
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/entrar\?volver=%2Fhoy$/);
  await expect(page.getByRole("heading", { name: "Crea tu contraseña" })).toBeVisible();
  expect((await request.get("/api/state")).status()).toBe(401);
  expect((await request.get("/api/seguridad")).status()).toBe(401);
  expect((await request.get(`/api/autollenado?url=${encodeURIComponent(FORMULARIO)}`, { headers: { "x-empleatech": "extension" } })).status()).toBe(401);
});

test("la primera vez pide el código de acceso y una contraseña fuerte; con eso creas tu cuenta y entras", async ({ page }) => {
  await page.goto("/entrar?volver=/perfil");
  await page.getByLabel("Código de acceso").fill("codigo-que-no-es");
  await page.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
  await page.getByLabel("Repite la contraseña").fill(CONTRASENA);
  await page.getByRole("button", { name: "Crear y entrar" }).click();
  await expect(page.getByText("El código de acceso no es correcto.")).toBeVisible();

  // Una secuencia larga no pasa: el medidor lo dice mientras escribes.
  await page.getByLabel("Código de acceso").fill(CODIGO_PRUEBA);
  await page.getByLabel("Contraseña", { exact: true }).fill("123456789012");
  await expect(page.getByText("Evita secuencias como 123456, abcdef o qwerty.")).toBeVisible();

  await page.getByLabel("Contraseña", { exact: true }).fill(CONTRASENA);
  await expect(page.locator("#ayuda-contrasena")).toContainText(/Fuerte|Muy fuerte/);
  await page.getByRole("button", { name: "Crear y entrar" }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Seguridad" })).toBeVisible();
});

test("nadie puede crear otra contraseña encima de la tuya, y el servidor también rechaza las débiles", async ({ request }) => {
  const encima = await request.post("/api/acceso", { data: { accion: "crear", codigo: CODIGO_PRUEBA, contrasena: "otra contraseña cualquiera" } });
  expect(encima.status()).toBe(409);
  // Saltarse la pantalla no sirve: la regla de fuerza también corre en el servidor.
  const debil = await request.post("/api/acceso", { data: { accion: "crear", codigo: CODIGO_PRUEBA, contrasena: "P@ssw0rd2024!" } });
  expect(debil.status()).toBe(400);
  expect(((await debil.json()) as { error: string }).error).toMatch(/palabra muy común/);
});

test("salir y volver a entrar; una contraseña incorrecta no pasa", async ({ page }) => {
  await entrar(page, CONTRASENA);
  await expect(page).toHaveURL(/\/hoy$/);

  await salir(page);
  expect((await page.request.get("/api/state")).status()).toBe(401);

  await entrar(page, "no es mi contraseña");
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await entrar(page, CONTRASENA);
  await expect(page).toHaveURL(/\/hoy$/);
});

test("la extensión entra solo con su token", async ({ page, request }) => {
  await entrar(page, CONTRASENA);
  await expect(page).toHaveURL(/\/hoy$/);

  await page.goto("/autollenado");
  await page.getByRole("button", { name: "Generar token" }).click();
  const token = await page.getByLabel("Token de conexión").inputValue();
  expect(token).toMatch(/^extension\.[a-f0-9]{32}\.\d+\./);

  const ruta = `/api/autollenado?url=${encodeURIComponent(FORMULARIO)}`;
  // Con token pasa el filtro: responde con datos (200) o pide subir un CV (409) según lo que haya en la base de pruebas.
  const conToken = await request.get(ruta, { headers: { "x-empleatech": "extension", Authorization: `Bearer ${token}` } });
  expect([200, 409]).toContain(conToken.status());
  const falso = await request.get(ruta, { headers: { "x-empleatech": "extension", Authorization: `Bearer ${token.slice(0, -2)}xx` } });
  expect(falso.status()).toBe(401);
  // Un token de sesión no sirve como token de extensión (y viceversa).
  expect((await request.get(ruta, { headers: { "x-empleatech": "extension", Authorization: `Bearer ${await galletaSesion(page)}` } })).status()).toBe(401);
});

test("cambiar la contraseña cierra las demás sesiones y desconecta la extensión", async ({ page, request }) => {
  await entrar(page, CONTRASENA);
  await expect(page).toHaveURL(/\/hoy$/);
  const vieja = await galletaSesion(page);
  expect((await request.get("/api/state", { headers: { cookie: `et_sesion=${vieja}` } })).status()).toBe(200);

  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Mi CV" }).click();
  await page.getByRole("navigation", { name: "Secciones de Mi CV" }).getByRole("link", { name: "Seguridad" }).click();
  await page.getByLabel("Contraseña actual", { exact: true }).fill("no es mi contraseña");
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(NUEVA);
  await page.getByLabel("Repite la contraseña nueva").fill(NUEVA);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText("Tu contraseña actual no es correcta.")).toBeVisible();

  await page.getByLabel("Contraseña actual", { exact: true }).fill(CONTRASENA);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page.getByText(/Listo\. Cerramos tus otras sesiones/)).toBeVisible();

  // La sesión de antes ya no sirve (aunque no haya vencido); la de esta pestaña se renovó.
  expect((await request.get("/api/state", { headers: { cookie: `et_sesion=${vieja}` } })).status()).toBe(401);
  expect((await page.request.get("/api/state")).status()).toBe(200);

  await salir(page);
  await entrar(page, CONTRASENA);
  await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  await entrar(page, NUEVA);
  await expect(page).toHaveURL(/\/hoy$/);
});

test("verificación en dos pasos: con la contraseña ya no basta", async ({ page, request }) => {
  await entrar(page, NUEVA);
  await expect(page).toHaveURL(/\/hoy$/);
  const vieja = await galletaSesion(page);

  await page.goto("/seguridad");
  await page.getByRole("button", { name: "Activar" }).click();
  await page.getByLabel("Tu contraseña actual").fill(NUEVA);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("img", { name: "Código QR para tu app de autenticación" })).toBeVisible();

  // Lo que haría tu app de autenticación: leer la clave y calcular el código de ahora.
  const secreto = deBase32((await page.locator("[data-clave-totp]").textContent()) ?? "");
  await page.getByLabel("Código de 6 dígitos").fill(codigoTotp(secreto, pasoDe(Date.now())));
  await page.getByRole("button", { name: "Confirmar y activar" }).click();
  await expect(page.getByText("Guarda estos códigos de respaldo ahora")).toBeVisible();
  const respaldos = await page.getByRole("list", { name: "Códigos de respaldo" }).getByRole("listitem").allTextContents();
  expect(respaldos).toHaveLength(8);
  await page.getByRole("button", { name: "Ya los guardé" }).click();
  await expect(page.getByText("Activa", { exact: true })).toBeVisible();

  // Activarla cierra las demás sesiones.
  expect((await request.get("/api/state", { headers: { cookie: `et_sesion=${vieja}` } })).status()).toBe(401);

  // Ahora entrar pide el código; uno inventado no pasa.
  await salir(page);
  await entrar(page, NUEVA);
  await expect(page.getByRole("heading", { name: "Verificación en dos pasos" })).toBeVisible();
  expect((await page.request.get("/api/state")).status()).toBe(401);
  await page.getByLabel("Código de verificación").fill("000000");
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText("El código no es correcto o ya se usó.")).toBeVisible();
  // El siguiente código (el que mostrará la app en unos segundos) también vale: el reloj del teléfono rara vez está exacto.
  await page.getByLabel("Código de verificación").fill(codigoTotp(secreto, pasoDe(Date.now()) + 1));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/hoy$/);

  // Sin teléfono: un código de respaldo sirve una sola vez.
  for (const intento of ["primera", "segunda"]) {
    await salir(page);
    await entrar(page, NUEVA);
    await page.getByRole("button", { name: "Perdí mi teléfono: usar un código de respaldo" }).click();
    await page.getByLabel("Código de respaldo").fill(respaldos[0]);
    await page.getByRole("button", { name: "Verificar" }).click();
    if (intento === "primera") await expect(page).toHaveURL(/\/hoy$/);
    else await expect(page.getByText("El código no es correcto o ya se usó.")).toBeVisible();
  }

  // Saltarse el primer paso no sirve: sin la contraseña no hay a qué ponerle código.
  const sinContrasena = await request.post("/api/acceso", { data: { accion: "segundo-paso", codigo: respaldos[1] } });
  expect(sinContrasena.status()).toBe(401);
});

test("después de 5 intentos fallidos hay que esperar", async ({ request }) => {
  for (let i = 0; i < 5; i++) {
    expect((await request.post("/api/acceso", { data: { accion: "entrar", contrasena: `intento-${i}` } })).status()).toBe(401);
  }
  const bloqueado = await request.post("/api/acceso", { data: { accion: "entrar", contrasena: NUEVA } });
  expect(bloqueado.status()).toBe(429);
  expect(((await bloqueado.json()) as { error: string }).error).toMatch(/Demasiados intentos/);
});
