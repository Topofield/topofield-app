import { describe, expect, it } from "vitest";
import { isoDay, linearScale, niceTicks, timeScale, timeTicks } from "./chart-scale";

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

  // El seed y el marco teórico dan rangos amplios; estos son los degenerados
  // que la gráfica puede encontrar con datos reales escasos o muy planos.
  it("con min = max = 0 devuelve un eje utilizable, no una sola marca", () => {
    expect(niceTicks(0, 0, 5)).toEqual([-1, 0, 1]);
  });

  it("con min = max distinto de cero escala el paso al propio valor", () => {
    expect(niceTicks(-12.5, -12.5, 5)).toEqual([-18.75, -12.5, -6.25]);
  });

  // Un lugar cuyos puntos apenas se mueven: milímetros de asentamiento sobre
  // un dominio que incluye el 0. El paso debe seguir siendo «redondo».
  it("resuelve un rango minúsculo sin perder marcas", () => {
    const ticks = niceTicks(-0.0001, 0.0001, 5);
    expect(ticks[0]).toBeLessThanOrEqual(-0.0001);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(0.0001);
    expect(ticks).toContain(0);
  });

  it("cubre un dominio íntegramente negativo", () => {
    const ticks = niceTicks(-50, -10, 5);
    expect(ticks[0]).toBeLessThanOrEqual(-50);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(-10);
  });

  it("incluye el cero cuando el dominio lo cruza", () => {
    expect(niceTicks(-30, 70, 5)).toContain(0);
  });

  // `count` es un número deseado, no un contrato: valores degenerados no
  // deben producir un bucle largo ni un eje vacío.
  it("tolera un count de 1 o de 0", () => {
    expect(niceTicks(0, 100, 1).length).toBeGreaterThanOrEqual(2);
    expect(niceTicks(0, 100, 0).length).toBeGreaterThanOrEqual(2);
  });

  // Documenta un límite conocido: con el rango invertido no hay marcas. No se
  // defiende en el código porque el único llamante construye el dominio con
  // `Math.min`/`Math.max` (`settlement-chart.tsx`), así que no puede ocurrir.
  // Si algún día otro llamante pudiera invertirlo, este test lo delata.
  it("con el rango invertido no produce marcas (límite conocido)", () => {
    expect(niceTicks(100, 0, 5)).toEqual([]);
  });
});

describe("isoDay", () => {
  it("cuenta días de calendario en UTC", () => {
    expect(isoDay("1970-01-02")).toBe(1);
    expect(isoDay("2025-03-01") - isoDay("2025-02-01")).toBe(28);
  });
});

describe("timeScale", () => {
  it("es lineal en días, no en índice de visita", () => {
    // Visitas irregulares: 1 mes y luego 3 meses. Con eje por índice la
    // segunda quedaría a mitad de camino; en el tiempo, a un cuarto.
    const s = timeScale(["2025-01-01", "2025-02-01", "2025-05-02"], [0, 121]);
    expect(s("2025-01-01")).toBe(0);
    expect(s("2025-02-01")).toBeCloseTo(31, 9);
    expect(s("2025-05-02")).toBe(121);
  });

  it("ordena las fechas antes de fijar el dominio", () => {
    const s = timeScale(["2025-05-02", "2025-01-01"], [0, 121]);
    expect(s("2025-01-01")).toBe(0);
  });

  it("con un solo día no divide por cero", () => {
    const s = timeScale(["2025-01-01"], [0, 100]);
    expect(s("2025-01-01")).toBe(50);
  });
});

describe("timeTicks", () => {
  it("devuelve fechas ISO dentro del intervalo, en orden", () => {
    const ticks = timeTicks("2025-01-07", "2025-12-20", 6);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    for (const t of ticks) {
      expect(t >= "2025-01-07" && t <= "2025-12-20").toBe(true);
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect([...ticks].sort()).toEqual(ticks);
  });

  it("con un solo día devuelve ese día", () => {
    expect(timeTicks("2025-01-07", "2025-01-07", 5)).toEqual(["2025-01-07"]);
  });
});
