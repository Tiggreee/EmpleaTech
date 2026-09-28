import { prep } from "../analisis/texto";

export const LATAM = ["MX", "GT", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "PR", "CO", "VE", "EC", "PE", "BO", "CL", "AR", "UY", "PY", "BR"];
const UE = ["DE", "FR", "ES", "IT", "PT", "NL", "BE", "LU", "IE", "AT", "DK", "SE", "FI", "PL", "CZ", "SK", "HU", "RO", "BG", "GR", "HR", "SI", "EE", "LV", "LT", "CY", "MT"];
const EUROPA = [...UE, "GB", "CH", "NO", "IS", "UA", "RS"];
const NORTEAMERICA = ["US", "CA", "MX"];
const APAC = ["AU", "NZ", "JP", "KR", "CN", "HK", "TW", "SG", "MY", "TH", "VN", "PH", "ID", "IN"];

const plegar = (s: string) => prep(s).folded.replace(/[^a-z0-9]+/g, " ").trim();

/** Códigos que Intl reconoce como región pero no son países vigentes (agrupaciones y códigos retirados). */
const NO_PAISES = new Set(["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ", "AN", "BU", "CS", "DD", "DY", "FX", "HV", "NH", "NT", "RH", "SU", "TP", "UK", "VD", "YD", "YU", "ZR"]);

/** Nombre de país (plegado, en español e inglés) → ISO-2, a partir de los datos de Unicode que trae el propio runtime. */
const NOMBRES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const idiomas = ["en", "es"].map((l) => new Intl.DisplayNames([l], { type: "region", fallback: "none" }));
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const codigo = String.fromCharCode(a, b);
      if (NO_PAISES.has(codigo)) continue;
      for (const dn of idiomas) {
        const nombre = dn.of(codigo);
        if (nombre && nombre !== codigo) out[plegar(nombre)] ??= codigo;
      }
    }
  }
  // Variantes comunes en las ofertas que no son el nombre oficial.
  const alias: Record<string, string> = {
    usa: "US", "u s a": "US", "u s": "US", eeuu: "US", "ee uu": "US", "united states of america": "US",
    uk: "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", "reino unido": "GB",
    uae: "AE", holland: "NL", holanda: "NL", "czech republic": "CZ", "south korea": "KR", korea: "KR", russia: "RU",
    "republica dominicana": "DO", "dominican republic": "DO", brasil: "BR", "ciudad de mexico": "MX", cdmx: "MX", "mexico city": "MX",
  };
  return { ...out, ...alias };
})();

/** Estados de EE. UU. escritos como «Austin, TX». */
const ESTADOS_EEUU = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);

const REGIONES: [RegExp, string[]][] = [
  [/\b(latam|latinoamerica|latin america|america latina|south america|sudamerica|central america|centroamerica)\b/, LATAM],
  [/\b(european union|union europea|eu)\b/, UE],
  [/\b(europe|europa|emea)\b/, EUROPA],
  [/\b(north america|norteamerica)\b/, NORTEAMERICA],
  [/\bamericas\b/, [...NORTEAMERICA, ...LATAM]],
  [/\b(apac|asia pacific)\b/, APAC],
];

/** Sin restricción de país: la vacante acepta gente de cualquier lugar. */
const MUNDIAL = /\b(worldwide|anywhere|global|cualquier (lugar|pais)|en todo el mundo)\b/;

export interface PaisesDeTexto {
  paises: string[];
  mundial: boolean;
}

/** «Remote - LATAM», «Mexico, Colombia», «Austin, TX», «Belgrade, Serbia», «Worldwide» → códigos ISO-2. */
export function paisesDeTexto(...textos: (string | undefined | null)[]): PaisesDeTexto {
  const out = new Set<string>();
  let mundial = false;
  for (const t of textos) {
    if (!t) continue;
    const f = ` ${plegar(t)} `;
    if (MUNDIAL.test(f)) mundial = true;
    for (const [re, lista] of REGIONES) if (re.test(f)) lista.forEach((p) => out.add(p));
    // Frases de hasta 4 palabras: «el salvador», «united arab emirates», «papua new guinea».
    const palabras = f.trim().split(" ");
    for (let i = 0; i < palabras.length; i++) {
      for (let n = 4; n >= 1; n--) {
        const frase = palabras.slice(i, i + n).join(" ");
        if (NOMBRES[frase]) {
          out.add(NOMBRES[frase]);
          i += n - 1; // «papua new guinea» no debe contar también «guinea».
          break;
        }
      }
    }
    for (const m of t.matchAll(/,\s*([A-Z]{2})\b/g)) if (ESTADOS_EEUU.has(m[1])) out.add("US");
  }
  return { paises: [...out].sort(), mundial: mundial && out.size === 0 };
}
