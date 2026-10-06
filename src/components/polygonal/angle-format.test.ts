import { describe, expect, it } from "vitest";
import { dmsFromFields, formatAngle, formatSeconds } from "./angle-format";

describe("formatAngle", () => {
  it("en DMS, con segundos enteros o a la décima", () => {
    expect(formatAngle(211 + 15 / 60 + 7 / 3600, "dms")).toBe("211°15′07″");
    expect(formatAngle(211 + 15 / 60 + 5.3 / 3600, "dms")).toBe("211°15′05.3″");
    expect(formatAngle(0, "dms")).toBe("0°00′00″");
  });
  it("en grados decimales, con los decimales de la captura", () => {
    expect(formatAngle(211 + 15 / 60 + 7 / 3600, "decimal")).toBe("211.251944°");
  });
  it("sin valor, una raya", () => {
    expect(formatAngle(null, "dms")).toBe("—");
    expect(formatAngle(Number.NaN, "decimal")).toBe("—");
  });
});

describe("formatSeconds", () => {
  it("con signo, a la décima o con los decimales que se pidan", () => {
    expect(formatSeconds(12)).toBe("+12.0″");
    expect(formatSeconds(-1.7142857, 2)).toBe("−1.71″");
    expect(formatSeconds(0)).toBe("0.0″");
    expect(formatSeconds(-0.01)).toBe("0.0″");
    expect(formatSeconds(null)).toBe("—");
  });
});

describe("dmsFromFields", () => {
  it("lee grados, minutos y segundos, con coma o punto", () => {
    expect(dmsFromFields({ deg: "124", min: "29", sec: "42,5" })).toEqual({ deg: 124, min: 29, sec: 42.5 });
  });
  it("minutos y segundos en blanco valen 0; sin grados no hay lectura", () => {
    expect(dmsFromFields({ deg: "90", min: "", sec: "" })).toEqual({ deg: 90, min: 0, sec: 0 });
    expect(dmsFromFields({ deg: "", min: "1", sec: "2" })).toBeNull();
  });
  it("un texto que no es número no es una lectura; el rango lo juzga readingDmsError", () => {
    expect(dmsFromFields({ deg: "9x", min: "0", sec: "0" })).toBeNull();
    expect(dmsFromFields({ deg: "90", min: "a", sec: "0" })).toBeNull();
    expect(dmsFromFields({ deg: "90", min: "61", sec: "0" })).toEqual({ deg: 90, min: 61, sec: 0 });
  });
});
