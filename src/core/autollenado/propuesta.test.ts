// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { campoDePropuesta, esPaginaDeProyecto, leerProyecto, llenarPropuesta, plataformaDeUrl, recortarA } from "./propuesta";

const pagina = (html: string) => {
  document.title = "Payments API | Upwork";
  document.body.innerHTML = html;
};

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("dónde aparece el panel de propuestas", () => {
  it("reconoce las tres plataformas", () => {
    expect(plataformaDeUrl("https://www.workana.com/job/api-de-pagos")).toBe("workana");
    expect(plataformaDeUrl("https://www.upwork.com/jobs/~01abc")).toBe("upwork");
    expect(plataformaDeUrl("https://www.freelancer.com/projects/nodejs/API-pagos")).toBe("freelancer");
    expect(plataformaDeUrl("https://jobs.lever.co/acme/123")).toBeNull();
  });

  it("solo en páginas de un proyecto o de su propuesta, no en la portada ni en búsquedas", () => {
    for (const u of [
      "https://www.workana.com/job/api-de-pagos",
      "https://www.workana.com/messages/bid/api-de-pagos/?tab=message",
      "https://www.upwork.com/jobs/~01abc",
      "https://www.upwork.com/nx/proposals/job/~01abc/apply/",
      "https://www.freelancer.com/projects/nodejs/API-pagos",
    ]) {
      expect(esPaginaDeProyecto(u), u).toBe(true);
    }
    for (const u of ["https://www.workana.com/", "https://www.upwork.com/nx/find-work/best-matches", "https://www.freelancer.com/search/projects?q=java"]) {
      expect(esPaginaDeProyecto(u), u).toBe(false);
    }
  });
});

describe("leer el proyecto", () => {
  it("toma el título y la descripción, sin menús, pies ni el formulario", () => {
    pagina(`<nav>Find Work Messages Reports</nav>
      <main><h1>Payments API for an online store</h1><p>We need a Node.js API with PostgreSQL.</p>
      <form><label>Cover Letter</label><textarea></textarea></form></main>
      <footer>© Upwork Global Inc.</footer>`);
    const p = leerProyecto(document);
    expect(p.titulo).toBe("Payments API for an online store");
    expect(p.texto).toContain("We need a Node.js API with PostgreSQL.");
    expect(p.texto).not.toMatch(/Find Work|Cover Letter|Upwork Global/);
  });

  it("sin encabezado usa el título de la pestaña sin el nombre de la plataforma", () => {
    pagina("<main><p>Descripción del proyecto con suficiente detalle.</p></main>");
    expect(leerProyecto(document).titulo).toBe("Payments API");
  });
});

describe("poner la propuesta en su cuadro", () => {
  it("elige el cuadro de la propuesta aunque haya otros", () => {
    pagina(`<label for="a">Notes for our team (optional)</label><textarea id="a"></textarea>
      <label for="b">Cover Letter</label><textarea id="b"></textarea>`);
    expect(campoDePropuesta(document)?.id).toBe("b");
  });

  it("si hay un solo cuadro usable, ese; los ocultos o de solo lectura no cuentan", () => {
    pagina(`<textarea id="x" readonly></textarea><div hidden><textarea id="y"></textarea></div><textarea id="z"></textarea>`);
    expect(campoDePropuesta(document)?.id).toBe("z");
    pagina("<p>Sin formulario</p>");
    expect(campoDePropuesta(document)).toBeNull();
  });

  it("llena el cuadro vacío, nunca pisa lo que ya escribiste y respeta el máximo de caracteres", () => {
    pagina(`<textarea id="c" maxlength="60"></textarea><textarea id="d">Mi propio texto</textarea>`);
    const c = document.getElementById("c") as HTMLTextAreaElement;
    const d = document.getElementById("d") as HTMLTextAreaElement;
    expect(llenarPropuesta(c, "Primera oración completa aquí. Segunda oración que ya no cabe en el cuadro.")).toBe("llenado");
    expect(c.value).toBe("Primera oración completa aquí.");
    expect(llenarPropuesta(d, "Otra propuesta")).toBe("ya-tenia");
    expect(d.value).toBe("Mi propio texto");
    expect(recortarA("corto", 0)).toBe("corto");
  });
});
