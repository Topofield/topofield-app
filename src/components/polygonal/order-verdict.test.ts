// Fase 35: el «Por qué» del orden alcanzado, orden por orden, con las mismas
// tolerancias que lo detectan.
import { describe, expect, it } from "vitest";
import { orderChecks } from "./order-verdict";

const tt4 = { angularError: 12, angularConditionCount: 7, relativePrecision: 7045 };

describe("orderChecks", () => {
  it("la TT4: el ángulo cumple segundo orden, la lineal solo tercero", () => {
    const rows = orderChecks(tt4, "closed");
    expect(rows.map((r) => [r.order, r.angularOk, r.linearOk, r.reached])).toEqual([
      ["primer_orden", false, false, false],
      ["segundo_orden", true, false, false],
      ["tercer_orden", true, true, true],
      ["ordinario", true, true, false],
    ]);
    expect(rows[1]!.angularTolerance).toBeCloseTo(5 * Math.sqrt(7), 9);
    expect(rows[2]!.minPrecision).toBe(5000);
  });

  it("sin condición angular, se juzga solo por la lineal", () => {
    const rows = orderChecks({ ...tt4, angularError: null, angularConditionCount: null }, "open_controlled");
    expect(rows[0]!.angularOk).toBeNull();
    expect(rows[0]!.angularTolerance).toBeNull();
    expect(rows.find((r) => r.reached)?.order).toBe("tercer_orden");
  });

  it("si no alcanza el ordinario, ninguna fila es la alcanzada", () => {
    const rows = orderChecks({ ...tt4, relativePrecision: 1000 }, "closed");
    expect(rows.some((r) => r.reached)).toBe(false);
  });

  it("la abierta sin control no tiene filas", () => {
    expect(orderChecks(tt4, "open_uncontrolled")).toEqual([]);
  });
});
