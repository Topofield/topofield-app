import { describe, expect, it } from "vitest";
import { readVisitForm, templateNote } from "./visit-dialog-form";

const base = { date: "2022-04-12", operator: " J. Pérez ", notes: "", brand: "", model: "", serial: "" };

describe("el popup de la visita (Fase 37)", () => {
  it("exige una fecha de calendario", () => {
    expect(readVisitForm({ ...base, date: "" })).toEqual({ error: "La visita necesita una fecha válida." });
    expect(readVisitForm({ ...base, date: "2022-02-30" })).toEqual({ error: "La visita necesita una fecha válida." });
  });

  it("limpia los textos y deja en null lo vacío", () => {
    expect(readVisitForm(base)).toEqual({
      visit: {
        date: "2022-04-12",
        operator: "J. Pérez",
        notes: null,
        equipmentBrand: null,
        equipmentModel: null,
        equipmentSerial: null,
      },
    });
  });
});

describe("el aviso de la plantilla", () => {
  it("con visita anterior dice cuántas armadas y puntos llegan", () => {
    expect(templateNote({ previousNumber: 2, armadas: 1, startCode: "PISCINA/BM", points: 16, firstBenchmark: "PISCINA/BM" })).toBe(
      "La libreta llega armada como la visita 2: 1 armada desde PISCINA/BM, con sus 16 puntos. En campo solo se teclean las lecturas.",
    );
  });

  it("sin visita anterior, una armada desde el primer BM del lugar", () => {
    expect(templateNote({ previousNumber: null, armadas: 0, startCode: null, points: 8, firstBenchmark: "BM-1" })).toBe(
      "Primera visita: la libreta llega con una armada desde BM-1 y los 8 puntos vigentes.",
    );
  });

  it("sin BM en el lugar, lo pide", () => {
    expect(templateNote({ previousNumber: null, armadas: 0, startCode: null, points: 8, firstBenchmark: null })).toBe(
      "El lugar no tiene BM: agrégalos en la pestaña BMs, porque las visitas se arman desde ellos.",
    );
  });
});
