import { describe, expect, it } from "vitest";
import {
  formatBookClosure,
  formatDateShort,
  formatPrecision,
  formatRelativeDate,
  formatSignedMm,
  formatTrendDeviation,
} from "./format";

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

describe("formatPrecision", () => {
  it("formatea un número con separador de miles en es-CO", () => {
    expect(formatPrecision(1001)).toBe("1:1.001");
    expect(formatPrecision(528479954)).toBe("1:528.479.954");
    expect(formatPrecision(46)).toBe("1:46");
  });

  it("redondea a entero: una precisión relativa no lleva decimales", () => {
    expect(formatPrecision(5000.4)).toBe("1:5.000");
    expect(formatPrecision(5000.6)).toBe("1:5.001");
  });

  it("representa el cierre exacto como 1:∞", () => {
    expect(formatPrecision(Infinity)).toBe("1:∞");
  });

  it("devuelve el guion largo cuando no hay precisión", () => {
    expect(formatPrecision(null)).toBe("—");
    expect(formatPrecision(undefined)).toBe("—");
  });

  // El listado lee `relative_precision`, que se persiste como TEXTO ya
  // formateado por el servidor y SIN separador de miles ("1:1001"). El editor
  // formatea el número y sí lo pone ("1:1.001"). Ese desacuerdo es la deuda
  // que esta función cierra: el mismo proceso se leía distinto en dos
  // pantallas. Aceptar también la cadena persistida permite que el listado
  // use el mismo formateador sin cambiar el esquema.
  it("normaliza la cadena ya persistida por el servidor", () => {
    expect(formatPrecision("1:1001")).toBe("1:1.001");
    expect(formatPrecision("1:528479954")).toBe("1:528.479.954");
    expect(formatPrecision("1:46")).toBe("1:46");
  });

  it("acepta una cadena que ya trae separadores, sin duplicarlos", () => {
    expect(formatPrecision("1:1.001")).toBe("1:1.001");
  });

  it("respeta el infinito ya persistido como cadena", () => {
    expect(formatPrecision("1:∞")).toBe("1:∞");
  });

  it("devuelve el guion largo ante una cadena vacía o ilegible", () => {
    expect(formatPrecision("")).toBe("—");
    expect(formatPrecision("sin datos")).toBe("—");
  });
});

describe("formatTrendDeviation (Fase 12)", () => {
  it("dice hacia dónde venía el punto y hacia dónde lo lleva la lectura", () => {
    expect(
      formatTrendDeviation({
        kind: "contrary",
        partialMm: 7,
        previousVelocity: -1.116,
        expectedMm: 1.1,
      }),
    ).toBe(
      "Se sale de la tendencia: el punto venía bajando 1,1 mm/mes y esta lectura lo hace subir 7,0 mm. Verifica la lectura.",
    );
  });

  it("no dice «bajando 0,0 mm/mes» de un punto que estaba quieto", () => {
    expect(
      formatTrendDeviation({
        kind: "contrary",
        partialMm: 2,
        previousVelocity: 0,
        expectedMm: 0,
      }),
    ).toBe(
      "Se sale de la tendencia: el punto venía estable y esta lectura lo hace subir 2,0 mm. Verifica la lectura.",
    );
  });

  it("dice cuánto se movió frente a lo que su ritmo preveía", () => {
    expect(
      formatTrendDeviation({
        kind: "excessive",
        partialMm: -18,
        previousVelocity: -5.9,
        expectedMm: 5.8,
      }),
    ).toBe(
      "Se sale de la tendencia: baja 18,0 mm cuando su ritmo anterior preveía unos 5,8 mm. Verifica la lectura.",
    );
  });
});

describe("formatDateShort (Fase 18)", () => {
  it("da día, mes abreviado y año", () => {
    const s = formatDateShort("2025-01-07");
    expect(s).toMatch(/^7 ene\.? 2025$/);
  });
});

describe("formatSignedMm (Fase 18)", () => {
  it("pone el signo + a los positivos y evita el -0.0", () => {
    expect(formatSignedMm(1.26)).toBe("+1.3");
    expect(formatSignedMm(-2)).toBe("-2.0");
    expect(formatSignedMm(-0.01)).toBe("0.0");
    expect(formatSignedMm(null)).toBe("—");
  });
});

describe("formatBookClosure (Fase 18)", () => {
  it("distingue dentro, fuera, sin tolerancia e incompleta", () => {
    expect(formatBookClosure(1.3, 4.87, true)).toEqual({
      value: "+1.3 mm",
      detail: "Dentro de tolerancia (±4.9 mm)",
      status: "ok",
    });
    expect(formatBookClosure(-6, 4.87, false).status).toBe("out");
    expect(formatBookClosure(1.3, null, null).detail).toBe("Sin tolerancia: faltan distancias");
    expect(formatBookClosure(null, null, null).status).toBe("unknown");
  });
});
