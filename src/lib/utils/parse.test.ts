import { describe, expect, it } from "vitest";
import { isInvalidNumber, parseNumber, readNumberText } from "./parse";

describe("parseNumber — coma o punto decimal (Fase 20, UI2)", () => {
  it("acepta la coma y el punto como separador decimal", () => {
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("1.5")).toBe(1.5);
    expect(parseNumber("100,3027")).toBe(100.3027);
    expect(parseNumber("2541.7545")).toBe(2541.7545);
  });

  it("admite signo, espacios alrededor y enteros", () => {
    expect(parseNumber(" -0,25 ")).toBe(-0.25);
    expect(parseNumber("+3")).toBe(3);
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("0")).toBe(0);
  });

  it("admite los estados intermedios de quien teclea", () => {
    expect(parseNumber("1,")).toBe(1);
    expect(parseNumber(",5")).toBe(0.5);
    expect(parseNumber(".5")).toBe(0.5);
  });

  it("vacío es null", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
  });

  it("un texto que no es número también es null, nunca NaN", () => {
    for (const text of ["abc", "1,2,3", "1.234,5", "1,234.5", "1e3", "Infinity", "-", ",", "1 5", "5m"]) {
      expect(parseNumber(text)).toBeNull();
    }
  });
});

describe("isInvalidNumber — distingue lo mal escrito de lo vacío", () => {
  it("vacío no es inválido: es un dato que falta", () => {
    expect(isInvalidNumber("")).toBe(false);
    expect(isInvalidNumber("  ")).toBe(false);
  });

  it("un número con coma o punto no es inválido", () => {
    expect(isInvalidNumber("1,5")).toBe(false);
    expect(isInvalidNumber("1.5")).toBe(false);
    expect(isInvalidNumber("1,")).toBe(false);
  });

  it("un separador de miles no se adivina: es inválido", () => {
    expect(isInvalidNumber("1.234,5")).toBe(true);
    expect(isInvalidNumber("1,234.5")).toBe(true);
    expect(isInvalidNumber("1,2,3")).toBe(true);
  });

  it("letras, exponentes y un signo suelto son inválidos", () => {
    expect(isInvalidNumber("abc")).toBe(true);
    expect(isInvalidNumber("1e3")).toBe(true);
    expect(isInvalidNumber("-")).toBe(true);
  });
});

describe("readNumberText", () => {
  it("devuelve el tipo de contenido", () => {
    expect(readNumberText("")).toEqual({ kind: "empty" });
    expect(readNumberText("2,75")).toEqual({ kind: "number", value: 2.75 });
    expect(readNumberText("2,7,5")).toEqual({ kind: "invalid" });
  });
});
