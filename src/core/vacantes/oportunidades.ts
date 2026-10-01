import { SKILLS } from "../analisis/habilidades";
import type { Respuestas } from "../perfil/respuestas";
import { puntuar, type VacantePuntuada } from "./busqueda";

/**
 * Qué te subiría más el puntaje: las habilidades que te piden las vacantes de empleo y tu CV no muestra, con cuánto
 * subirían esas vacantes si la tuvieras (se vuelven a puntuar con el mismo motor, no es una estimación aparte).
 *
 * Sirve para dos decisiones distintas: si ya la dominas, agregarla a tu CV con un ejemplo; si no, aprenderla.
 */

export interface Oportunidad {
  id: string;
  label: string;
  /** Habilidad blanda: no se «estudia», se demuestra en el CV con un ejemplo. */
  blanda: boolean;
  /** En cuántas vacantes falta (o solo se acerca por una habilidad parecida). */
  vacantes: number;
  /** Cuánto subiría, en promedio, el puntaje de esas vacantes. */
  puntos: number;
  /** Cuántas pasarían de menos de 90 a 90 o más. */
  a90: number;
  /** Hasta 3 vacantes donde la piden: «Puesto — Empresa». */
  ejemplos: string[];
  recurso?: { nombre: string; url: string };
}

/** Por dónde empezar: documentación y guías oficiales, gratis. */
export const RECURSOS: Record<string, { nombre: string; url: string }> = {
  microservicios: { nombre: "Spring: microservicios", url: "https://spring.io/microservices" },
  uxui: { nombre: "web.dev: Learn Design", url: "https://web.dev/learn/design" },
  html: { nombre: "MDN: HTML", url: "https://developer.mozilla.org/es/docs/Web/HTML" },
  css: { nombre: "MDN: CSS", url: "https://developer.mozilla.org/es/docs/Web/CSS" },
  jira: { nombre: "Guías de Jira", url: "https://www.atlassian.com/software/jira/guides" },
  kubernetes: { nombre: "Tutoriales de Kubernetes", url: "https://kubernetes.io/docs/tutorials/" },
  docker: { nombre: "Docker: primeros pasos", url: "https://docs.docker.com/get-started/" },
  aws: { nombre: "AWS: primeros pasos", url: "https://aws.amazon.com/getting-started/" },
  azure: { nombre: "Microsoft Learn: Azure", url: "https://learn.microsoft.com/training/azure/" },
  gcp: { nombre: "Google Cloud: capacitación", url: "https://cloud.google.com/learn/training" },
  python: { nombre: "Tutorial oficial de Python", url: "https://docs.python.org/es/3/tutorial/" },
  go: { nombre: "Tour de Go", url: "https://go.dev/tour/" },
  graphql: { nombre: "GraphQL: aprende", url: "https://graphql.org/learn/" },
  angular: { nombre: "Tutoriales de Angular", url: "https://angular.dev/tutorials" },
  terraform: { nombre: "Tutoriales de Terraform", url: "https://developer.hashicorp.com/terraform/tutorials" },
  cicd: { nombre: "GitHub Actions", url: "https://docs.github.com/actions" },
  agile: { nombre: "La Guía de Scrum", url: "https://scrumguides.org/scrum-guide.html" },
  kotlin: { nombre: "Kotlin: primeros pasos", url: "https://kotlinlang.org/docs/getting-started.html" },
  csharp: { nombre: "Microsoft Learn: C#", url: "https://learn.microsoft.com/dotnet/csharp/" },
  dotnet: { nombre: "Microsoft Learn: .NET", url: "https://learn.microsoft.com/dotnet/" },
};

/** Puntaje a partir del cual una vacante cuenta como «cerca». */
export const CERCA = 50;

export function oportunidades(items: VacantePuntuada[], cvTexto: string, respuestas: Respuestas, ahora: Date, max = 8): Oportunidad[] {
  // Solo empleos (los proyectos freelance piden cosas muy dispersas) y nada que el radar marque como riesgoso.
  const empleos = items
    .filter((i) => i.vacante.tipo !== "proyecto" && i.resumen.riesgo !== "riesgo" && i.prioridad.valor !== null)
    .sort((a, b) => (b.prioridad.valor ?? 0) - (a.prioridad.valor ?? 0));
  // Las que tienes cerca (50+): lo que les falta es lo que de verdad te acerca. Una de Ruby en la que sacas 20 no
  // debe recomendarte aprender Ruby. Si hay pocas, se toman las 10 mejores.
  const cercanas = empleos.filter((i) => (i.prioridad.valor ?? 0) >= CERCA);
  const consideradas = cercanas.length >= 10 ? cercanas : empleos.slice(0, 10);
  const faltan = new Map<string, VacantePuntuada[]>();
  for (const it of consideradas) {
    for (const label of new Set([...it.resumen.brechas, ...it.resumen.transferibles])) {
      const lista = faltan.get(label) ?? [];
      lista.push(it);
      faltan.set(label, lista);
    }
  }

  const resultado: Oportunidad[] = [];
  const candidatas = [...faltan].sort((a, b) => b[1].length - a[1].length).slice(0, max * 3);
  // El puntaje actual de cada vacante se calcula una sola vez (sin el ajuste por aprendizaje, igual que el de prueba).
  const base = new Map<VacantePuntuada, number>();
  const actual = (it: VacantePuntuada) => {
    let v = base.get(it);
    if (v === undefined) base.set(it, (v = puntuar(it.vacante, cvTexto, respuestas, ahora).prioridad.valor ?? 0));
    return v;
  };
  for (const [label, lista] of candidatas) {
    const skill = SKILLS.find((k) => k.label === label);
    // Los idiomas se declaran en Respuestas; no se «agregan» como habilidad.
    if (!skill || skill.cat === "idioma" || !skill.aliases.length) continue;
    const cvConElla = `${cvTexto}\n${skill.aliases[0]}`;
    let suma = 0;
    let a90 = 0;
    for (const it of lista) {
      const antes = actual(it);
      const despues = puntuar(it.vacante, cvConElla, respuestas, ahora).prioridad.valor ?? 0;
      suma += Math.max(0, despues - antes);
      if (antes < 90 && despues >= 90) a90++;
    }
    const puntos = Math.round(suma / lista.length);
    if (puntos <= 0) continue;
    resultado.push({
      id: skill.id,
      label,
      blanda: skill.cat === "blanda",
      vacantes: lista.length,
      puntos,
      a90,
      ejemplos: lista.slice(0, 3).map((it) => `${it.vacante.titulo} — ${it.vacante.empresa}`),
      recurso: RECURSOS[skill.id],
    });
  }
  // Primero lo que más mueve en total: muchas vacantes por pocos puntos puede valer más que una por muchos.
  return resultado.sort((a, b) => b.a90 - a.a90 || b.vacantes * b.puntos - a.vacantes * a.puntos).slice(0, max);
}
