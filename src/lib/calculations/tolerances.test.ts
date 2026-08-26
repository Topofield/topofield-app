import { describe, it, expect } from "vitest";
import { angularTolerance, minRelativePrecision, levelingTolerance, LEVELING_TOLERANCE_K } from "./tolerances";

describe("angularTolerance", () => {
  it("aplica K·√n en segundos de arco", () => {
    expect(angularTolerance("primer_orden", 1)).toBeCloseTo(1, 6);
    expect(angularTolerance("segundo_orden", 4)).toBeCloseTo(10, 6);
    expect(angularTolerance("tercer_orden", 5)).toBeCloseTo(33.5410, 4);
    expect(angularTolerance("ordinario", 9)).toBeCloseTo(90, 6);
  });
});

describe("minRelativePrecision", () => {
  it("devuelve el X de 1:X por orden", () => {
    expect(minRelativePrecision("primer_orden")).toBe(100000);
    expect(minRelativePrecision("segundo_orden")).toBe(20000);
    expect(minRelativePrecision("tercer_orden")).toBe(5000);
    expect(minRelativePrecision("ordinario")).toBe(3000);
  });
});

describe("levelingTolerance", () => {
  it("usa los K del PRD § 5.4: 3/6/12/24 mm", () => {
    expect(LEVELING_TOLERANCE_K.primer_orden).toBe(3);
    expect(LEVELING_TOLERANCE_K.segundo_orden).toBe(6);
    expect(LEVELING_TOLERANCE_K.tercer_orden).toBe(12);
    expect(LEVELING_TOLERANCE_K.ordinario).toBe(24);
  });

  it("calcula K·√D en mm", () => {
    // 12 · √0.9 = 11.3842...
    expect(levelingTolerance("tercer_orden", 0.9)).toBeCloseTo(11.3842, 3);
    // 12 · √2.2 = 17.7986...
    expect(levelingTolerance("tercer_orden", 2.2)).toBeCloseTo(17.7986, 3);
    // 3 · √1 = 3
    expect(levelingTolerance("primer_orden", 1)).toBeCloseTo(3, 6);
  });

  it("da 0 para distancia 0", () => {
    expect(levelingTolerance("ordinario", 0)).toBe(0);
  });
});

import { DAYS_PER_MONTH, thresholdsFor } from "./tolerances";

describe("DAYS_PER_MONTH", () => {
  it("es el promedio del año gregoriano, 365.25/12", () => {
    expect(DAYS_PER_MONTH).toBeCloseTo(30.4375, 10);
  });
});

describe("thresholdsFor", () => {
  it("da al edificio los umbrales de edificio, no los de presa", () => {
    // El § 3.2 del PRD traía 10/25/50 —los de presa— como default para todos.
    const t = thresholdsFor("edificio");
    expect(t.accumulatedCaution).toBe(25);
    expect(t.accumulatedAlert).toBe(50);
    expect(t.accumulatedAlarm).toBe(75);
  });

  it("da a la presa sus propios umbrales, más estrictos", () => {
    const t = thresholdsFor("presa");
    expect(t.accumulatedCaution).toBe(10);
    expect(t.accumulatedAlert).toBe(25);
    expect(t.accumulatedAlarm).toBe(50);
  });

  it("usa los mismos umbrales de velocidad en todos los tipos", () => {
    for (const tipo of ["edificio", "presa", "terraplen", "otro"] as const) {
      const t = thresholdsFor(tipo);
      expect(t.velocityCaution).toBe(2);
      expect(t.velocityAlert).toBe(5);
      expect(t.velocityAlarm).toBe(10);
    }
  });

  it("usa 1/500 como límite de distorsión por defecto", () => {
    expect(thresholdsFor("edificio").angularDistortionLimit).toBe(500);
  });
});
