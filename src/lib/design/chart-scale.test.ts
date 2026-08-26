import { describe, expect, it } from "vitest";
import { linearScale, niceTicks } from "./chart-scale";

describe("linearScale", () => {
  it("mapea el dominio al rango linealmente", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it("admite un rango invertido, como el eje Y del SVG", () => {
    const s = linearScale([0, 10], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(0);
  });

  it("no divide por cero si el dominio es degenerado", () => {
    // Un solo punto de datos, o todos con el mismo valor.
    const s = linearScale([5, 5], [0, 100]);
    expect(Number.isFinite(s(5))).toBe(true);
  });
});

describe("niceTicks", () => {
  it("devuelve marcas dentro del rango pedido", () => {
    const ticks = niceTicks(0, 100, 5);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
  });

  it("no entra en bucle si min y max son iguales", () => {
    const ticks = niceTicks(7, 7, 5);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThan(20);
  });
});
