import { describe, expect, it } from "vitest";
import {
  pointReferenceChanged,
  undoRetirementBlocker,
  validateActiveFrom,
  validateReadingCapture,
  validateRetirement,
  neighborVisitDates,
  validateVisitCapture,
  validateVisitClose,
  type SiteVisit,
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
      [],
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
      [],
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
      [],
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
      [],
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
      [],
    );
    expect(r.errors.readings).toContain("más de una lectura");
    expect(r.errors.readings).toContain("Faltan lecturas de: P-02");
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
function visitaCon(
  n: number,
  date: string,
  ids: string[],
  closed = false,
): SiteVisit {
  return {
    id: `v${n}`,
    visitNumber: n,
    date,
    readings: ids.map((pointId) => ({ pointId, elevation: 100 })),
    closed,
  };
}

describe("validateVisitClose — vigencia (Fase 11)", () => {
  // Se prueba por validateVisitClose, que es la puerta de closeVisitAction,
  // y no por isPointActiveOn suelta (aprendizaje de la Fase 9).
  it("no exige el punto de baja en una visita posterior a la baja", () => {
    const v = visitaCon(4, "2025-04-15", ["p1", "p7"]);
    const r = validateVisitClose(v, [P1, P5, P7], "2025-03-15", []);
    expect(r.errors).toEqual({});
  });

  it("sigue exigiendo el punto de baja en una visita anterior a la baja", () => {
    const v = visitaCon(2, "2025-02-15", ["p1"]);
    const r = validateVisitClose(v, [P1, P5], "2025-01-15", []);
    expect(r.errors.readings).toContain("Faltan lecturas de: P-05");
  });

  it("no exige el punto de alta en una visita anterior a su alta", () => {
    const v = visitaCon(2, "2025-02-15", ["p1"]);
    const r = validateVisitClose(v, [P1, P7], "2025-01-15", []);
    expect(r.errors).toEqual({});
  });

  it("exige el punto de alta en una visita posterior a su alta", () => {
    const v = visitaCon(3, "2025-03-15", ["p1"]);
    const r = validateVisitClose(v, [P1, P7], "2025-02-15", []);
    expect(r.errors.readings).toContain("Faltan lecturas de: P-07");
  });
});

describe("validateVisitClose — la línea base no puede quedar abierta (Fase 11)", () => {
  it("rechaza cerrar si la primera lectura de un punto sin C0 está en una visita anterior abierta", () => {
    const v2 = visitaCon(2, "2025-03-15", ["p1", "p7"]); // abierta: base de P-07
    const v3 = visitaCon(3, "2025-04-15", ["p1", "p7"]);
    const r = validateVisitClose(v3, [P1, P7], "2025-03-15", [v2, v3]);
    // Desde la Fase 26 (C-15) bloquea también P-01, que tiene C0: su lectura
    // anterior está en la misma visita abierta.
    expect(r.errors.readings).toBe(
      "Cierra antes la visita 2: P-01, P-07 se calculan contra sus lecturas.",
    );
  });

  it("permite cerrar cuando la visita de la línea base ya está cerrada", () => {
    const v2 = visitaCon(2, "2025-03-15", ["p1", "p7"], true);
    const v3 = visitaCon(3, "2025-04-15", ["p1", "p7"]);
    const r = validateVisitClose(v3, [P1, P7], "2025-03-15", [v2, v3]);
    expect(r.errors).toEqual({});
  });

  it("permite cerrar la propia visita de la línea base", () => {
    const v2 = visitaCon(2, "2025-03-15", ["p1", "p7"]);
    const r = validateVisitClose(v2, [P1, P7], "2025-02-15", [v2]);
    expect(r.errors).toEqual({});
  });

  it("un punto con C0 tampoco se cierra con su lectura anterior abierta (Fase 26, C-15)", () => {
    // Su acumulado parte de la C0, pero su parcial y su velocidad se miden
    // contra la lectura de v0: corregirla después cambiaría v1 cerrada.
    const v0 = visitaCon(0, "2025-01-15", ["p1"]); // abierta
    const v1 = visitaCon(1, "2025-02-15", ["p1"]);
    const r = validateVisitClose(v1, [P1], "2025-01-15", [v0, v1]);
    expect(r.errors.readings).toBe("Cierra antes la visita 0: P-01 se calcula contra sus lecturas.");
  });
});

describe("validateVisitClose — la lectura anterior no puede quedar abierta (Fase 26, C-15)", () => {
  it("con la anterior cerrada y la intermedia abierta, bloquea la intermedia", () => {
    const v0 = visitaCon(0, "2025-01-15", ["p1"], true);
    const v1 = visitaCon(1, "2025-02-15", ["p1"]); // abierta
    const v2 = visitaCon(2, "2025-03-15", ["p1"]);
    const r = validateVisitClose(v2, [P1], "2025-02-15", [v0, v1, v2]);
    expect(r.errors.readings).toBe("Cierra antes la visita 1: P-01 se calcula contra sus lecturas.");
  });

  it("con todas las anteriores cerradas, cierra", () => {
    const v0 = visitaCon(0, "2025-01-15", ["p1"], true);
    const v1 = visitaCon(1, "2025-02-15", ["p1"], true);
    const v2 = visitaCon(2, "2025-03-15", ["p1"]);
    expect(validateVisitClose(v2, [P1], "2025-02-15", [v0, v1, v2]).errors).toEqual({});
  });

  it("y comprueba la fecha contra la visita siguiente (C-16)", () => {
    const v1 = visitaCon(1, "2025-03-15", ["p1"], true);
    const v2 = visitaCon(2, "2025-03-15", ["p1"], true);
    const r = validateVisitClose(v1, [P1], null, [v1, v2]);
    expect(r.errors.date).toBe("La fecha debe ser anterior a la de la visita siguiente (2025-03-15).");
  });
});

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

describe("undoRetirementBlocker", () => {
  it("permite deshacer si ninguna visita cerrada es posterior a la baja", () => {
    expect(
      undoRetirementBlocker("2025-04-01", [{ visitNumber: 3, date: "2025-03-15" }]),
    ).toBeNull();
  });

  it("no permite deshacer si hay una visita cerrada en la misma fecha de la baja", () => {
    // El límite es inclusivo: la fecha de baja ya no es vigente, así que una
    // visita cerrada ese día se cerró sin el punto.
    expect(
      undoRetirementBlocker("2025-04-01", [{ visitNumber: 4, date: "2025-04-01" }]),
    ).toContain("la visita 4");
  });
});

describe("validateActiveFrom", () => {
  it("acepta un alta posterior a la última visita cerrada", () => {
    expect(validateActiveFrom("2025-03-01", "2025-02-15")).toBeNull();
  });

  it("rechaza un alta igual o anterior a la última visita cerrada", () => {
    expect(validateActiveFrom("2025-02-15", "2025-02-15")).toContain(
      "posterior a la última visita cerrada",
    );
  });

  it("acepta cualquier fecha válida si el lugar no tiene visitas cerradas", () => {
    expect(validateActiveFrom("2025-01-01", null)).toBeNull();
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
