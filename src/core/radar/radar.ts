import { prep, recortar, wordCount } from "../analisis/texto";

export type Severidad = "alta" | "media" | "baja";

export interface Alerta {
  id: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  evidencia?: string;
}

export type Nivel = "limpia" | "precaucion" | "riesgo";

export interface Diagnostico {
  nivel: Nivel;
  resumen: string;
  alertas: Alerta[];
}

interface Regla {
  id: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  re: RegExp;
  /** Si la oración de la coincidencia también cumple esto, no es alerta (p. ej. cuando quien paga es la empresa). */
  excepto?: RegExp;
}

/** La empresa asume el costo: «la empresa cubre el uniforme», «a cargo de la empresa», «sin costo». */
const PAGA_LA_EMPRESA =
  /\b(?:la empresa|el empleador|la compania|nosotros)\s+(?:cubre|absorbe|paga|se encarga|asume)|nos\s+encargamos|\b(?:cubrimos|absorbemos|pagamos|asumimos|proporcionamos|otorgamos)\b|(?:a cargo|por cuenta)\s+de\s+la\s+empresa|sin\s+costo|gratuit[oa]s?|\b(?:company|employer|we)\s+(?:pays?|covers?)\b|free\s+of\s+charge|at\s+no\s+cost/;

/** La oración (entre puntos o saltos de línea) que contiene la posición indicada. */
function oracionEn(texto: string, i: number, largo: number): string {
  const ini = Math.max(texto.lastIndexOf(".", i - 1), texto.lastIndexOf("\n", i - 1)) + 1;
  const fines = [texto.indexOf(".", i + largo), texto.indexOf("\n", i + largo)].filter((n) => n >= 0);
  return texto.slice(ini, fines.length ? Math.min(...fines) : texto.length);
}

const REGLAS: Regla[] = [
  {
    id: "pago-por-postular",
    severidad: "alta",
    titulo: "Te piden dinero para empezar",
    detalle: "Una empresa legítima no cobra por contratarte, capacitarte o darte material. Es la señal más común de fraude laboral.",
    // Incluye los cobros típicos de México: examen médico o psicométrico, uniforme, gafete, papelería, «apartar tu lugar» o depósito en OXXO.
    re: /(?:pago|cuota|costo|cobro|deposito|anticipo)\s+(?:inicial|de inscripcion|de capacitacion|por capacitacion|de registro|por material|para (?:iniciar|empezar|comenzar|apartar)|(?:de|por|del)\s+(?:(?:tu|el|los|la)\s+)?(?:examen(?:es)?\s+(?:medico|psicometrico)|estudio socioeconomico|uniforme|gafete|credencial|kit|papeleria|curso de induccion|apartado))|(?:pagar|cubrir|costear)\s+(?:(?:tu|el|los|la|su)\s+)?(?:uniforme|gafete|credencial|kit|examen medico|curso de induccion|capacitacion|papeleria)|apart(?:ar|a|e)\s+tu\s+(?:lugar|vacante)|deposit\w*\s+en\s+(?:un\s+)?oxxo|inversion\s+inicial|se requiere\s+inversion|(?:training|application|registration|starter kit|background check)\s+fee|(?:buy|purchase)\s+(?:your own\s+)?(?:equipment|starter kit)/,
    excepto: PAGA_LA_EMPRESA,
  },
  {
    id: "solo-comision",
    severidad: "alta",
    titulo: "Ingreso solo por comisión",
    detalle: "Sin sueldo base, el riesgo económico recae en ti. Verifica el esquema por escrito antes de aceptar.",
    re: /(?:solo|unicamente|exclusivamente|100\s*%)\s+(?:a\s+)?comision(?:es)?|ingresos?\s+ilimitados?|commission[- ]only|100\s*%\s*commission|unlimited\s+earning/,
  },
  {
    id: "tramite-visa",
    severidad: "alta",
    titulo: "Cobran por trámites de visa o trabajo en el extranjero",
    detalle: "Las ofertas para trabajar en Canadá o Estados Unidos que piden dinero por la visa, el permiso o la «colocación» son un fraude frecuente en México. Programas legítimos como el de Trabajadores Agrícolas Temporales México-Canadá se gestionan en el Servicio Nacional de Empleo, sin intermediarios que cobren.",
    // El cobro tiene que recaer en quien postula: «pago semanal» junto a «apoyo con visa» no es alerta.
    re: /(?:costo|pago|anticipo|deposito|cuota|cobro)\s+(?:de|por|del|para)\s+(?:(?:la|el|tu|su)\s+)?(?:tramite\s+(?:de\s+(?:la\s+|tu\s+|su\s+)?)?(?:visa|permiso|migratorio)|visa|permiso de trabajo|colocacion)|(?:visa|permiso de trabajo|work permit)[^.\n]{0,60}(?:tiene\s+(?:un\s+)?costo|con\s+costo|debes\s+(?:pagar|depositar|cubrir)|anticipo|\bcuota\b|(?<!no\s)\bfee\b)|(?:visa|work permit|processing|placement)\s+fee/,
    excepto: PAGA_LA_EMPRESA,
  },
  {
    id: "mula",
    severidad: "alta",
    titulo: "Te usarían para mover dinero o paquetes",
    detalle: "Recibir depósitos o paquetes a tu nombre para reenviarlos es un esquema conocido de lavado o fraude: quien cae en él puede terminar con la cuenta bloqueada o con responsabilidad legal.",
    re: /(?:recibir|recibe|reenviar|reenvia|reexpedir)\s+(?:paquetes|mercancia|transferencias|depositos|dinero|pagos)[^.\n]{0,40}(?:en tu (?:casa|domicilio|cuenta)|a tu nombre)|(?:usar|prestar|presta|usa)\s+tu\s+cuenta\s+(?:bancaria|de banco)|reshipp?ing|package\s+(?:forwarding|reshipping)|(?:receive|forward)\s+(?:packages|payments|funds)[^.\n]{0,30}(?:your (?:home|address|account)|personal account)|use your (?:own )?bank account/,
  },
  {
    id: "sin-sueldo",
    severidad: "alta",
    titulo: "Puesto sin remuneración",
    detalle: "El texto indica trabajo sin pago. Si no es voluntariado o prácticas reguladas, evítalo.",
    re: /sin\s+(?:sueldo|salario|remuneracion|pago)\b|no\s+remunerad[oa]|\bunpaid\b|trabajo\s+voluntario|volunteer\s+position/,
  },
  {
    id: "sin-prestaciones",
    severidad: "media",
    titulo: "Dice que no hay prestaciones, IMSS o contrato",
    detalle: "En México, un trabajo subordinado da derecho a prestaciones mínimas (aguinaldo, vacaciones y prima vacacional) y al alta en el IMSS (Ley Federal del Trabajo, arts. 76, 80 y 87; Ley del Seguro Social, art. 15). Pregunta por escrito el esquema de contratación.",
    re: /sin\s+(?:prestaciones|imss|seguro social|contrato)\b|no\s+(?:hay|se dan|se otorgan|incluye|contamos con|ofrecemos)\s+(?:prestaciones|imss|seguro social|contrato)\b|sin\s+alta\s+(?:en|ante)\s+(?:el\s+)?imss|no\s+(?:te\s+)?damos\s+de\s+alta/,
  },
  {
    id: "multinivel",
    severidad: "media",
    titulo: "Parece venta multinivel",
    detalle: "Si el ingreso depende de reclutar a más personas o de comprar producto por adelantado, no es un empleo: es un negocio donde el riesgo lo pones tú. Pregunta qué parte del ingreso viene de ventas reales a clientes.",
    re: /multinivel|network marketing|mercadeo en red|red de mercadeo|(?:se|ser|sea)\s+tu\s+propio\s+jefe|be your own boss|arma\s+tu\s+(?:propio\s+)?equipo|invita\s+a\s+(?:tus\s+)?(?:amigos|familiares|conocidos)|ingresos?\s+pasivos?|recruit\s+(?:your\s+)?friends/,
  },
  {
    id: "ganancia-facil",
    severidad: "media",
    titulo: "Promete ganancias altas sin experiencia",
    detalle: "Cifras llamativas «desde casa» o «desde tu celular» sin experiencia ni requisitos suelen ser anzuelo de fraudes o de esquemas de reclutamiento. Pide el nombre legal de la empresa y verifica que exista.",
    re: /(?:gana|ganar|ganaras|ganancias?|ingresos?)\s+(?:de\s+)?(?:hasta\s+|desde\s+|mas de\s+)?\$?\s?\d[\d,.]*\s*(?:mil\s*)?(?:pesos\s*|mxn\s*|usd\s*)?(?:a la |por |al |cada )?(?:semana|semanales|dia|diarios?)\b[^.\n]{0,80}(?:sin experiencia|desde (?:casa|tu celular))|(?:sin experiencia|desde (?:casa|tu celular))[^.\n]{0,80}(?:gana|ganar|ganancias?|ingresos?)\s+(?:de\s+)?(?:hasta\s+)?\$?\s?\d|trabaja\s+desde\s+tu\s+celular|solo\s+necesitas\s+(?:un\s+)?(?:celular|telefono)|(?:earn|make)\s+\$?\d[\d,.]*\s*k?\s*(?:per|a|\/)\s*(?:week|day)[^.\n]{0,60}(?:no experience|from home)/,
  },
  {
    id: "datos-sensibles",
    severidad: "alta",
    titulo: "Piden datos sensibles desde el primer contacto",
    detalle: "No compartas CURP, INE, cuentas bancarias, contraseñas ni documentos oficiales antes de tener una oferta formal verificada.",
    re: /(?:envi\w+|manda\w*|proporcion\w+|comparte\w*|adjunt\w+|send|provide|share|submit)[^.\n]{0,60}\b(?:curp|rfc|ine|ssn|social security|nss|cuenta bancaria|bank account|tarjeta|credit card|passport|pasaporte|clabe|nip|contrasena|password|codigo de (?:verificacion|seguridad|acceso)|verification code)\b/,
  },
  {
    id: "discriminacion",
    severidad: "media",
    titulo: "Requisitos posiblemente discriminatorios",
    detalle: "Pedir «buena presencia», sexo, rango de edad, estado civil o un certificado de no embarazo podría contravenir la Ley Federal del Trabajo (art. 133, fracciones I y XIV).",
    re: /buena\s+presencia|(?:solo|unicamente|exclusivamente)\s+(?:mujeres|hombres|damas|caballeros|solter[oa]s|casad[oa]s)|\bsexo\s*:?\s*(?:masculino|femenino|hombre|mujer)\b|estado\s+civil\s*:?\s*(?:solter|casad)|\bedad\s*:?\s*(?:de|entre)?\s*\d{2}\s*(?:a|-|y)\s*\d{2}|rango\s+de\s+edad|no\s+embarazad|(?:certificado|prueba|examen)\s+de\s+(?:no\s+)?embarazo|sin\s+hijos|tez\s+(?:blanca|clara)|complexion\s+delgada|\bages?\s*(?:between\s*)?\d{2}\s*(?:-|to|and)\s*\d{2}\b|must\s+be\s+(?:under|younger than)\s+\d{2}/,
  },
  {
    id: "familia-presion",
    severidad: "media",
    titulo: "Cultura de «familia» o alta presión",
    detalle: "Frases como estas suelen justificar sobrecarga y límites difusos. Pregunta por horarios, rotación y cómo se mide el desempeño.",
    re: /somos\s+una\s+familia|we(?:'|’)?re\s+(?:like\s+)?a\s+family|we are\s+(?:like\s+)?a\s+family|work hard,?\s*play hard|ponte\s+la\s+camiseta/,
  },
  {
    id: "mensajeria",
    severidad: "media",
    titulo: "Contacto solo por mensajería",
    detalle: "Verifica que la empresa exista (sitio, RFC/registro, reseñas) y que haya un canal formal antes de avanzar.",
    re: /(?:contacto|contactanos|escribe(?:nos)?|mensaje|informes|interesad[oa]s|mas info(?:rmacion)?|apply|contact)[^.\n]{0,40}\b(?:whatsapp|whats|telegram|signal|messenger|inbox)\b|wa\.me\//,
  },
  {
    id: "urgencia",
    severidad: "baja",
    titulo: "Presión de urgencia",
    detalle: "La urgencia artificial reduce tu tiempo para verificar. Tómate el tiempo de investigar.",
    re: /(?:contratacion|incorporacion|inicio)\s+inmediat[ao]|\burgente\b|immediate(?:ly)?\s+(?:start|hire|hiring)|hiring\s+urgently|start\s+(?:asap|immediately)|\basap\b/,
  },
  {
    id: "bajo-presion",
    severidad: "baja",
    titulo: "Piden «trabajo bajo presión»",
    detalle: "Es una frase muy común en ofertas de México y por sí sola no es mala señal. Pregunta qué la provoca: temporadas pico, falta de personal o metas poco realistas.",
    re: /bajo\s+presion|under\s+pressure/,
  },
  {
    id: "cliche",
    severidad: "baja",
    titulo: "Jerga de «rockstar / ninja»",
    detalle: "No es grave por sí sola, pero suele acompañar descripciones vagas o sobrecargadas.",
    re: /\b(?:rock ?star|ninja|guru|unicornio|unicorn|jedi|wizard)\b/,
  },
  {
    id: "multitarea",
    severidad: "baja",
    titulo: "Funciones difusas",
    detalle: "«Otras funciones que se requieran» o «usar muchos sombreros» puede ampliar tu carga sin ampliar tu sueldo. Pide el alcance por escrito.",
    re: /hombre\s+orquesta|wear\s+(?:many|multiple)\s+hats|otras\s+funciones\s+(?:que|segun)\s+se\s+requieran|other\s+duties\s+as\s+assigned|y\s+las\s+demas\s+que\s+(?:se\s+)?asignen/,
  },
];

/** Tecnología → año de su primera versión estable. */
const TECNOLOGIAS: { nombre: string; re: string; desde: number }[] = [
  { nombre: "React", re: "react(?:\\.?js)?", desde: 2013 },
  { nombre: "Kubernetes", re: "kubernetes|k8s", desde: 2014 },
  { nombre: "Docker", re: "docker", desde: 2013 },
  { nombre: "TypeScript", re: "typescript", desde: 2012 },
  { nombre: "Vue", re: "vue(?:\\.?js)?", desde: 2014 },
  { nombre: "Next.js", re: "next\\.?js", desde: 2016 },
  { nombre: "Flutter", re: "flutter", desde: 2017 },
  { nombre: "Tailwind", re: "tailwind(?:css)?", desde: 2019 },
  { nombre: "SwiftUI", re: "swiftui", desde: 2019 },
  { nombre: "Rust", re: "rust", desde: 2015 },
  { nombre: "LangChain", re: "langchain", desde: 2022 },
];

const RE_SALARIO_NUM = /(?:\$|usd|mxn|eur)\s?\d|\d[\d.,]*\s?(?:k\b|mil\b|mxn|usd|eur|pesos|dolares|dollars)|(?:sueldo|salario|pago|compensacion|salary)\s*(?:mensual|semanal|quincenal|base|neto|bruto)?\s*(?:de\s*)?:?\s*(?:desde\s*|hasta\s*|entre\s*)?\d{1,3}(?:[.,]\d{3})+/;
const RE_SALARIO_VAGO = /(?:sueldo|salario|compensacion|salary)\s+(?:competitiv[oa]|acorde|a tratar|negociable)|competitive\s+(?:salary|pay|compensation)|a\s+tratar\s+en\s+entrevista/;

const ORDEN: Record<Severidad, number> = { alta: 0, media: 1, baja: 2 };

/**
 * `omitir`: ids de reglas que no aplican en ese contexto. La búsqueda omite «sin-rango-salarial»: casi ninguna oferta
 * internacional publica salario, así que marcarla en todas no ordena nada y solo baja todos los puntajes por igual.
 */
export function detectarAlertas(oferta: string, ahora: Date = new Date(), opciones: { omitir?: readonly string[] } = {}): Diagnostico {
  const { orig, folded } = prep(oferta);
  const alertas: Alerta[] = [];
  const omitir = new Set(opciones.omitir ?? []);

  if (folded.trim()) {
    for (const r of REGLAS) {
      if (omitir.has(r.id)) continue;
      const todas = new RegExp(r.re.source, "g");
      for (const m of folded.matchAll(todas)) {
        if (r.excepto?.test(oracionEn(folded, m.index, m[0].length))) continue;
        alertas.push({ id: r.id, severidad: r.severidad, titulo: r.titulo, detalle: r.detalle, evidencia: recortar(orig.slice(m.index, m.index + m[0].length), 100) });
        break;
      }
    }

    for (const t of TECNOLOGIAS) {
      const m = new RegExp(`(\\d{1,2})\\s*\\+?\\s*(?:anos|years|yrs)[^.\\n]{0,50}?\\b(?:${t.re})\\b`).exec(folded);
      if (!m) continue;
      const pedidos = Number(m[1]);
      const maximo = ahora.getFullYear() - t.desde;
      if (pedidos > maximo) {
        alertas.push({
          id: `anios-imposibles-${t.nombre.toLowerCase()}`,
          severidad: "media",
          titulo: `Piden ${pedidos} años en ${t.nombre}`,
          detalle: `${t.nombre} salió en ${t.desde}: como máximo existen ~${maximo} años de experiencia posible. Suele indicar que quien redactó la oferta no conoce el puesto.`,
          evidencia: recortar(orig.slice(m.index, m.index + m[0].length), 100),
        });
      }
    }

    if (!omitir.has("sin-rango-salarial") && wordCount(oferta) >= 40 && !RE_SALARIO_NUM.test(folded)) {
      const vago = RE_SALARIO_VAGO.exec(folded);
      alertas.push({
        id: "sin-rango-salarial",
        severidad: "media",
        titulo: "No declara rango salarial",
        detalle: "Sin cifra no puedes comparar ni negociar con datos. Pregunta el rango antes de invertir tiempo en entrevistas.",
        evidencia: vago ? recortar(orig.slice(vago.index, vago.index + vago[0].length), 100) : undefined,
      });
    }
  }

  alertas.sort((a, b) => ORDEN[a.severidad] - ORDEN[b.severidad]);

  const altas = alertas.filter((a) => a.severidad === "alta").length;
  const medias = alertas.filter((a) => a.severidad === "media").length;
  let nivel: Nivel = "limpia";
  let resumen = "No detectamos señales de alerta conocidas. Aun así, verifica a la empresa por tu cuenta.";
  if (altas > 0) {
    nivel = "riesgo";
    resumen = "Hay señales graves. No avances ni compartas datos hasta verificar a la empresa.";
  } else if (medias >= 2 || (medias >= 1 && alertas.length >= 3)) {
    nivel = "precaucion";
    resumen = "Varias señales de precaución. Investiga a la empresa y aclara estos puntos antes de avanzar.";
  } else if (alertas.length > 0) {
    nivel = "precaucion";
    resumen = "Hay detalles a tener en cuenta; no son concluyentes.";
  }

  return { nivel, resumen, alertas };
}
