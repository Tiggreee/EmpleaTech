import { describe, expect, it } from "vitest";
import { detectarAlertas } from "./radar";
import { OFERTA_EJEMPLO } from "../analisis/ejemplo";

const AHORA = new Date("2026-09-19T12:00:00Z");
const ids = (t: string) => detectarAlertas(t, AHORA).alertas.map((a) => a.id);

describe("detectarAlertas", () => {
  it("detecta cobro para empezar", () => {
    expect(ids("Únete ya. Requiere inversión inicial de $2,000 en tu kit.")).toContain("pago-por-postular");
    expect(ids("Application fee of $50 required.")).toContain("pago-por-postular");
  });

  it("detecta solo comisión e ingresos ilimitados", () => {
    expect(ids("Ganancias 100% comisiones, ingresos ilimitados")).toContain("solo-comision");
    expect(ids("This is a commission-only role")).toContain("solo-comision");
  });

  it("detecta petición de datos sensibles pero no la mención inocente de RFC", () => {
    expect(ids("Envía tu CURP y tu INE por WhatsApp para agilizar.")).toContain("datos-sensibles");
    expect(ids("Conocimiento del RFC 2616 y protocolos HTTP.")).not.toContain("datos-sensibles");
  });

  it("detecta discriminación", () => {
    expect(ids("Requisito: buena presencia, edad de 20 a 30 años")).toContain("discriminacion");
  });

  it("detecta años imposibles de experiencia", () => {
    const d = detectarAlertas("Requisitos: 15 años de experiencia en Kubernetes y liderazgo.", AHORA);
    expect(d.alertas.some((a) => a.id === "anios-imposibles-kubernetes")).toBe(true);
    const ok = detectarAlertas("Requisitos: 5 años de experiencia en Kubernetes.", AHORA);
    expect(ok.alertas.some((a) => a.id.startsWith("anios-imposibles"))).toBe(false);
  });

  it("marca la ausencia de rango salarial solo en ofertas de longitud razonable", () => {
    expect(ids(OFERTA_EJEMPLO)).toContain("sin-rango-salarial");
    expect(ids("Buscamos alguien.")).not.toContain("sin-rango-salarial");
    expect(ids(`${OFERTA_EJEMPLO}\nSalario: $45,000 MXN mensuales`)).not.toContain("sin-rango-salarial");
  });

  it("una alerta alta eleva el nivel a riesgo", () => {
    expect(detectarAlertas("Trabajo sin sueldo, aprenderás mucho.", AHORA).nivel).toBe("riesgo");
  });

  it("los resultados salen ordenados por severidad", () => {
    const d = detectarAlertas("Somos una familia. Es un puesto sin sueldo base. Ninja wanted. Necesitamos contratación inmediata.", AHORA);
    const orden = d.alertas.map((a) => a.severidad);
    expect(orden).toEqual([...orden].sort((a, b) => ["alta", "media", "baja"].indexOf(a) - ["alta", "media", "baja"].indexOf(b)));
  });

  it("texto vacío no genera alertas", () => {
    expect(detectarAlertas("", AHORA)).toMatchObject({ nivel: "limpia", alertas: [] });
  });
});

describe("patrones de México y LatAm", () => {
  it("detecta cobros disfrazados de trámite de contratación", () => {
    expect(ids("Antes de tu primer día hay un pago de examen médico de $350.")).toContain("pago-por-postular");
    expect(ids("Deberás pagar tu uniforme y gafete al ingresar.")).toContain("pago-por-postular");
    expect(ids("Aparta tu lugar con un depósito en OXXO.")).toContain("pago-por-postular");
    expect(ids("Costo del curso de inducción: $500.")).toContain("pago-por-postular");
  });

  it("no confunde prestaciones o uniformes gratuitos con un cobro", () => {
    expect(ids("Uniformes sin costo, pago semanal por depósito a tu cuenta.")).not.toContain("pago-por-postular");
    expect(ids("La empresa cubre el costo del uniforme y del examen médico.")).not.toContain("pago-por-postular");
    expect(ids("Nos encargamos de cubrir tu capacitación.")).not.toContain("pago-por-postular");
  });

  it("si una oración es de la empresa y otra cobra al candidato, sí alerta", () => {
    expect(ids("La empresa cubre tu seguro. Deberás pagar tu uniforme el primer día.")).toContain("pago-por-postular");
  });

  it("no alerta cuando la empresa absorbe la visa ni por el pago de cobranza", () => {
    expect(ids("La empresa absorbe el costo de tu visa y el vuelo.")).not.toContain("tramite-visa");
    expect(ids("Ejecutivo de cobranza: pago por gestión realizada y bono por recuperación.")).not.toContain("tramite-visa");
  });

  it("no toma tareas normales como petición de datos sensibles", () => {
    expect(ids("Funciones: envío de estado de cuenta a clientes.")).not.toContain("datos-sensibles");
    expect(ids("Provide token-based authentication for our APIs.")).not.toContain("datos-sensibles");
  });

  it("detecta cobros por visa o colocación en el extranjero, pero no el apoyo con visa", () => {
    expect(ids("Trabajo en Canadá. La visa de trabajo tiene un costo de $8,000 que se paga por adelantado.")).toContain("tramite-visa");
    expect(ids("Anticipo para el trámite de tu permiso de trabajo en Estados Unidos.")).toContain("tramite-visa");
    expect(ids("Pago semanal y apoyo para trámite de visa a cargo de la empresa.")).not.toContain("tramite-visa");
    expect(ids("Visa sponsorship available, no fee for candidates.")).not.toContain("tramite-visa");
  });

  it("detecta esquemas de mula de dinero o paquetes, no puestos de almacén", () => {
    expect(ids("Solo necesitas recibir paquetes en tu casa y reenviarlos.")).toContain("mula");
    expect(ids("Buscamos gente que pueda recibir transferencias a tu nombre.")).toContain("mula");
    expect(ids("Package reshipping assistant, work from home.")).toContain("mula");
    expect(ids("Almacenista: recibir mercancía, acomodo y control de inventarios.")).not.toContain("mula");
  });

  it("detecta falta de prestaciones de ley o IMSS", () => {
    expect(ids("Pago por día, sin prestaciones.")).toContain("sin-prestaciones");
    expect(ids("No hay IMSS por el momento.")).toContain("sin-prestaciones");
    expect(ids("Prestaciones de ley y superiores, alta en el IMSS desde el primer día.")).not.toContain("sin-prestaciones");
  });

  it("detecta multinivel y ganancias fáciles", () => {
    expect(ids("Sé tu propio jefe, arma tu equipo y genera ingresos pasivos.")).toContain("multinivel");
    expect(ids("Gana hasta $5,000 semanales desde casa, sin experiencia.")).toContain("ganancia-facil");
    expect(ids("Trabaja desde tu celular en tus tiempos libres.")).toContain("ganancia-facil");
    expect(ids("Buscamos contador con 3 años de experiencia, sueldo de $18,000 mensuales.")).not.toContain("ganancia-facil");
  });

  it("detecta discriminación con la redacción típica de las bolsas mexicanas", () => {
    expect(ids("Sexo: femenino. Edad: 25 a 35 años.")).toContain("discriminacion");
    expect(ids("Estado civil: soltera.")).toContain("discriminacion");
    expect(ids("Presentar certificado de no embarazo.")).toContain("discriminacion");
    expect(ids("Sexo: indistinto. Escolaridad: licenciatura.")).not.toContain("discriminacion");
  });

  it("detecta el robo de cuentas por código de verificación", () => {
    expect(ids("Para confirmar tu entrevista mándanos el código de verificación que te llegó por SMS.")).toContain("datos-sensibles");
  });

  it("reconoce contacto por mensajería con redacción local", () => {
    expect(ids("Interesados mandar mensaje por WhatsApp.")).toContain("mensajeria");
    expect(ids("Informes: wa.me/5215512345678")).toContain("mensajeria");
  });

  it("«trabajo bajo presión» es una señal baja, no media", () => {
    const d = detectarAlertas("Tolerancia al trabajo bajo presión.", AHORA);
    expect(d.alertas.find((a) => a.id === "bajo-presion")?.severidad).toBe("baja");
    expect(d.alertas.some((a) => a.id === "familia-presion")).toBe(false);
  });

  it("reconoce un sueldo escrito sin signo de pesos", () => {
    const oferta = `${OFERTA_EJEMPLO}\nSueldo mensual: 18,000 a 22,000 brutos.`;
    expect(ids(oferta)).not.toContain("sin-rango-salarial");
  });
});
