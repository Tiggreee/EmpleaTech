import { describe, expect, it } from "vitest";
import { ErrorImportacion, detectarFormato } from "./importar";

const b = (...x: number[]) => new Uint8Array(x);

describe("detectarFormato (por contenido, no por extensión)", () => {
  it("PDF por su firma aunque la extensión mienta", () => {
    expect(detectarFormato("cv.txt", b(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe("pdf");
  });

  it("DOCX solo si es un zip con extensión .docx", () => {
    expect(detectarFormato("CV.DOCX", b(0x50, 0x4b, 0x03, 0x04))).toBe("docx");
    expect(() => detectarFormato("malware.zip", b(0x50, 0x4b, 0x03, 0x04))).toThrow(ErrorImportacion);
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
