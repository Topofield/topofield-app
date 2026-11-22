import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("acepta una ruta de la aplicación, con su consulta", () => {
    expect(safeNextPath("/admin/invitaciones")).toBe("/admin/invitaciones");
    expect(safeNextPath("/projects/1?tab=procesos")).toBe("/projects/1?tab=procesos");
  });

  it("rechaza lo vacío", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });

  it("rechaza otro dominio, en todas sus formas", () => {
    expect(safeNextPath("https://otro.test/")).toBeNull();
    expect(safeNextPath("//otro.test/")).toBeNull();
    expect(safeNextPath("/\\otro.test/")).toBeNull();
    expect(safeNextPath("otro.test")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
  });

  it("rechaza caracteres de control", () => {
    expect(safeNextPath("/a\nSet-Cookie: x")).toBeNull();
    expect(safeNextPath("/\ta")).toBeNull();
  });
});
