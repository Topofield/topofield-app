// Puntos homólogos ida-vuelta (Fase 17, N6). Los valores esperados son los del
// PRD (docs/prds/16-homologos-ida-vuelta.md): la columna `P` de la hoja de El
// Verjón y los residuos del crudo de nivel digital leído como ida y vuelta.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareHomologousPoints, computeLeveling, samePointCode } from "./leveling";
import { readLevelingFile, toLibreta, type LibretaRow } from "@/lib/import/leveling";
import type { LevelingInput, PointType, ReadingInput } from "@/types/leveling";

type Row = [string, PointType, number | null, number | null];

function reading([pointCode, pointType, backsight, foresight]: Row): ReadingInput {
  return {
    pointCode,
    pointType,
    backsight,
    foresight,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM: null,
    foreDistanceM: null,
    distanceAccumulatedKm: null,
  };
}

function input(forward: Row[], back: Row[] | null, over: Partial<LevelingInput> = {}): LevelingInput {
  return {
    type: "open",
    startElevation: 3288.5,
    endElevation: null,
    order: "tercer_orden",
    forward: forward.map(reading),
    return: back?.map(reading) ?? null,
    ...over,
  };
}

// Hoja corregida de El Verjón: V+ y V− son el hilo medio; la radiación AUX1
// lleva su vista intermedia como V−. Los códigos van como en la hoja, con el
// `AUX1` / `AUX 1` de la ida y la vuelta y un espacio final en la vuelta.
const VERJON_IDA: Row[] = [
  ["D1", "bm", 1.209, null],
  ["C 1", "pc", 3.275, 0.268],
  ["C 2", "pc", 3.469, 0.224],
  ["C 3", "pc", 3.952, 0.092],
  ["AUX1", "intermediate", null, 0.194],
  ["C 4", "pc", 3.314, 0.244],
  ["C 5", "pc", 3.013, 0.124],
  ["C 6", "pc", 3.549, 0.145],
  ["C 7", "pc", 3.16, 0.132],
  ["D3", "pc", 2.395, 0.87],
  ["C 8", "pc", 2.349, 0.195],
  ["D4", "bm", null, 0.808],
];
const VERJON_VUELTA: Row[] = [
  ["D4", "bm", 0.865, null],
  ["C 8", "pc", 0.802, 2.407],
  ["D3", "pc", 0.531, 3.003],
  ["C 7", "pc", 0.092, 2.821],
  ["C 6", "pc", 0.083, 3.51],
  ["C 5", "pc", 0.266, 2.953],
  ["C 4", "pc", 0.157, 3.456],
  ["AUX 1", "intermediate", null, 0.107],
  ["C 3 ", "pc", 0.022, 3.865],
  ["C 2", "pc", 0.134, 3.4],
  ["C 1", "pc", 0.452, 3.186],
  ["D1", "bm", null, 1.391],
];

describe("puntos homólogos — El Verjón", () => {
  const result = computeLeveling(input(VERJON_IDA, VERJON_VUELTA));
  const cmp = compareHomologousPoints(result)!;

  it("reproduce la columna P de la hoja, en el orden de la vuelta", () => {
    expect(cmp.points.map((p) => p.pointCode)).toEqual([
      "D4", "C 8", "D3", "C 7", "C 6", "C 5", "C 4", "AUX 1", "C 3", "C 2", "C 1", "D1",
    ]);
    const mm = cmp.points.map((p) => Math.round(p.residualMm * 10) / 10);
    expect(mm).toEqual([0, -1, -2, -2, -3, -5, -5, -5, -5, -6, -7, -5]);
  });

  it("empareja AUX1 con AUX 1, que es una radiación", () => {
    const aux = cmp.points.find((p) => p.pointCode === "AUX 1")!;
    expect(aux.pointType).toBe("intermediate");
    expect(aux.forwardElevation).toBeCloseTo(3299.627, 6);
  });

  it("el último residuo es la discrepancia de la sección", () => {
    expect(Math.abs(cmp.points.at(-1)!.residualMm)).toBeCloseTo(result.discrepancyMm!, 6);
    expect(cmp.lastIsDiscrepancy).toBe(true);
    expect(cmp.skippedCodes).toEqual([]);
  });
});

describe("puntos homólogos — el crudo de nivel digital como ida y vuelta", () => {
  const read = readLevelingFile(
    readFileSync(join(process.cwd(), "docs/carteras/CRDUDO-TRAMO2.L"), "latin1"),
  );
  if (!read.ok) throw new Error(read.error);
  const rows = toLibreta(read.file, { kind: "split", turnSetup: 9 });
  const toInput = (r: LibretaRow): ReadingInput => ({
    ...r,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    distanceAccumulatedKm: null,
  });
  const result = computeLeveling({
    type: "open",
    startElevation: 2541.7545,
    endElevation: null,
    order: "tercer_orden",
    forward: rows.forward.map(toInput),
    return: rows.return!.map(toInput),
  });
  const cmp = compareHomologousPoints(result)!;

  it("los residuos del PRD: crecen hasta −5.2 mm y vuelven a −0.4 mm", () => {
    const mm = cmp.points.slice(1).map((p) => Math.round(p.residualMm * 10) / 10);
    expect(mm).toEqual([-2.4, -2.1, -4.5, -5.2, -5.2, -3.5, -2, -0.4]);
    expect(Math.abs(cmp.points.at(-1)!.residualMm)).toBeCloseTo(result.discrepancyMm!, 6);
  });
});

describe("puntos homólogos — cuándo no aparece", () => {
  it("sin vuelta", () => {
    expect(compareHomologousPoints(computeLeveling(input(VERJON_IDA, null)))).toBeNull();
  });

  it("si solo comparten los extremos: la tabla repetiría la discrepancia", () => {
    const back: Row[] = [
      ["D4", "bm", 0.9, null],
      ["PV-1", "pc", 0.5, 2.9],
      ["D1", "bm", null, 1.3],
    ];
    expect(compareHomologousPoints(computeLeveling(input(VERJON_IDA, back)))).toBeNull();
  });

  it("si la vuelta no empieza donde terminó la ida: los residuos saldrían desplazados", () => {
    // La vuelta arranca en C 8, no en D4: el motor le daría la cota de D4.
    expect(compareHomologousPoints(computeLeveling(input(VERJON_IDA, VERJON_VUELTA.slice(1))))).toBeNull();
  });

  it("una fila a medio capturar no se compara", () => {
    const back = VERJON_VUELTA.map((r): Row => (r[0] === "C 5" ? [r[0], r[1], r[2], null] : r));
    const cmp = compareHomologousPoints(computeLeveling(input(VERJON_IDA, back)));
    expect(cmp?.points.every((p) => Number.isFinite(p.residualMm))).toBe(true);
  });

  it("un código repetido en un recorrido no se empareja, y se dice", () => {
    // Cerrada: BM-1 abre y cierra la ida; la vuelta pasa por PC-1 y BM-1.
    const forward: Row[] = [
      ["BM-1", "bm", 1.5, null],
      ["PC-1", "pc", 1.2, 1.0],
      ["BM-1", "bm", null, 1.7],
    ];
    const back: Row[] = [
      ["BM-1", "bm", 1.7, null],
      ["PC-1", "pc", 1.0, 1.2],
      ["BM-1", "bm", null, 1.5],
    ];
    const cmp = compareHomologousPoints(
      computeLeveling(input(forward, back, { type: "closed", startElevation: 100 })),
    )!;
    expect(cmp.points.map((p) => p.pointCode)).toEqual(["PC-1"]);
    expect(cmp.skippedCodes).toEqual(["BM-1"]);
  });
});

describe("samePointCode", () => {
  it("ignora espacios y mayúsculas", () => {
    expect(samePointCode("AUX1", "AUX 1")).toBe(true);
    expect(samePointCode("aux1", "AUX 1 ")).toBe(true);
    expect(samePointCode("C 3 ", "C3")).toBe(true);
    expect(samePointCode("C3", "C4")).toBe(false);
  });
});

describe("puntos homólogos — de enlace", () => {
  it("la vuelta arranca en la cota conocida de llegada: el último residuo no es la discrepancia", () => {
    // Ida con 5 mm de error contra D4: la vuelta parte de la cota conocida.
    const result = computeLeveling(
      input(VERJON_IDA, VERJON_VUELTA, { type: "link", endElevation: 3315.078 }),
    );
    const cmp = compareHomologousPoints(result)!;
    expect(cmp.points[0]!.residualMm).toBeCloseTo(-5, 6);
    expect(Math.abs(cmp.points.at(-1)!.residualMm)).not.toBeCloseTo(result.discrepancyMm!, 3);
    expect(cmp.lastIsDiscrepancy).toBe(false);
  });
});
