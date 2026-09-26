import { expect, test, type Page } from "@playwright/test";
import { CV_LINEAS, crearDocx, crearPdf, crearPdfEscaneado } from "./archivos";

const alerta = (page: Page) => page.locator("p[role=alert]");

async function abrirNuevoCv(page: Page) {
  await page.goto("/cv");
  await page.getByRole("button", { name: /Subir mi CV|Agregar CV/ }).first().click();
}

test.describe("Importar CV desde archivo", () => {
  test("PDF con texto: extrae, limpia y detecta habilidades", async ({ page }) => {
    await abrirNuevoCv(page);
    const lineas = CV_LINEAS.map((texto, i) => ({ texto, x: 50, y: 720 - i * 18 }));
    await page.locator('input[type=file]').setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: crearPdf(lineas) });
    await expect(page.getByText(/Leído cv\.pdf/)).toBeVisible();
    const texto = await page.getByLabel(/Texto del CV/).inputValue();
    expect(texto).toContain("Ana Torres");
    expect(texto).toMatch(/Node\.js, PostgreSQL, Docker y React/);
    expect(texto.split("\n")[0]).toBe("Ana Torres - Desarrolladora Full Stack");
    await expect(page.getByText(/Lo que entiende este CV/)).toBeVisible();
    await expect(page.getByText("PostgreSQL", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Nombre de esta versión")).toHaveValue("cv");
  });

  test("PDF: reconstruye el orden de lectura aunque los fragmentos vengan desordenados", async ({ page }) => {
    await abrirNuevoCv(page);
    const desordenado = [
      { texto: "Docker y Kubernetes en produccion", x: 50, y: 680 },
      { texto: "Skills:", x: 50, y: 700 },
      { texto: "Python, AWS", x: 100, y: 700 },
      { texto: "Ana Torres - Backend", x: 50, y: 740 },
    ];
    await page.locator('input[type=file]').setInputFiles({ name: "orden.pdf", mimeType: "application/pdf", buffer: crearPdf(desordenado) });
    await expect(page.getByText(/Leído orden\.pdf/)).toBeVisible();
    const texto = await page.getByLabel(/Texto del CV/).inputValue();
    expect(texto.split("\n")).toEqual(["Ana Torres - Backend", "Skills: Python, AWS", "Docker y Kubernetes en produccion"]);
  });

  test("DOCX: extrae los párrafos", async ({ page }) => {
    await abrirNuevoCv(page);
    await page.locator('input[type=file]').setInputFiles({
      name: "cv.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: crearDocx(["Luis Pérez — Analista de datos", "Experiencia con SQL, Power BI y Excel.", "Inglés B2"]),
    });
    await expect(page.getByText(/Leído cv\.docx/)).toBeVisible();
    const texto = await page.getByLabel(/Texto del CV/).inputValue();
    expect(texto).toContain("Luis Pérez");
    expect(texto).toContain("Power BI");
    await expect(page.getByText("Power BI", { exact: true })).toBeVisible();
  });

  test("TXT: se lee y se limpian viñetas", async ({ page }) => {
    await abrirNuevoCv(page);
    await page.locator('input[type=file]').setInputFiles({ name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("Mi CV\n• Python\n▪ Docker\nExperiencia con React y TypeScript en proyectos reales.", "utf8") });
    await expect(page.getByText(/Leído cv\.txt/)).toBeVisible();
    expect(await page.getByLabel(/Texto del CV/).inputValue()).toContain("- Python\n- Docker");
  });

  test("PDF escaneado (sin texto): explica el problema y no rellena nada", async ({ page }) => {
    await abrirNuevoCv(page);
    await page.locator('input[type=file]').setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: crearPdfEscaneado() });
    await expect(alerta(page)).toContainText(/imagen escaneada/);
    expect(await page.getByLabel(/Texto del CV/).inputValue()).toBe("");
  });

  test("archivo dañado o de formato no soportado: mensaje claro", async ({ page }) => {
    await abrirNuevoCv(page);
    const entrada = page.locator('input[type=file]');
    await entrada.setInputFiles({ name: "roto.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 esto no es un pdf valido") });
    await expect(alerta(page)).toContainText(/No pudimos leer ese PDF/);
    await entrada.setInputFiles({ name: "viejo.doc", mimeType: "application/msword", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]) });
    await expect(alerta(page)).toContainText(/\.doc antiguos/);
    await entrada.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) });
    await expect(alerta(page)).toContainText(/Formato no compatible/);
  });

  test("un .exe renombrado a .docx no se acepta como CV", async ({ page }) => {
    await abrirNuevoCv(page);
    await page.locator('input[type=file]').setInputFiles({ name: "cv.docx", mimeType: "application/octet-stream", buffer: Buffer.from("MZ\x90\x00 esto es un ejecutable") });
    await expect(alerta(page)).toBeVisible();
    expect(await page.getByLabel(/Texto del CV/).inputValue()).toBe("");
  });

  test("guardar el CV lo deja activo y persiste tras recargar", async ({ page }) => {
    await abrirNuevoCv(page);
    await page.locator('input[type=file]').setInputFiles({ name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("Ana Torres. 5 años de experiencia con Node.js, Docker y PostgreSQL en proyectos reales.", "utf8") });
    await page.getByRole("button", { name: "Guardar CV" }).click();
    await expect(page.getByText("Activo", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Activo", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "cv", exact: true })).toBeVisible();
  });
});

