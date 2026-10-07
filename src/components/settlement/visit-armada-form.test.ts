import { describe, expect, it } from "vitest";
import type { BookRowPayload } from "@/types/settlement";
import { composeArmada, readCount, readVisitArmadaForm, visitArmadaFormOf, type VisitArmadaForm } from "./visit-armada-form";

const BMS = [{ code: "BM-1", elevation: 100 }];
const blank = { reading: "", distance: "", upper: "", lower: "" };
const form = (patch: Partial<VisitArmadaForm> = {}): VisitArmadaForm => ({
  from: "bm",
  backCode: "BM-1",
  back: { ...blank, reading: "1.8637", distance: "28.4" },
  points: [
    { pointCode: "TA-01", reading: "1.2682" },
    { pointCode: "TA-02", reading: "" },
  ],
  noFore: false,
  foreCode: "",
  fore: blank,
  ...patch,
});

describe("readVisitArmadaForm (Fase 37, decisión 9: se guarda a medias)", () => {
  it("lo que falta por leer queda en null", () => {
    const read = readVisitArmadaForm(form(), BMS);
    expect(read).toEqual({
      armada: {
        from: "bm",
        backCode: "BM-1",
        back: { reading: 1.8637, distanceM: 28.4, upperM: null, lowerM: null },
        points: [
          { pointCode: "TA-01", reading: 1.2682 },
          { pointCode: "TA-02", reading: null },
        ],
        fore: null,
      },
    });
  });

  it("acepta la coma decimal", () => {
    const read = readVisitArmadaForm(form({ back: { ...blank, reading: "1,45" } }), BMS);
    expect("armada" in read && read.armada.back.reading).toBe(1.45);
  });

  it("con los dos hilos, la distancia sale de ellos", () => {
    const read = readVisitArmadaForm(form({ back: { reading: "1.45", distance: "", upper: "1.59", lower: "1.31" } }), BMS);
    expect("armada" in read && read.armada.back.distanceM).toBeCloseTo(28, 6);
  });

  it("un número mal escrito es error, con su vista", () => {
    expect(readVisitArmadaForm(form({ back: { ...blank, reading: "1.4x" } }), BMS)).toEqual({
      error: "Vista atrás: la lectura no es un número.",
    });
    expect(readVisitArmadaForm(form({ points: [{ pointCode: "TA-01", reading: "abc" }] }), BMS)).toEqual({
      error: "TA-01: la lectura no es un número.",
    });
  });

  it("una fila de punto vacía se salta; con lectura y sin código es error", () => {
    const read = readVisitArmadaForm(form({ points: [{ pointCode: "", reading: "" }] }), BMS);
    expect("armada" in read && read.armada.points).toEqual([]);
    expect(readVisitArmadaForm(form({ points: [{ pointCode: " ", reading: "1.2" }] }), BMS)).toEqual({
      error: "Punto 1: falta el código.",
    });
  });

  it("la V− a un BM del lugar es de tipo BM; a otro punto, punto de cambio", () => {
    const toBm = readVisitArmadaForm(form({ foreCode: "bm-1", fore: { ...blank, reading: "1.2764" } }), BMS);
    expect("armada" in toBm && toBm.armada.fore).toMatchObject({ pointCode: "bm-1", pointType: "bm" });
    const toAux = readVisitArmadaForm(form({ foreCode: "CP-1", fore: blank }), BMS);
    expect("armada" in toAux && toAux.armada.fore).toEqual({
      pointCode: "CP-1",
      pointType: "pc",
      visual: { reading: null, distanceM: null, upperM: null, lowerM: null },
    });
  });

  it("sin vista adelante, o sin nada tecleado en ella, la armada termina en sus puntos", () => {
    const marked = readVisitArmadaForm(form({ noFore: true, foreCode: "CP-1" }), BMS);
    expect("armada" in marked && marked.armada.fore).toBeNull();
    const untouched = readVisitArmadaForm(form(), BMS);
    expect("armada" in untouched && untouched.armada.fore).toBeNull();
  });

  it("una V− con lectura y sin punto es error", () => {
    expect(readVisitArmadaForm(form({ fore: { ...blank, reading: "1.2" } }), BMS)).toEqual({
      error: "Vista adelante: el punto necesita un código.",
    });
  });
});

describe("visitArmadaFormOf", () => {
  it("una armada guardada vuelve al formulario como texto", () => {
    const f = visitArmadaFormOf(
      {
        from: "pc",
        backCode: "CP-1",
        back: { reading: 0.6263, distanceM: 28.2, upperM: null, lowerM: null },
        points: [{ pointCode: "TA-05", reading: null }],
        fore: null,
      },
      { from: "bm", backCode: "" },
    );
    expect(f).toEqual({
      from: "pc",
      backCode: "CP-1",
      back: { reading: "0.6263", distance: "28.2", upper: "", lower: "" },
      points: [{ pointCode: "TA-05", reading: "" }],
      noFore: true,
      foreCode: "",
      fore: blank,
    });
  });

  it("una nueva sale de donde se pidió, sin puntos y con la V− por teclear", () => {
    expect(visitArmadaFormOf(null, { from: "bm", backCode: "BM-1" })).toEqual({
      from: "bm",
      backCode: "BM-1",
      back: blank,
      points: [],
      noFore: false,
      foreCode: "",
      fore: blank,
    });
  });
});

describe("composeArmada", () => {
  const row = (pointCode: string, pointType: BookRowPayload["pointType"], v: Partial<BookRowPayload> = {}): BookRowPayload => ({
    pointCode, pointType, startsSection: false, backsight: null, foresight: null, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null, ...v,
  });
  const armada = (reading: number) => ({
    from: "bm" as const,
    backCode: "BM-1",
    back: { reading, distanceM: null, upperM: null, lowerM: null },
    points: [{ pointCode: "TA-01", reading: 1.2 }],
    fore: null,
  });

  it("la armada siguiente a la última se agrega", () => {
    const out = composeArmada([], 0, armada(1.5));
    expect("rows" in out && out.rows.map((x) => x.pointCode)).toEqual(["BM-1", "TA-01"]);
  });

  it("una que ya está se reescribe, sin duplicarla", () => {
    const rows = [row("BM-1", "bm", { startsSection: true, backsight: 1.5 }), row("TA-01", "intermediate", { foresight: 1.2 })];
    const out = composeArmada(rows, 0, armada(1.6));
    expect("rows" in out && out.rows).toHaveLength(2);
    expect("rows" in out && out.rows[0]!.backsight).toBe(1.6);
  });
});

describe("readCount", () => {
  it("cuenta los puntos con lectura de los que tienen código", () => {
    expect(readCount(form().points)).toEqual({ read: 1, total: 2 });
    expect(readCount([...form().points, { pointCode: "", reading: "" }])).toEqual({ read: 1, total: 2 });
  });
});
