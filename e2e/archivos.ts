import { crc32 } from "node:zlib";

export interface Linea {
  texto: string;
  x: number;
  y: number;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/** PDF mínimo válido con texto seleccionable (Helvetica). Solo ASCII/Latin-1. */
export function crearPdf(lineas: Linea[]): Buffer {
  const contenido = lineas.map((l) => `BT /F1 11 Tf ${l.x} ${l.y} Td (${esc(l.texto)}) Tj ET`).join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(contenido, "latin1")} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

/** PDF sin texto (solo un rectángulo): simula un CV escaneado. */
export function crearPdfEscaneado(): Buffer {
  const contenido = "0.5 g 50 50 400 600 re f";
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function zip(entradas: { nombre: string; datos: Buffer }[]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { nombre, datos } of entradas) {
    const n = Buffer.from(nombre, "utf8");
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(n.length, 26);
    partes.push(local, n, datos);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(datos.length, 20);
    c.writeUInt32LE(datos.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += local.length + n.length + datos.length;
  }
  const dirCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(dirCentral.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...partes, dirCentral, fin]);
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** DOCX mínimo válido con un párrafo por línea. */
export function crearDocx(parrafos: string[]): Buffer {
  const cuerpo = parrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(p)}</w:t></w:r></w:p>`).join("");
  const enc = (s: string) => Buffer.from(s, "utf8");
  return zip([
    { nombre: "[Content_Types].xml", datos: enc('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') },
    { nombre: "_rels/.rels", datos: enc('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') },
    { nombre: "word/document.xml", datos: enc(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}</w:body></w:document>`) },
  ]);
}

export const CV_LINEAS = [
  "Ana Torres - Desarrolladora Full Stack",
  "5 anos de experiencia construyendo productos web.",
  "- Node.js, PostgreSQL, Docker y React",
  "- APIs REST con TypeScript y AWS",
  "Ingles avanzado. Liderazgo de equipos.",
];

export const OFERTA_TEXTO = `Buscamos Desarrollador/a Backend.

Requisitos:
- 3+ años de experiencia con Node.js o Python.
- Experiencia con PostgreSQL y APIs REST.
- Conocimiento de AWS y Kubernetes.
- Inglés avanzado.

Deseable:
- Experiencia con Terraform.

Salario: $55,000 MXN mensuales. Prestaciones de ley.`;

/** ODT mínimo válido con un párrafo por línea (las que empiezan con «- » van como lista). */
export function crearOdt(parrafos: string[]): Buffer {
  const cuerpo = parrafos
    .map((p) => (p.startsWith("- ") ? `<text:list><text:list-item><text:p>${xmlEsc(p.slice(2))}</text:p></text:list-item></text:list>` : `<text:p>${xmlEsc(p)}</text:p>`))
    .join("");
  const enc = (s: string) => Buffer.from(s, "utf8");
  return zip([
    { nombre: "mimetype", datos: enc("application/vnd.oasis.opendocument.text") },
    { nombre: "META-INF/manifest.xml", datos: enc('<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>') },
    { nombre: "content.xml", datos: enc(`<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${cuerpo}</office:text></office:body></office:document-content>`) },
  ]);
}

export const CV_COMPLETO = [
  "Ana Torres",
  "Desarrolladora Backend",
  "Guadalajara, México | ana.torres@correo.mx | +52 33 1234 5678",
  "Experiencia",
  "Desarrolladora Backend - Acme Pagos",
  "Ene 2021 - Presente",
  "- Diseñé la API de cobros en Node.js con TypeScript.",
  "Educación",
  "Universidad de Guadalajara",
  "Ingeniería en Computación",
  "2013 - 2017",
  "Idiomas",
  "Inglés: avanzado",
];
