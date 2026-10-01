import { describe, it, expect } from "vitest";
import {
  averageReadings,
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
  readingSpreadSeconds,
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
    // 45.50426° son 45°30′15.336″: se guarda 15.3″, 0.036″ menos, y se ve.
    expect(roundsOnStorage(45.50426)).toBe(true);
    expect(decimalToDmsFields(45.50426)).toEqual({ deg: "45", min: "30", sec: "15.3" });
    expect(roundsOnStorage(Number(formatDecimalDegrees(dmsToDecimal(45, 30, 15.3))))).toBe(false);
  });

  it("pasar a la vista decimal no avisa de un redondeo que nadie tecleó (Fase 26, C-17)", () => {
    // 10°00′00.1″ se muestra 10.000028, que no cae en la malla de 0.1″.
    expect(formatDecimalDegrees(dmsToDecimal(10, 0, 0.1))).toBe("10.000028");
    expect(roundsOnStorage(10.000028)).toBe(false);
    // Toda la malla de 0.1″ de un grado, vista en decimal, sin aviso.
    for (let tenths = 0; tenths < 36000; tenths++) {
      const shown = Number(formatDecimalDegrees(dmsToDecimal(10, 0, tenths / 10)));
      expect(roundsOnStorage(shown)).toBe(false);
    }
  });

  it("los segundos se leen con coma decimal (Fase 26, C-5)", () => {
    expect(dmsFieldsToDecimal(f("45", "30", "12,5"))).toBeCloseTo(45 + 30 / 60 + 12.5 / 3600, 12);
    expect(dmsFieldsToDecimal(f("45", "30", "12.5"))).toBe(dmsFieldsToDecimal(f("45", "30", "12,5")));
    expect(dmsFieldsToDecimal(f("45", "3x", "0"))).toBeNull();
  });

  it("muestra seis decimales", () => {
    expect(formatDecimalDegrees(45.5)).toBe("45.500000");
  });
});

describe("promedio y dispersión de lecturas (Fase 26, C-4 y C-6)", () => {
  const dms = (d: number, m: number, sec: number) => dmsToDecimal(d, m, sec);

  it("redondea el promedio a la décima de segundo que se guarda", () => {
    // 45°, 45°00′01″ y 45°00′01″: 0.667″ de media, que se guarda 0.7″.
    expect(averageReadings([dms(45, 0, 0), dms(45, 0, 1), dms(45, 0, 1)])).toBe(dms(45, 0, 0.7));
  });

  it("promedia a través de 0°/360°", () => {
    // Desde 359°59′56″: +0″, +6″ y +10″, media +5.333″ → 0°00′01.3″, no 120°.
    const values = [dms(359, 59, 56), dms(0, 0, 2), dms(0, 0, 6)];
    expect(averageReadings(values)).toBe(dms(0, 0, 1.3));
    expect(readingSpreadSeconds(values)).toBeCloseTo(10, 9);
  });

  it("360°00′00″ exacto sigue siendo 360°", () => {
    expect(averageReadings([360, 360, 360])).toBe(360);
  });

  it("sin lecturas no hay promedio, y con una no hay dispersión", () => {
    expect(averageReadings([])).toBeNull();
    expect(readingSpreadSeconds([dms(45, 0, 0)])).toBeNull();
  });
});
