import { describe, it, expect } from "vitest";
import { angularTolerance, minRelativePrecision } from "./tolerances";

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
