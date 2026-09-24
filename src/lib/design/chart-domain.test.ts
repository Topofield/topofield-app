import { describe, expect, it } from "vitest";
import {
  settlementAxis,
  settlementDomain,
  thresholdsInDomain,
} from "./chart-domain";

const T = { caution: 25, alert: 50, alarm: 75 };

describe("settlementDomain", () => {
  it("sin datos ni umbrales queda en el 0", () => {
    expect(settlementDomain([])).toEqual([0, 0]);
  });

  it("sin datos llega al primer umbral, para que se vea lo que falta", () => {
    // Solo la lectura base: todo en 0.
    expect(settlementDomain([0, 0], T)).toEqual([-25, 0]);
  });

  it("incluye el 0 aunque todos los datos sean negativos", () => {
    expect(settlementDomain([-12, -8])).toEqual([-12, 0]);
  });

  it("llega al umbral siguiente al dato más hundido", () => {
    expect(settlementDomain([-3, -12, -7], T)).toEqual([-25, 0]);
    expect(settlementDomain([-31.4], T)).toEqual([-50, 0]);
  });

  it("un dato justo en un umbral lleva el eje al siguiente", () => {
    // «Estrictamente mayor»: el de precaución ya se ve en el propio dato.
    expect(settlementDomain([-25], T)).toEqual([-50, 0]);
  });

  it("pasado el umbral de alarma no añade nada: los datos ya lo contienen", () => {
    expect(settlementDomain([-80], T)).toEqual([-80, 0]);
    expect(settlementDomain([-75], T)).toEqual([-75, 0]);
  });

  it("el levantamiento extiende el dominio hacia arriba", () => {
    expect(settlementDomain([4, -3], T)).toEqual([-25, 4]);
    expect(settlementDomain([2, 6])).toEqual([0, 6]);
  });

  it("no depende del orden de los umbrales", () => {
    const desordenados = { caution: 50, alert: 30, alarm: 90 };
    // El siguiente a 20 mm es el de menor magnitud por encima: 30.
    expect(settlementDomain([-20], desordenados)).toEqual([-30, 0]);
  });

  it("ignora umbrales en 0, negativos o no numéricos", () => {
    expect(
      settlementDomain([-5], { caution: 0, alert: Number.NaN, alarm: 40 }),
    ).toEqual([-40, 0]);
    expect(settlementDomain([-5], { caution: -10, alert: 0, alarm: 0 })).toEqual([
      -5, 0,
    ]);
  });

  it("ignora valores no numéricos", () => {
    expect(settlementDomain([Number.NaN, -9, Infinity], T)).toEqual([-25, 0]);
  });
});

describe("thresholdsInDomain", () => {
  it("devuelve en negativo los umbrales que caben, bordes incluidos", () => {
    expect(thresholdsInDomain(T, [-50, 0])).toEqual([
      { level: "caution", magnitude: 25, value: -25 },
      { level: "alert", magnitude: 50, value: -50 },
    ]);
  });

  it("sin umbrales no devuelve nada", () => {
    expect(thresholdsInDomain(null, [-100, 0])).toEqual([]);
    expect(thresholdsInDomain(undefined, [-100, 0])).toEqual([]);
  });

  it("un dominio solo positivo no muestra ninguno", () => {
    expect(thresholdsInDomain(T, [0, 10])).toEqual([]);
  });
});

describe("settlementAxis", () => {
  it("las marcas cubren el umbral siguiente e incluyen el 0", () => {
    const axis = settlementAxis([-12.3, -4], T, 5);
    expect(axis.domain[0]).toBeLessThanOrEqual(-25);
    expect(axis.domain[1]).toBeGreaterThanOrEqual(0);
    expect(axis.ticks).toContain(0);
    expect(axis.thresholds.map((t) => t.level)).toEqual(["caution"]);
  });

  it("dibuja un umbral que el redondeo de las marcas deja dentro", () => {
    // Datos a −26 → umbral siguiente −50; las marcas llegan a −50 exacto.
    const axis = settlementAxis([-26], T, 5);
    expect(axis.domain).toEqual([-50, 0]);
    expect(axis.thresholds.map((t) => t.level)).toEqual(["caution", "alert"]);
  });

  it("sin datos ni umbrales devuelve un eje utilizable", () => {
    const axis = settlementAxis([], null, 5);
    expect(axis.ticks.length).toBeGreaterThan(1);
    expect(axis.domain[0]).toBeLessThan(axis.domain[1]);
    expect(axis.thresholds).toEqual([]);
  });
});
