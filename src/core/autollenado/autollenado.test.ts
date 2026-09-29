// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { sanitizarRespuestas } from "../perfil/respuestas";
import { clasificar, type DatosAutollenado } from "./campos";
import { capturarRespuestas, llenarFormulario, parecePostulacionEnviada, verificar } from "./dom";

const HOY = new Date(2026, 8, 28);

function datos(extra: Partial<DatosAutollenado> = {}): DatosAutollenado {
  return {
    nombre: "Ana",
    apellido: "Torres Ramírez",
    nombreCompleto: "Ana Torres Ramírez",
    correo: "ana@ejemplo.mx",
    telefono: "+52 33 1234 5678",
    ciudad: "Guadalajara",
    paisResidencia: "MX",
    linkedin: "https://linkedin.com/in/anatorres",
    github: "https://github.com/anatorres",
    empresaActual: "Acme Pagos",
    respuestas: sanitizarRespuestas({
      requierePatrocinio: true,
      paisesAutorizado: ["MX"],
      aniosExperiencia: 6,
      nivelIngles: "avanzado",
      disponibilidad: "2-semanas",
      salario: { monto: 55000, moneda: "MXN", periodo: "mes" },
    }),
    carta: "Hola, equipo…",
    aprendidas: {},
    ...extra,
  };
}

const valor = (sel: string) => (document.querySelector(sel) as HTMLInputElement).value;
const opcion = (sel: string) => {
  const s = document.querySelector(sel) as HTMLSelectElement;
  return s.options[s.selectedIndex]?.text;
};

describe("clasificar", () => {
  it("por nombre fijo del ATS o por la etiqueta, en español e inglés", () => {
    expect(clasificar("", { nombre: "first_name" })).toBe("nombre");
    expect(clasificar("", { nombre: "urls[LinkedIn Profile]" })).toBe("linkedin");
    expect(clasificar("Will you now or in the future require visa sponsorship?")).toBe("patrocinio");
    expect(clasificar("Are you legally authorized to work in the United States?")).toBe("autorizacion");
    expect(clasificar("¿Cuál es tu pretensión salarial?")).toBe("salario");
    expect(clasificar("Correo electrónico *")).toBe("correo");
    expect(clasificar("Tell us about yourself")).toBeNull();
  });

  it("años de experiencia totales sí; años en algo específico no (visto en un formulario real de Lever)", () => {
    expect(clasificar("Years of professional experience")).toBe("aniosExperiencia");
    expect(clasificar("¿Cuántos años de experiencia tienes?")).toBe("aniosExperiencia");
    expect(clasificar("How many years of sales related experience do you have?")).toBeNull();
    expect(clasificar("How many years of experience do you have with React?")).toBeNull();
    expect(clasificar("Años de experiencia en liderazgo de equipos")).toBeNull();
  });
});

describe("Greenhouse", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form>
        <label for="first_name">First Name *</label><input id="first_name" name="first_name" required>
        <label for="last_name">Last Name *</label><input id="last_name" name="last_name" required>
        <label for="email">Email *</label><input id="email" name="email" type="text" required>
        <label for="phone">Phone</label><input id="phone" name="phone">
        <label for="resume">Resume/CV</label><input id="resume" name="resume" type="file">
        <label for="q1">LinkedIn Profile *</label><input id="q1" name="question_1" required>
        <label for="q2">Will you now or in the future require sponsorship to work in the United States? *</label>
        <select id="q2" name="question_2" required><option value="">Select...</option><option value="1">Yes</option><option value="2">No</option></select>
        <label for="q3">Have you been referred by any staff member? *</label>
        <select id="q3" name="question_3" required><option value="">Select...</option><option value="a">Yes</option><option value="b">No</option></select>
        <label for="g">Gender</label>
        <select id="g" name="gender"><option value="">Select...</option><option value="m">Male</option><option value="f">Female</option><option value="d">Decline To Self Identify</option></select>
      </form>`;
  });

  it("llena identidad, LinkedIn, patrocinio y diversidad; deja lo desconocido marcado", () => {
    const r = llenarFormulario(document, datos(), {}, HOY);
    expect(valor("#first_name")).toBe("Ana");
    expect(valor("#last_name")).toBe("Torres Ramírez");
    expect(valor("#email")).toBe("ana@ejemplo.mx");
    expect(valor("#q1")).toBe("https://linkedin.com/in/anatorres");
    // Autorizada en MX pero no en EE. UU.: sí necesita patrocinio para trabajar allá.
    expect(opcion("#q2")).toBe("Yes");
    expect(opcion("#g")).toBe("Decline To Self Identify");
    expect(r.find((x) => x.etiqueta.startsWith("Have you been referred"))).toMatchObject({ estado: "pendiente", requerido: true });
    const faltan = verificar(document);
    expect(faltan.map((f) => f.etiqueta)).toEqual(["Have you been referred by any staff member?"]);
    expect(document.querySelector("#q3")?.getAttribute("data-empleatech-falta")).toBe("1");
  });

  it("lo que respondiste a mano la vez pasada se usa en la siguiente", () => {
    llenarFormulario(document, datos({ aprendidas: { "have you been referred by any staff member": "No" } }), {}, HOY);
    expect(opcion("#q3")).toBe("No");
  });

  it("nunca sobrescribe lo que ya escribiste", () => {
    (document.querySelector("#email") as HTMLInputElement).value = "otro@correo.com";
    const r = llenarFormulario(document, datos(), {}, HOY);
    expect(valor("#email")).toBe("otro@correo.com");
    expect(r.find((x) => x.campo === "correo")?.estado).toBe("ya-tenia");
  });
});

describe("Lever", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form>
        <ul>
          <li class="application-question"><div class="application-label">Full name<span>✱</span></div><div class="application-field"><input name="name" type="text" required></div></li>
          <li class="application-question"><div class="application-label">Email<span>✱</span></div><div class="application-field"><input name="email" type="email" required></div></li>
          <li class="application-question"><div class="application-label">Current company</div><div class="application-field"><input name="org" type="text"></div></li>
          <li class="application-question"><div class="application-label">LinkedIn Profile URL</div><div class="application-field"><input name="urls[LinkedIn Profile]" type="text"></div></li>
          <li class="application-question"><div class="application-label">Tell us a little about yourself.<span>✱</span></div><div class="application-field"><textarea name="cards[x][field0]" required></textarea></div></li>
          <li class="application-question"><div class="application-label">Will you, now or in the future, require visa sponsorship?<span>✱</span></div>
            <div class="application-field"><ul>
              <li><label><input type="radio" name="cards[x][field1]" value="Yes" required>Yes</label></li>
              <li><label><input type="radio" name="cards[x][field1]" value="No" required>No</label></li>
            </ul></div></li>
        </ul>
      </form>`;
  });

  it("nombre completo, empresa, LinkedIn y el sí/no de visa; el ensayo queda para ti", () => {
    const r = llenarFormulario(document, datos(), {}, HOY);
    expect(valor("input[name='name']")).toBe("Ana Torres Ramírez");
    expect(valor("input[name='org']")).toBe("Acme Pagos");
    expect(valor("input[name='urls[LinkedIn Profile]']")).toBe("https://linkedin.com/in/anatorres");
    expect((document.querySelector("input[value='Yes']") as HTMLInputElement).checked).toBe(true);
    expect(r.find((x) => x.etiqueta === "Tell us a little about yourself.")).toMatchObject({ estado: "pendiente", requerido: true });
  });

  it("al enviar, aprende tus respuestas a preguntas propias, sin guardar datos personales", () => {
    llenarFormulario(document, datos(), {}, HOY);
    (document.querySelector("textarea") as HTMLTextAreaElement).value = "Soy backend.";
    const capt = capturarRespuestas(document);
    expect(capt.map((c) => c.etiqueta)).toEqual(["Current company", "LinkedIn Profile URL", "Tell us a little about yourself.", "Will you, now or in the future, require visa sponsorship?"]);
    expect(capt.find((c) => c.etiqueta.startsWith("Tell us"))?.valor).toBe("Soy backend.");
    expect(capt.some((c) => c.valor === "ana@ejemplo.mx")).toBe(false);
  });
});

describe("Ashby", () => {
  it("campos de sistema y preguntas por etiqueta", () => {
    document.body.innerHTML = `
      <div><input type="file"></div>
      <label for="_systemfield_name">Name</label><input id="_systemfield_name" name="_systemfield_name" required>
      <label for="_systemfield_email">Email</label><input id="_systemfield_email" name="_systemfield_email" type="email" required>
      <label for="c1">Country of Residence</label><input id="c1" name="c1" required>
      <label for="c2">Github Profile</label><input id="c2" name="c2" required>
      <label for="c3">Salary expectations</label><input id="c3" name="c3">
      <textarea id="g-recaptcha-response" name="g-recaptcha-response"></textarea>`;
    const r = llenarFormulario(document, datos(), {}, HOY);
    expect(valor("#_systemfield_name")).toBe("Ana Torres Ramírez");
    expect(valor("#c1")).toBe("Mexico");
    expect(valor("#c2")).toBe("https://github.com/anatorres");
    expect(valor("#c3")).toBe("55,000 MXN per month");
    // El captcha no se toca; el archivo sin etiqueta («autollenar desde tu CV» de Ashby) queda sin llenar.
    expect(valor("#g-recaptcha-response")).toBe("");
    expect(r.find((x) => x.etiqueta === "")).toMatchObject({ estado: "pendiente", campo: null });
  });
});

describe("envío", () => {
  it("reconoce la confirmación por URL o por mensaje", () => {
    expect(parecePostulacionEnviada("https://jobs.lever.co/acme/1/thanks", "")).toBe(true);
    expect(parecePostulacionEnviada("https://jobs.ashbyhq.com/acme/1/application", "Thanks for applying to Acme!")).toBe(true);
    expect(parecePostulacionEnviada("https://job-boards.greenhouse.io/acme/jobs/1", "Apply for this job")).toBe(false);
  });
});

describe("reconocer la vacante por la URL del formulario", () => {
  it("Greenhouse normal e incrustado, Lever y Ashby con o sin /apply", async () => {
    const { claveDePostulacion, clavesDeVacante } = await import("./url");
    expect(claveDePostulacion("https://job-boards.greenhouse.io/wizeline/jobs/7027885")).toBe("greenhouse:7027885");
    expect(claveDePostulacion("https://www.wizeline.ai/careers/job/?gh_jid=7027885")).toBe("greenhouse:7027885");
    expect(claveDePostulacion("https://boards.greenhouse.io/embed/job_app?for=wizeline&token=7027885")).toBe("greenhouse:7027885");
    expect(claveDePostulacion("https://jobs.lever.co/toptal/A9653CF8-E956-4CFC-8C27-3F27CB7307DA/apply")).toBe("lever:a9653cf8-e956-4cfc-8c27-3f27cb7307da");
    expect(claveDePostulacion("https://jobs.ashbyhq.com/supabase/23c9ce7e-6b7b-4316-8f00-8f318e902441/application")).toBe("ashby:23c9ce7e-6b7b-4316-8f00-8f318e902441");
    expect(claveDePostulacion("https://empresa.com/empleos/123/apply/")).toBe("url:empresa.com/empleos/123");
    expect(clavesDeVacante({ fuente: "greenhouse", idExterno: "wizeline/7027885", url: "https://job-boards.greenhouse.io/wizeline/jobs/7027885" })).toContain("greenhouse:7027885");
  });
});
