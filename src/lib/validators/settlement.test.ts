import { describe, expect, it } from "vitest";
import {
  validateReadingCapture,
  validateVisitCapture,
  validateVisitClose,
} from "./settlement";
import type { PointInput, VisitInput } from "@/types/settlement";

const P1: PointInput = {
  id: "p1",
  code: "P-01",
  northing: 0,
  easting: 0,
  initialElevation: 100.0,
};

describe("validateReadingCapture", () => {
  it("acepta una cota plausible", () => {
    const r = validateReadingCapture({ pointId: "p1", elevation: 99.99 }, P1);
    expect(r.errors).toEqual({});
  });

  it("rechaza una cota no finita", () => {
    const r = validateReadingCapture(
      { pointId: "p1", elevation: Number.NaN },
      P1,
    );
    expect(r.errors.elevation).toBeDefined();
  });

  it("advierte si la cota se aleja de C0 más de 1 m", () => {
    // Un asentamiento de 1 m es implausible en monitoreo topográfico: casi
    // siempre es un error de transcripción.
    const r = validateReadingCapture({ pointId: "p1", elevation: 98.5 }, P1);
    expect(r.warnings.elevation).toBeDefined();
    expect(r.errors).toEqual({});
  });

  it("no advierte si el punto no tiene C0 contra la que comparar", () => {
    const sinC0: PointInput = { ...P1, initialElevation: null };
    const r = validateReadingCapture(
      { pointId: "p1", elevation: 50 },
      sinC0,
    );
    expect(r.warnings).toEqual({});
  });
});

describe("isCalendarDate (vía validateVisitCapture)", () => {
  const visita: VisitInput = {
    id: "v1",
    visitNumber: 1,
    date: "2025-02-15",
    readings: [{ pointId: "p1", elevation: 99.99 }],
  };

  it("rechaza un mes fuera de rango (2025-13-45)", () => {
    const r = validateVisitCapture(
      { ...visita, date: "2025-13-45" },
      [P1],
      null,
    );
    expect(r.errors.date).toBeDefined();
  });

  it("rechaza un día que no existe en el mes (2025-02-30, que Date.parse desplazaría a 2025-03-02)", () => {
    const r = validateVisitCapture(
      { ...visita, date: "2025-02-30" },
      [P1],
      null,
    );
    expect(r.errors.date).toBeDefined();
  });

  it("rechaza mes y día en cero (2025-00-00)", () => {
    const r = validateVisitCapture(
      { ...visita, date: "2025-00-00" },
      [P1],
      null,
    );
    expect(r.errors.date).toBeDefined();
  });

  it("acepta una fecha calendárica válida de control", () => {
    const r = validateVisitCapture(
      { ...visita, date: "2025-02-28" },
      [P1],
      null,
    );
    expect(r.errors.date).toBeUndefined();
  });
});

describe("validateVisitCapture", () => {
  const visita: VisitInput = {
    id: "v1",
    visitNumber: 1,
    date: "2025-02-15",
    readings: [{ pointId: "p1", elevation: 99.99 }],
  };

  it("acepta una visita bien formada", () => {
    const r = validateVisitCapture(visita, [P1], "2025-01-15");
    expect(r.errors).toEqual({});
  });

  it("rechaza una fecha anterior o igual a la de la visita previa", () => {
    const r = validateVisitCapture(
      { ...visita, date: "2025-01-10" },
      [P1],
      "2025-01-15",
    );
    expect(r.errors.date).toBeDefined();
  });

  it("acepta la primera visita, que no tiene previa", () => {
    const r = validateVisitCapture({ ...visita, visitNumber: 0 }, [P1], null);
    expect(r.errors).toEqual({});
  });

  it("rechaza una fecha vacía o mal formada", () => {
    const r = validateVisitCapture({ ...visita, date: "" }, [P1], null);
    expect(r.errors.date).toBeDefined();
  });

  it("rechaza dos lecturas del mismo punto", () => {
    const r = validateVisitCapture(
      {
        ...visita,
        readings: [
          { pointId: "p1", elevation: 99.99 },
          { pointId: "p1", elevation: 99.98 },
        ],
      },
      [P1],
      null,
    );
    expect(r.errors.readings).toBeDefined();
  });

  it("rechaza una lectura de un punto que no está en el catálogo", () => {
    const r = validateVisitCapture(
      { ...visita, readings: [{ pointId: "fantasma", elevation: 99.99 }] },
      [P1],
      null,
    );
    expect(r.errors.readings).toBeDefined();
  });

  it("propaga los errores de celda de cada lectura", () => {
    const r = validateVisitCapture(
      { ...visita, readings: [{ pointId: "p1", elevation: Number.NaN }] },
      [P1],
      null,
    );
    expect(r.readingIssues.p1?.errors.elevation).toBeDefined();
  });

  it("acumula el mensaje de fantasma y el de duplicado en vez de pisarse", () => {
    const r = validateVisitCapture(
      {
        ...visita,
        readings: [
          { pointId: "fantasma", elevation: 99.99 },
          { pointId: "p1", elevation: 99.99 },
          { pointId: "p1", elevation: 99.98 },
        ],
      },
      [P1],
      null,
    );
    expect(r.errors.readings).toContain("no está en el catálogo");
    expect(r.errors.readings).toContain("más de una lectura");
  });
});

describe("validateVisitClose", () => {
  it("bloquea el cierre si falta la lectura de algún punto del catálogo", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
      [P1, P2],
      null,
    );
    expect(r.errors.readings).toBeDefined();
  });

  it("permite cerrar una visita completa", () => {
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
      [P1],
      null,
    );
    expect(r.errors).toEqual({});
  });

  it("NO bloquea el cierre por un asentamiento en alarma", () => {
    // Un dato alarmante es un hallazgo del monitoreo, no un error de captura:
    // es justo el caso que el módulo existe para documentar. La desviación
    // (1.5 m) supera MAX_PLAUSIBLE_DEVIATION_M (1 m) a propósito, para que sí
    // dispare warnings.elevation — si no, el test pasaría igual sin ningún
    // asentamiento y no probaría nada.
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 98.5 }], // −1.5 m
      },
      [P1],
      null,
    );
    expect(r.readingIssues.p1?.warnings.elevation).toBeDefined();
    expect(r.errors).toEqual({});
  });

  it("bloquea el cierre si la fecha está fuera de orden respecto a la visita anterior", () => {
    // El cierre repite la comprobación de orden cronológico: sella la visita
    // como inmutable, así que es el último punto donde puede atajarse una
    // fecha que dejaría un intervalo negativo grabado para siempre.
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-01-10",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
      [P1],
      "2025-01-15",
    );
    expect(r.errors.date).toBeDefined();
  });

  it("acumula el mensaje de duplicado y el de faltantes en vez de pisarse", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [
          { pointId: "p1", elevation: 99.99 },
          { pointId: "p1", elevation: 99.98 },
        ],
      },
      [P1, P2],
      null,
    );
    expect(r.errors.readings).toContain("más de una lectura");
    expect(r.errors.readings).toContain("Faltan lecturas de: P-02");
  });
});
