import { describe, expect, it } from "vitest";
import { formatRelativeDate } from "./format";

const AHORA = new Date("2026-07-27T12:00:00Z");

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
});
