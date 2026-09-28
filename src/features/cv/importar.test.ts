import { describe, expect, it } from "vitest";
import { ErrorImportacion, detectarFormato, textoDesdeOdtXml } from "./importar";

const b = (...x: number[]) => new Uint8Array(x);

describe("detectarFormato (por contenido, no por extensión)", () => {
  it("PDF por su firma aunque la extensión mienta", () => {
    expect(detectarFormato("cv.txt", b(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("pdf");
  });

  it("DOCX solo si es un zip con extensión .docx", () => {
    expect(detectarFormato("CV.DOCX", b(0x50, 0x4b, 0x03, 0x04))).toBe("docx");
    expect(() => detectarFormato("malware.zip", b(0x50, 0x4b, 0x03, 0x04))).toThrow(ErrorImportacion);
  });

  it("ODT solo si es un zip con extensión .odt", () => {
    expect(detectarFormato("cv.odt", b(0x50, 0x4b, 0x03, 0x04))).toBe("odt");
  });

  it("rechaza .doc antiguo con instrucciones", () => {
    expect(() => detectarFormato("viejo.doc", b(0xd0, 0xcf, 0x11, 0xe0))).toThrow(/docx o PDF/);
  });

  it("texto por extensión y rechazo del resto", () => {
    expect(detectarFormato("cv.md", b(0x23, 0x20))).toBe("texto");
    expect(detectarFormato("sin_extension", b(0x41))).toBe("texto");
    expect(() => detectarFormato("foto.png", b(0x89, 0x50, 0x4e, 0x47))).toThrow(/no compatible/);
    expect(() => detectarFormato("run.exe", b(0x4d, 0x5a))).toThrow(ErrorImportacion);
  });
});

describe("textoDesdeOdtXml", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
<office:automatic-styles><style:style style:name="P1"/></office:automatic-styles>
<office:body><office:text>
<text:h text:outline-level="1">Ana Torres</text:h>
<text:p>Node.js<text:s text:c="2"/>&amp; PostgreSQL<text:line-break/>Guadalajara, M&#233;xico</text:p>
<text:list><text:list-item><text:p>Dise&#xF1;é APIs</text:p></text:list-item><text:list-item><text:p>Usé Docker</text:p></text:list-item></text:list>
</office:text></office:body></office:document-content>`;

  it("un párrafo por línea, saltos, espacios, entidades y viñetas", () => {
    const lineas = textoDesdeOdtXml(xml).split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lineas).toEqual(["Ana Torres", "Node.js  & PostgreSQL", "Guadalajara, México", "- Diseñé APIs", "- Usé Docker"]);
  });

  it("ignora los estilos y no deja etiquetas", () => {
    expect(textoDesdeOdtXml(xml)).not.toMatch(/[<>]|P1/);
  });
});
