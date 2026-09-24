import { describe, it, expect } from "vitest";
import {
  azimuthFromCoordinates,
  cosDeg,
  decimalToDms,
  decimalToDmsFields,
  dmsFieldsToDecimal,
  formatDecimalDegrees,
  roundsOnStorage,
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

describe("azimuthFromCoordinates", () => {
  it("reproduce el azimut de amarre de la cartera TT4", () => {
    // V10 → TT4, hoja BRUJULA de docs/carteras/poligonales.xlsx. La hoja trae
    // las coordenadas de TT4 en su bloque X23:Z25 y el azimut tecleado en
    // O6:Q6 (330°35'57.23"). Deben coincidir.
    const az = azimuthFromCoordinates(
      100135.666,
      101440.525,
      100142.809,
      101436.5,
    );
    // Se compara en segundos de arco, que es la unidad que significa algo: la
    // hoja da el Este de TT4 con un solo decimal (101436.5), así que el dato de
    // origen ya viene redondeado. El acuerdo real es de 0.0007", siete órdenes
    // de magnitud por debajo de lo que resuelve cualquier equipo.
    const tecleado = 330 + 35 / 60 + 57.23 / 3600;
    expect(Math.abs(az - tecleado) * 3600).toBeLessThan(0.01);
  });

  it("devuelve los cuatro cuadrantes cardinales", () => {
    expect(azimuthFromCoordinates(0, 0, 10, 0)).toBeCloseTo(0, 9);
    expect(azimuthFromCoordinates(0, 0, 0, 10)).toBeCloseTo(90, 9);
    expect(azimuthFromCoordinates(0, 0, -10, 0)).toBeCloseTo(180, 9);
    expect(azimuthFromCoordinates(0, 0, 0, -10)).toBeCloseTo(270, 9);
  });

  it("normaliza el tercer cuadrante en vez de devolver negativo", () => {
    expect(azimuthFromCoordinates(0, 0, -10, -10)).toBeCloseTo(225, 9);
  });

  it("devuelve 0 cuando los dos puntos coinciden", () => {
    expect(azimuthFromCoordinates(5, 5, 5, 5)).toBe(0);
  });
});

describe("captura en grados decimales (Fase 13, P1)", () => {
  const f = (deg: string, min: string, sec: string) => ({ deg, min, sec });

  it("ida y vuelta DMS → decimal (6 cifras) → DMS exacta en pasos de 0.1″", () => {
    // Barrido: todos los segundos a la décima en varios grados y minutos,
    // incluidos los límites 0°0′0″ y 359°59′59.9″.
    for (const deg of [0, 1, 45, 180, 359]) {
      for (const min of [0, 1, 30, 59]) {
        for (let tenths = 0; tenths < 600; tenths++) {
          const sec = tenths / 10;
          const texto = formatDecimalDegrees(dmsToDecimal(deg, min, sec));
          const vuelta = decimalToDmsFields(Number(texto));
          expect(vuelta).toEqual({ deg: String(deg), min: String(min), sec: String(sec) });
        }
      }
    }
  });

  it("un DMS incompleto toma 0 en lo que falta; sin grados no hay ángulo", () => {
    expect(dmsFieldsToDecimal(f("45", "", ""))).toBe(45);
    expect(dmsFieldsToDecimal(f("45", "30", ""))).toBe(45.5);
    expect(dmsFieldsToDecimal(f("", "30", "0"))).toBeNull();
    expect(dmsFieldsToDecimal(f("x", "", ""))).toBeNull();
  });

  it("un decimal con más precisión que 0.1″ se redondea al guardarse, y se avisa", () => {
    expect(roundsOnStorage(45.5042501)).toBe(true);
    expect(decimalToDmsFields(45.5042501)).toEqual({ deg: "45", min: "30", sec: "15.3" });
    expect(roundsOnStorage(Number(formatDecimalDegrees(dmsToDecimal(45, 30, 15.3))))).toBe(false);
  });

  it("muestra seis decimales", () => {
    expect(formatDecimalDegrees(45.5)).toBe("45.500000");
  });
});
