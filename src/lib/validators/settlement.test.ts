import { describe, expect, it } from "vitest";
import {
  benchmarkCodeClash,
  pointReferenceChanged,
  validateActiveFrom,
  validateReadingCapture,
  validateRetirement,
  neighborVisitDates,
  validateVisitCapture,
} from "./settlement";
import type { PointInput, VisitInput } from "@/types/settlement";

const P1: PointInput = {
  id: "p1",
  code: "P-01",
  initialElevation: 100.0,
  activeFrom: null,
  retiredOn: null,
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

// ============================================================================
// Fase 11 — estado de los BMs
// ============================================================================

const P5: PointInput = { ...P1, id: "p5", code: "P-05", retiredOn: "2025-04-01" };
const P7: PointInput = {
  ...P1,
  id: "p7",
  code: "P-07",
  initialElevation: null,
  activeFrom: "2025-03-01",
};

/** Una visita con lecturas de los puntos dados, todas a 100 m. */
function visitaCon(n: number, date: string, ids: string[]): VisitInput {
  return {
    id: `v${n}`,
    visitNumber: n,
    date,
    readings: ids.map((pointId) => ({ pointId, elevation: 100 })),
  };
}

describe("neighborVisitDates y la fecha entre vecinas (Fase 26, C-16)", () => {
  const visitas = [
    { visitNumber: 0, date: "2025-01-15" },
    { visitNumber: 2, date: "2025-03-15" },
    { visitNumber: 3, date: "2025-04-15" },
  ];

  it("da las fechas de la anterior y la siguiente por número", () => {
    expect(neighborVisitDates({ visitNumber: 2 }, visitas)).toEqual({
      previous: "2025-01-15",
      next: "2025-04-15",
    });
    expect(neighborVisitDates({ visitNumber: 3 }, visitas)).toEqual({ previous: "2025-03-15", next: null });
    expect(neighborVisitDates({ visitNumber: 0 }, [])).toEqual({ previous: null, next: null });
  });

  it("rechaza la misma fecha que otra visita y saltar por encima de la siguiente", () => {
    const visita = visitaCon(1, "2025-03-15", ["p1"]);
    expect(validateVisitCapture(visita, [P1], "2025-01-15", "2025-03-15").errors.date).toBe(
      "La fecha debe ser anterior a la de la visita siguiente (2025-03-15).",
    );
    const despues = visitaCon(1, "2025-04-20", ["p1"]);
    expect(validateVisitCapture(despues, [P1], "2025-01-15", "2025-03-15").errors.date).toBeDefined();
    const entre = visitaCon(1, "2025-02-15", ["p1"]);
    expect(validateVisitCapture(entre, [P1], "2025-01-15", "2025-03-15").errors.date).toBeUndefined();
  });
});

describe("validateVisitCapture — vigencia (Fase 11)", () => {
  it("rechaza una lectura de un punto de baja en una visita posterior", () => {
    const r = validateVisitCapture(
      visitaCon(4, "2025-04-15", ["p1", "p5"]),
      [P1, P5],
      "2025-03-15",
    );
    expect(r.errors.readings).toContain("P-05 está de baja desde");
  });

  it("rechaza mover la fecha de una visita hasta antes del alta de un punto medido", () => {
    const r = validateVisitCapture(
      visitaCon(3, "2025-02-20", ["p1", "p7"]),
      [P1, P7],
      "2025-02-15",
    );
    expect(r.errors.readings).toContain("P-07 se dio de alta");
  });

  it("acepta una lectura en la fecha exacta del alta", () => {
    const r = validateVisitCapture(
      visitaCon(3, "2025-03-01", ["p1", "p7"]),
      [P1, P7],
      "2025-02-15",
    );
    expect(r.errors).toEqual({});
  });
});

describe("validateRetirement", () => {
  const base = {
    retiredOn: "2025-04-01",
    reason: "Destruido por obra",
    activeFrom: null,
    lastReadingDate: "2025-03-15",
  };

  it("acepta una baja posterior a la última lectura, con motivo", () => {
    expect(validateRetirement(base)).toBeNull();
  });

  it("rechaza una fecha de baja igual o anterior a la última lectura", () => {
    expect(validateRetirement({ ...base, retiredOn: "2025-03-15" })).toContain(
      "posterior a su última lectura",
    );
  });

  it("rechaza la baja sin motivo o con motivo en blanco", () => {
    expect(validateRetirement({ ...base, reason: "   " })).toContain("motivo");
  });

  it("rechaza una baja no posterior al alta", () => {
    expect(
      validateRetirement({ ...base, activeFrom: "2025-04-01", lastReadingDate: null }),
    ).toContain("posterior al alta");
  });
});

describe("validateActiveFrom", () => {
  // Fase 37: ninguna visita se cierra, así que el alta admite cualquier fecha.
  it("acepta cualquier fecha válida", () => {
    expect(validateActiveFrom("2025-01-01")).toBeNull();
  });

  it("rechaza una fecha que no es de calendario", () => {
    expect(validateActiveFrom("2025-02-30")).toBe("El punto necesita una fecha de alta válida.");
  });
});

describe("pointReferenceChanged (Fase 23)", () => {
  const punto = { initial_elevation: 100.12 };
  const igual = { initialElevation: 100.12 };

  it("el mismo valor, aunque vuelva formateado, no es un cambio", () => {
    expect(pointReferenceChanged(punto, igual)).toBe(false);
    expect(pointReferenceChanged(punto, { initialElevation: 100.12000000001 })).toBe(false);
  });

  it("la C0 cambia a partir del cuarto decimal", () => {
    expect(pointReferenceChanged(punto, { initialElevation: 100.1201 })).toBe(true);
  });

  it("poner o quitar la C0 es un cambio", () => {
    expect(pointReferenceChanged(punto, { initialElevation: null })).toBe(true);
    expect(pointReferenceChanged({ initial_elevation: null }, { initialElevation: 100.12 })).toBe(true);
    expect(pointReferenceChanged({ initial_elevation: null }, { initialElevation: null })).toBe(false);
  });
});

describe("benchmarkCodeClash (revisión final de la Fase 37)", () => {
  const bms = [
    { id: "a", code: "BM-1" },
    { id: "b", code: "BM-2" },
  ];

  it("un código que solo difiere en mayúsculas o espacios choca con el BM que ya está", () => {
    expect(benchmarkCodeClash("bm-1", bms)).toBe("BM-1");
    expect(benchmarkCodeClash(" BM-2 ", bms)).toBe("BM-2");
  });

  it("un código nuevo no choca", () => {
    expect(benchmarkCodeClash("BM-3", bms)).toBeNull();
  });

  it("al editar, el BM no choca consigo mismo", () => {
    expect(benchmarkCodeClash("bm-1", bms, "a")).toBeNull();
    expect(benchmarkCodeClash("bm-2", bms, "a")).toBe("BM-2");
  });
});
