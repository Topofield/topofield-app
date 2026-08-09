import { describe, expect, it } from "vitest";
import { construirIndice, idsDuplicados } from "./indice";
import { SECCIONES } from "./manual-data";

describe("construirIndice", () => {
  it("crea una entrada por sección, en el mismo orden", () => {
    const indice = construirIndice([
      { id: "uno", titulo: "Uno" },
      { id: "dos", titulo: "Dos" },
    ]);

    expect(indice).toEqual([
      { href: "#uno", label: "Uno" },
      { href: "#dos", label: "Dos" },
    ]);
  });

  it("devuelve un índice vacío si no hay secciones", () => {
    expect(construirIndice([])).toEqual([]);
  });

  it("prefija cada destino con # para que sea un ancla", () => {
    const indice = construirIndice(SECCIONES);
    expect(indice).toHaveLength(SECCIONES.length);
    for (const entrada of indice) {
      expect(entrada.href.startsWith("#")).toBe(true);
    }
  });
});

describe("idsDuplicados", () => {
  it("detecta un id repetido", () => {
    expect(
      idsDuplicados([
        { id: "cierre", titulo: "Cerrar un proceso" },
        { id: "cierre", titulo: "Otra cosa" },
      ]),
    ).toEqual(["cierre"]);
  });

  it("no señala nada cuando todos son únicos", () => {
    expect(
      idsDuplicados([
        { id: "uno", titulo: "Uno" },
        { id: "dos", titulo: "Dos" },
      ]),
    ).toEqual([]);
  });

  // La razón de ser de este módulo: un ancla duplicada en el manual real
  // navegaría siempre a la primera coincidencia, sin error visible.
  it("las secciones del manual no tienen anclas repetidas", () => {
    expect(idsDuplicados(SECCIONES)).toEqual([]);
  });
});
