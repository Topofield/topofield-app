import { describe, expect, it } from "vitest";
import { formatRelativeDate } from "./format";

const AHORA = new Date("2026-07-27T12:00:00Z");

function haceDias(dias: number): string {
  return new Date(AHORA.getTime() - dias * 86_400_000).toISOString();
}

describe("formatRelativeDate", () => {
  it("dice «hoy» para el mismo día", () => {
    expect(formatRelativeDate("2026-07-27T08:00:00Z", AHORA)).toBe("hoy");
  });

  it("dice «ayer» para el día anterior", () => {
    expect(formatRelativeDate("2026-07-26T08:00:00Z", AHORA)).toBe("ayer");
  });

  it("usa días para menos de una semana", () => {
    expect(formatRelativeDate("2026-07-24T12:00:00Z", AHORA)).toBe("hace 3 días");
  });

  it("usa semanas a partir de siete días", () => {
    expect(formatRelativeDate("2026-07-13T12:00:00Z", AHORA)).toBe("hace 2 semanas");
  });

  it("usa singular para una semana", () => {
    expect(formatRelativeDate("2026-07-20T12:00:00Z", AHORA)).toBe("hace 1 semana");
  });

  it("usa meses a partir de treinta días", () => {
    expect(formatRelativeDate("2026-05-27T12:00:00Z", AHORA)).toBe("hace 2 meses");
  });

  it("usa singular para un mes", () => {
    expect(formatRelativeDate("2026-06-27T12:00:00Z", AHORA)).toBe("hace 1 mes");
  });

  it("usa años a partir de trescientos sesenta y cinco días", () => {
    expect(formatRelativeDate("2025-07-27T12:00:00Z", AHORA)).toBe("hace 1 año");
  });

  it("dice «hoy» para una fecha futura", () => {
    expect(formatRelativeDate(haceDias(-1), AHORA)).toBe("hoy");
  });

  it("distingue el límite entre días y semanas: 6 vs 7 días", () => {
    expect(formatRelativeDate(haceDias(6), AHORA)).toBe("hace 6 días");
    expect(formatRelativeDate(haceDias(7), AHORA)).toBe("hace 1 semana");
  });

  it("distingue el límite entre semanas y meses: 27 vs 28 días", () => {
    expect(formatRelativeDate(haceDias(27), AHORA)).toBe("hace 3 semanas");
    expect(formatRelativeDate(haceDias(28), AHORA)).toBe("hace 1 mes");
  });

  it("no salta a «4 semanas» en 29 días: sigue siendo 1 mes", () => {
    expect(formatRelativeDate(haceDias(29), AHORA)).toBe("hace 1 mes");
    expect(formatRelativeDate(haceDias(30), AHORA)).toBe("hace 1 mes");
  });

  it("distingue el límite entre meses y años: 363 vs 365 días", () => {
    expect(formatRelativeDate(haceDias(363), AHORA)).toBe("hace 1 año");
    expect(formatRelativeDate(haceDias(365), AHORA)).toBe("hace 1 año");
  });
});
