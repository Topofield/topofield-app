// Tests de la importación de libretas (Fase 16). Los valores esperados son los
// del PRD (docs/prds/15-importar-nivel-digital.md, «Pruebas»): el crudo real
// de nivel digital, leído del repositorio, promediado y redondeado a las
// columnas de la libreta.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeLeveling, totalDistanceFromReadings } from "@/lib/calculations/leveling";
import type { LevelingType, ReadingInput } from "@/types/leveling";
import {
  CSV_TEMPLATE,
  detectTurnSetup,
  proposedLevelingType,
  readLevelingFile,
  toLibreta,
  type ImportedLevelingFile,
  type LibretaRow,
} from "./index";

const CRUDO = readFileSync(join(process.cwd(), "docs/carteras/CRDUDO-TRAMO2.L"), "latin1");

function read(text: string): ImportedLevelingFile {
  const r = readLevelingFile(text);
  if (!r.ok) throw new Error(r.error);
  return r.file;
}

function input(row: LibretaRow): ReadingInput {
  return {
    ...row,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    distanceAccumulatedKm: null,
  };
}

function compute(rows: { forward: LibretaRow[]; return: LibretaRow[] | null }, type: LevelingType) {
  return computeLeveling({
    type,
    startElevation: 2541.7545,
    endElevation: null,
    order: "tercer_orden",
    forward: rows.forward.map(input),
    return: rows.return?.map(input) ?? null,
  });
}

describe("lector del .L de Leica — el crudo real", () => {
  const file = read(CRUDO);

  it("reconoce el formato y la cabecera", () => {
    expect(file.format).toBe("leica-l");
    expect(file.startPoint).toEqual({ code: "C10", elevation: 2541.7545 });
    expect(file.instrumentSummary).toEqual({ heightDifference: -0.0002, distance: 1397.284 });
  });

  it("16 armadas, 64 visuales promediadas a 32", () => {
    expect(file.setups).toHaveLength(16);
    expect(file.rawSights).toBe(64);
    expect(file.setups.every((s) => s.fores.length === 1)).toBe(true);
  });

  it("promedia las repeticiones y redondea a la columna", () => {
    // 1.6494 y 1.6485 → 1.64895 → 1.6490; 48.847 y 48.839 → 48.843.
    expect(file.setups[0]!.back).toEqual({ point: "C10", reading: 1.649, distance: 48.843 });
    expect(file.setups[15]!.fores[0]).toEqual({ point: "C10", reading: 1.7206, distance: 46.983 });
  });

  it("la calidad: mayor dispersión 1.5 mm y mayor σ 2.3 mm", () => {
    expect(file.quality.maxRepeatSpreadMm).toBeCloseTo(1.5, 6);
    expect(file.quality.maxSigmaMm).toBe(2.3);
  });

  it("detecta el giro en la armada 9", () => {
    expect(detectTurnSetup(file)).toBe(9);
  });

  it("un archivo renombrado se sigue leyendo: detecta por el contenido", () => {
    expect(readLevelingFile(CRUDO).ok).toBe(true);
  });

  it("una línea desconocida o mal formada avisa, no rompe", () => {
    const lines = CRUDO.split("\r\n");
    lines.splice(3, 0, "X esto no es una medición");
    lines.splice(4, 0, "G    roto");
    const f = read(lines.join("\r\n"));
    expect(f.setups).toHaveLength(16);
    expect(f.warnings).toHaveLength(2);
  });
});

describe("paso a libreta — el crudo como un recorrido", () => {
  const rows = toLibreta(read(CRUDO), { kind: "single" });
  const result = compute(rows, proposedLevelingType(rows, "closed"));

  it("17 filas de C10 a C10, con los tipos deducidos", () => {
    expect(rows.forward).toHaveLength(17);
    expect(rows.return).toBeNull();
    expect(rows.forward[0]).toMatchObject({ pointCode: "C10", pointType: "bm", backsight: 1.649 });
    expect(rows.forward[16]).toMatchObject({ pointCode: "C10", pointType: "bm", foresight: 1.7206 });
    expect(rows.forward.slice(1, -1).every((r) => r.pointType === "pc")).toBe(true);
  });

  it("propone cerrada y cierra con −0.4 mm sobre 1397.288 m", () => {
    expect(proposedLevelingType(rows, "open")).toBe("closed");
    expect(result.closureErrorMm!).toBeCloseTo(-0.4, 6);
    expect(totalDistanceFromReadings(rows.forward.map(input))).toBeCloseTo(1.397288, 6);
    expect(result.toleranceMm!).toBeCloseTo(14.18, 2);
    expect(result.arithmeticCheckOk).toBe(true);
  });
});

describe("paso a libreta — el crudo como ida y vuelta", () => {
  const rows = toLibreta(read(CRUDO), { kind: "split", turnSetup: 9 });
  const result = compute(rows, proposedLevelingType(rows, "closed"));

  it("ida C10 → C18 y vuelta C18 → C10, nueve filas cada una", () => {
    expect(rows.forward.map((r) => r.pointCode)).toEqual(
      ["C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18"],
    );
    expect(rows.return!.map((r) => r.pointCode)).toEqual(
      ["C18", "C17", "C16", "C15", "C14", "C13", "C12", "C11", "C10"],
    );
    expect(rows.forward.at(-1)!.pointType).toBe("bm");
    expect(rows.return![0]!.pointType).toBe("bm");
  });

  it("propone abierta con vuelta", () => {
    expect(proposedLevelingType(rows, "closed")).toBe("open");
    expect(proposedLevelingType(rows, "link")).toBe("link");
  });

  it("desniveles, distancias y discrepancia del PRD", () => {
    expect(result.forward.heightDifference).toBeCloseTo(1.1636, 6);
    expect(result.return!.heightDifference).toBeCloseTo(-1.164, 6);
    expect(totalDistanceFromReadings(rows.forward.map(input))).toBeCloseTo(0.698839, 6);
    expect(totalDistanceFromReadings(rows.return!.map(input))).toBeCloseTo(0.698449, 6);
    expect(result.discrepancyMm!).toBeCloseTo(0.4, 6);
    expect(result.discrepancyToleranceMm!).toBeCloseTo(14.18, 2);
  });

  it("la vuelta parte de C18 = 2542.9181 (hallazgo 3)", () => {
    expect(result.forward.readings.at(-1)!.elevationCalculated).toBeCloseTo(2542.9181, 6);
    expect(result.return!.readings[0]!.elevationCalculated).toBeCloseTo(2542.9181, 6);
  });
});

describe("plantilla CSV de TopoField", () => {
  it("la plantilla descargable se lee a sí misma", () => {
    const f = read(CSV_TEMPLATE);
    expect(f.format).toBe("topofield-csv");
    const rows = toLibreta(f, { kind: "single" });
    expect(rows.forward.map((r) => r.pointCode)).toEqual(["BM-1", "PC-1", "BM-1"]);
    expect(rows.forward.map((r) => r.pointType)).toEqual(["bm", "pc", "bm"]);
  });

  it("acepta ; con coma decimal, que es lo que exporta Excel en español", () => {
    const f = read(
      [
        "recorrido;punto;tipo;v_mas;v_menos;dist_mas;dist_menos",
        "ida;A;bm;1,5000;;30,0;",
        "ida;R1;radiacion;;1,2000;;12,5",
        "ida;B;;1,4000;1,1000;31,0;29,0",
        "ida;A;;;1,8000;;30,5",
      ].join("\r\n"),
    );
    // Sin filas de vuelta no hay giro, aunque el circuito vuelva a A.
    expect(detectTurnSetup(f)).toBeNull();
    const rows = toLibreta(f, { kind: "single" });
    expect(rows.forward.map((r) => r.pointType)).toEqual(["bm", "intermediate", "pc", "bm"]);
    expect(rows.forward[2]).toMatchObject({ backsight: 1.4, foresight: 1.1, backDistanceM: 31, foreDistanceM: 29 });
  });

  it("trae la división ida/vuelta declarada", () => {
    const f = read(
      [
        "recorrido,punto,tipo,v_mas,v_menos,dist_mas,dist_menos",
        "ida,A,bm,1.5,,30,",
        "ida,B,,,1.0,,30",
        "vuelta,B,,1.0,,30,",
        "vuelta,A,,,1.5,,30",
      ].join("\n"),
    );
    expect(detectTurnSetup(f)).toBe(2);
    const rows = toLibreta(f, { kind: "split", turnSetup: 2 });
    expect(rows.forward).toHaveLength(2);
    expect(rows.return).toHaveLength(2);
  });

  it("explica la fila que no entiende", () => {
    const r = readLevelingFile("recorrido,punto,tipo,v_mas,v_menos,dist_mas,dist_menos\nida,A,xx,1.5,,30,");
    expect(r).toEqual({ ok: false, error: "Fila 2: el tipo debe ser bm, pc o radiacion, o ir vacío." });
  });
});

describe("detector", () => {
  it("un archivo cualquiera dice qué formatos se leen", () => {
    const r = readLevelingFile("nombre,edad\nAna,30");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Leica.*Plantilla CSV/);
  });
});
