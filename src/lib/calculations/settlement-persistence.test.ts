import { describe, it, expect } from "vitest";
import {
  readingChanged,
  visitsToRewrite,
  type PersistedReading,
} from "./settlement-persistence";
import type { AlertLevel, VisitResult } from "@/types/settlement";

/** Lectura recalculada, con valores por defecto que los tests van pisando. */
function computed(over: Partial<{
  pointId: string;
  elevation: number;
  partialSettlement: number | null;
  accumulatedSettlement: number | null;
  velocity: number | null;
  alertStatus: AlertLevel;
}> = {}) {
  return {
    pointId: "p1",
    elevation: 100,
    partialSettlement: -5,
    accumulatedSettlement: -10,
    velocity: -2.5,
    alertStatus: "caution" as AlertLevel,
    ...over,
  };
}

/** Lectura ya persistida, coherente por defecto con `computed()`. */
function persisted(over: Partial<PersistedReading> = {}): PersistedReading {
  return {
    point_id: "p1",
    partial_settlement: -5,
    accumulated_settlement: -10,
    velocity: -2.5,
    alert_status: "caution",
    ...over,
  };
}

function visit(over: Partial<VisitResult> = {}): VisitResult {
  return {
    visitId: "v1",
    visitNumber: 1,
    date: "2026-01-01",
    readings: [computed()],
    worstAlert: "caution",
    ...over,
  };
}

describe("readingChanged", () => {
  it("no detecta cambio cuando todo coincide", () => {
    expect(readingChanged(computed(), persisted())).toBe(false);
  });

  it("detecta una lectura que aún no existe en la base", () => {
    expect(readingChanged(computed(), undefined)).toBe(true);
  });

  // Este es el caso que motiva la tarea: cambiar los umbrales de un lugar no
  // altera ningún número, solo la clasificación. Si la comparación mirara sólo
  // los valores numéricos, la reescritura no se dispararía y el hub seguiría
  // mostrando el nivel viejo.
  it("detecta un cambio de SOLO el nivel de alerta", () => {
    expect(
      readingChanged(
        computed({ alertStatus: "alert" }),
        persisted({ alert_status: "caution" }),
      ),
    ).toBe(true);
  });

  it("detecta cambios en parcial, acumulado y velocidad", () => {
    expect(
      readingChanged(computed({ partialSettlement: -6 }), persisted()),
    ).toBe(true);
    expect(
      readingChanged(computed({ accumulatedSettlement: -11 }), persisted()),
    ).toBe(true);
    expect(readingChanged(computed({ velocity: -3 }), persisted())).toBe(true);
  });

  // Postgres devuelve `velocity` (DECIMAL) como cadena vía PostgREST. Comparar
  // sin convertir marcaría como "cambiada" toda fila en cada guardado, y la
  // propagación reescribiría la base entera sin motivo.
  it("no marca cambio cuando la velocidad solo difiere en representación", () => {
    expect(
      readingChanged(
        computed({ velocity: -2.5 }),
        persisted({ velocity: "-2.50" as unknown as number }),
      ),
    ).toBe(false);
  });

  it("distingue null de cero en velocidad", () => {
    expect(
      readingChanged(computed({ velocity: null }), persisted({ velocity: 0 })),
    ).toBe(true);
    expect(
      readingChanged(computed({ velocity: 0 }), persisted({ velocity: null })),
    ).toBe(true);
    expect(
      readingChanged(
        computed({ velocity: null }),
        persisted({ velocity: null }),
      ),
    ).toBe(false);
  });
});

describe("visitsToRewrite", () => {
  const abierta = new Map([["v1", "draft"]]);

  it("devuelve la visita cuyas lecturas cambiaron", () => {
    const out = visitsToRewrite({
      recalculated: [visit({ readings: [computed({ alertStatus: "alert" })] })],
      statusByVisit: abierta,
      persistedByVisit: new Map([["v1", new Map([["p1", persisted()]])]]),
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.visitId).toBe("v1");
    expect(out[0]?.readings).toHaveLength(1);
  });

  it("no devuelve nada cuando nada cambió", () => {
    const out = visitsToRewrite({
      recalculated: [visit()],
      statusByVisit: abierta,
      persistedByVisit: new Map([["v1", new Map([["p1", persisted()]])]]),
    });
    expect(out).toEqual([]);
  });

  // Trazabilidad: una visita cerrada documenta el criterio con el que se
  // evaluó en su momento. El trigger de base lo impediría de todos modos, pero
  // la regla se decide aquí, no se delega al error de la base.
  it("nunca devuelve una visita CERRADA, aunque sus valores difieran", () => {
    const out = visitsToRewrite({
      recalculated: [visit({ readings: [computed({ alertStatus: "alarm" })] })],
      statusByVisit: new Map([["v1", "closed"]]),
      persistedByVisit: new Map([["v1", new Map([["p1", persisted()]])]]),
    });
    expect(out).toEqual([]);
  });

  it("excluye la visita que se está guardando, que se escribe aparte", () => {
    const out = visitsToRewrite({
      recalculated: [visit({ readings: [computed({ alertStatus: "alarm" })] })],
      statusByVisit: abierta,
      persistedByVisit: new Map([["v1", new Map([["p1", persisted()]])]]),
      skipVisitId: "v1",
    });
    expect(out).toEqual([]);
  });

  it("omite visitas sin lecturas recalculadas", () => {
    const out = visitsToRewrite({
      recalculated: [visit({ readings: [] })],
      statusByVisit: abierta,
      persistedByVisit: new Map(),
    });
    expect(out).toEqual([]);
  });

  it("devuelve solo las lecturas que cambiaron, no la visita entera", () => {
    const out = visitsToRewrite({
      recalculated: [
        visit({
          readings: [
            computed({ pointId: "p1", alertStatus: "alarm" }),
            computed({ pointId: "p2" }),
          ],
        }),
      ],
      statusByVisit: abierta,
      persistedByVisit: new Map([
        [
          "v1",
          new Map([
            ["p1", persisted({ point_id: "p1" })],
            ["p2", persisted({ point_id: "p2" })],
          ]),
        ],
      ]),
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.readings.map((r) => r.pointId)).toEqual(["p1"]);
  });

  // Una visita abierta sin ninguna fila persistida todavía: todas sus lecturas
  // son nuevas y hay que escribirlas.
  it("trata como nuevas las lecturas de una visita sin filas persistidas", () => {
    const out = visitsToRewrite({
      recalculated: [visit()],
      statusByVisit: abierta,
      persistedByVisit: new Map(),
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.readings).toHaveLength(1);
  });

  it("procesa varias visitas y respeta el estado de cada una", () => {
    const out = visitsToRewrite({
      recalculated: [
        visit({ visitId: "v1", readings: [computed({ alertStatus: "alarm" })] }),
        visit({ visitId: "v2", readings: [computed({ alertStatus: "alarm" })] }),
        visit({ visitId: "v3", readings: [computed({ alertStatus: "alarm" })] }),
      ],
      statusByVisit: new Map([
        ["v1", "draft"],
        ["v2", "closed"],
        ["v3", "calculated"],
      ]),
      persistedByVisit: new Map([
        ["v1", new Map([["p1", persisted()]])],
        ["v2", new Map([["p1", persisted()]])],
        ["v3", new Map([["p1", persisted()]])],
      ]),
    });
    expect(out.map((v) => v.visitId)).toEqual(["v1", "v3"]);
  });
});
