import type { ContextoFuente } from "@/core/vacantes/fuentes";

/**
 * Respuestas fijas con la forma de cada API real. Solo se usan con EMPLEATECH_FUENTES_FALSAS=1 (pruebas e2e), para
 * no depender de internet ni gastar el límite diario de consultas de las plataformas.
 */
const hoy = () => Math.floor(Date.now() / 1000);

const RESPUESTAS: [RegExp, () => unknown][] = [
  [
    /getonbrd\.com/,
    () => ({
      data: [
        {
          id: "backend-developer-nodo-mx-1",
          attributes: {
            title: "Backend Developer",
            description: "<p>Buscamos backend con Node.js, PostgreSQL, Docker y APIs REST. Inglés avanzado.</p>",
            remote: true,
            remote_modality: "fully_remote",
            countries: ["Mexico"],
            category_name: "Programming",
            min_salary: 3000,
            max_salary: 4200,
            published_at: hoy() - 86_400,
            company: { data: { attributes: { name: "Nodo Pagos" } } },
          },
          links: { public_url: "https://www.getonbrd.com/jobs/backend-developer-nodo-mx-1" },
        },
      ],
    }),
  ],
  [
    /remotive\.com/,
    () => ({
      jobs: [
        {
          id: 101,
          url: "https://remotive.com/remote-jobs/software-dev/backend-engineer-101",
          title: "Backend Engineer",
          company_name: "Estafa Rápida",
          category: "Software Development",
          tags: ["node"],
          candidate_required_location: "LATAM",
          salary: "",
          description: "<p>Node.js y PostgreSQL. Requiere inversión inicial de $2,000 para tu kit de trabajo. Solo comisiones.</p>",
          publication_date: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        },
        {
          id: 102,
          url: "https://remotive.com/remote-jobs/other/chef-102",
          title: "Chef",
          company_name: "Cocina Remota",
          category: "All others",
          tags: [],
          candidate_required_location: "Worldwide",
          salary: "",
          description: "<p>Cocina.</p>",
          publication_date: new Date().toISOString(),
        },
      ],
    }),
  ],
  [/remoteok\.com/, () => [{ legal: "API Terms of Service" }]],
  [/jobicy\.com/, () => ({ jobs: [] })],
  [/himalayas\.app/, () => ({ jobs: [] })],
  [/arbeitnow\.com/, () => ({ data: [] })],
  [
    /greenhouse\.io\/v1\/boards\/wizeline\//,
    () => ({
      jobs: [
        {
          id: 555,
          title: "Senior Backend Developer (Node.js)",
          company_name: "Wizeline",
          absolute_url: "https://job-boards.greenhouse.io/wizeline/jobs/555",
          location: { name: "Remote, Mexico" },
          offices: [{ name: "Mexico" }],
          content: "&lt;p&gt;Node.js, TypeScript, PostgreSQL, Docker y AWS.&lt;/p&gt;",
          first_published: new Date(Date.now() - 86_400_000).toISOString(),
          departments: [{ name: "Engineering" }],
        },
      ],
    }),
  ],
  [/greenhouse\.io|lever\.co/, () => ({ jobs: [] })],
  [/ashbyhq\.com/, () => ({ jobs: [] })],
];

export function contextoFalso(ahora = new Date()): ContextoFuente {
  return {
    ahora,
    claves: {},
    http: {
      async json(url) {
        const r = RESPUESTAS.find(([re]) => re.test(url));
        if (!r) throw new Error("respondió 404");
        return r[1]();
      },
    },
  };
}
