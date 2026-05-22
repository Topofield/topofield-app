import { describe, it, expect } from "vitest";
import {
  cosDeg,
  decimalToDms,
  degreesToSeconds,
  dmsToDecimal,
  normalizeAzimuth,
  sinDeg,
} from "./angles";

describe("dmsToDecimal", () => {
  it("convierte DMS a grados decimales", () => {
    expect(dmsToDecimal(45, 30, 0)).toBe(45.5);
    expect(dmsToDecimal(0, 0, 0)).toBe(0);
    expect(dmsToDecimal(10, 15, 30)).toBeCloseTo(10.258333, 5);
    expect(dmsToDecimal(90, 0, 0)).toBe(90);
  });

  it("maneja grados negativos", () => {
    expect(dmsToDecimal(-5, 30, 0)).toBeCloseTo(-5.5, 6);
  });
});

describe("decimalToDms", () => {
  it("convierte grados decimales a DMS", () => {
    expect(decimalToDms(45.5)).toEqual({ deg: 45, min: 30, sec: 0 });
    expect(decimalToDms(10.258333)).toEqual({ deg: 10, min: 15, sec: 30 });
    expect(decimalToDms(0)).toEqual({ deg: 0, min: 0, sec: 0 });
  });

  it("acarrea el desbordamiento de segundos y minutos", () => {
    // 0.999999° ≈ 59'59.996" → debe acarrear a 1° 0' 0"
    expect(decimalToDms(0.999999)).toEqual({ deg: 1, min: 0, sec: 0 });
  });

  it("es la inversa de dmsToDecimal", () => {
    const dms = decimalToDms(dmsToDecimal(116, 45, 12.5));
    expect(dms).toEqual({ deg: 116, min: 45, sec: 12.5 });
  });
});

describe("normalizeAzimuth", () => {
  it("normaliza al rango [0, 360)", () => {
    expect(normalizeAzimuth(45)).toBe(45);
    expect(normalizeAzimuth(370)).toBe(10);
    expect(normalizeAzimuth(720)).toBe(0);
    expect(normalizeAzimuth(360)).toBe(0);
    expect(normalizeAzimuth(-10)).toBe(350);
    expect(normalizeAzimuth(-370)).toBe(350);
  });
});

describe("degreesToSeconds", () => {
  it("convierte grados a segundos de arco", () => {
    expect(degreesToSeconds(1)).toBe(3600);
    expect(degreesToSeconds(0.001)).toBeCloseTo(3.6, 6);
  });
});

describe("cosDeg / sinDeg", () => {
  it("opera en grados", () => {
    expect(cosDeg(0)).toBeCloseTo(1, 10);
    expect(cosDeg(90)).toBeCloseTo(0, 10);
    expect(sinDeg(90)).toBeCloseTo(1, 10);
    expect(sinDeg(0)).toBeCloseTo(0, 10);
    expect(cosDeg(45)).toBeCloseTo(Math.SQRT1_2, 10);
  });
});
