import { describe, expect, it } from "vitest";
import { CARTERA_VERJON } from "@/lib/demo/carteras";
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { armadaAt, emptyRow, writeArmada } from "./armadas";
import { armadaEnd, armadaFormOf, armadaProblem, readArmadaForm, readingWarnings, wiresOf } from "./armada-form";
import type { LevelingDraft } from "./leveling-save";

const toDraft = (x: (typeof CARTERA_VERJON.ida)[number]): ReadingDraft => ({
  ...emptyRow(x.code, x.type),
  backsight: x.backsight,
  foresight: x.foresight,
  backDistanceM: x.backDistanceM,
  foreDistanceM: x.foreDistanceM,
});
const ida = CARTERA_VERJON.ida.map(toDraft);

const draft = (type: LevelingDraft["details"]["type"], hasReturnRun = false): LevelingDraft => ({
  details: {
    name: "N",
    type,
    hasReturnRun,
    location: null,
    responsibleName: null,
    responsibleRole: null,
    equipmentBrand: null,
    equipmentModel: null,
    equipmentSerial: null,
    notes: null,
  },
  bm: { startCode: "D1", startElevation: 3288.5, endCode: type === "link" ? "D4" : null, endElevation: null },
  forward: ida,
  return: [],
});

describe("el formulario de la armada", () => {
  it("de la armada guardada al formulario y de vuelta, sin cambios", () => {
    const a = armadaAt(ida, 3);
    const form = armadaFormOf(a, false);
    expect(form.back.reading).toBe("3.952");
    expect(form.intermediates).toEqual([{ pointCode: "AUX1", reading: "0.194" }]);
    expect(readArmadaForm(form, armadaEnd(draft("open", true), "forward"))).toEqual({ armada: a });
  });

  it("con los dos hilos, la distancia sale de ellos y se comprueba el medio", () => {
    const w = wiresOf({ reading: "3.275", distance: "", upper: "3.416", lower: "3.135" })!;
    expect(w.distanceM).toBeCloseTo(28.1, 9);
    expect(w.middle).toMatchObject({ ok: true });
    expect(w.middle!.deltaMm).toBeCloseTo(0.5, 6);
    expect(wiresOf({ reading: "3.300", distance: "", upper: "3.416", lower: "3.135" })!.middle!.ok).toBe(false);
    expect(wiresOf({ reading: "3.275", distance: "28", upper: "3.416", lower: "" })).toBeNull();

    const form = armadaFormOf(null, false);
    form.back = { reading: "3.275", distance: "", upper: "3.416", lower: "3.135" };
    form.forePoint = "C 2";
    form.fore = { reading: "0.224", distance: "17.3", upper: "", lower: "" };
    const read = readArmadaForm(form, armadaEnd(draft("open", true), "forward"));
    expect("armada" in read && read.armada.back).toEqual({ reading: 3.275, distanceM: 28.1, upperM: 3.416, lowerM: 3.135 });
  });

  it("pide la lectura atrás, el punto y la lectura adelante, y números", () => {
    const end = armadaEnd(draft("closed"), "forward");
    const form = armadaFormOf(null, false);
    expect(readArmadaForm(form, end)).toEqual({ error: "Vista atrás: la lectura es obligatoria." });
    form.back.reading = "1.2";
    expect(readArmadaForm(form, end)).toEqual({ error: "Vista adelante: el punto necesita un código." });
    form.forePoint = "C 1";
    expect(readArmadaForm(form, end)).toEqual({ error: "Vista adelante: la lectura es obligatoria." });
    form.fore.reading = "0,8";
    form.back.distance = "treinta";
    expect(readArmadaForm(form, end)).toEqual({ error: "Vista atrás: la distancia no es un número." });
  });

  it("la casilla de fin fija el punto en el BM; sin marcarla, llegar a él pide la casilla", () => {
    const end = armadaEnd(draft("closed"), "forward");
    expect(end).toMatchObject({ label: "Llega al BM", fixedCode: "D1" });
    const form = { ...armadaFormOf(armadaAt(ida, 0), true), forePoint: "" };
    const read = readArmadaForm(form, end);
    expect("armada" in read && read.armada).toMatchObject({ forePoint: "D1", foreType: "bm" });
    expect(readArmadaForm({ ...form, ends: false, forePoint: "d1" }, end)).toEqual({
      error: "Para llegar a D1, marca la casilla «Llega al BM».",
    });
  });

  it("el fin según el tipo y el recorrido", () => {
    expect(armadaEnd(draft("link"), "forward")).toMatchObject({ label: "Llega a D4", fixedCode: "D4" });
    expect(armadaEnd(draft("open", true), "forward")).toMatchObject({ label: "Fin de la ida", fixedCode: null });
    expect(armadaEnd(draft("open", true), "return")).toMatchObject({ label: "Llega a D1", fixedCode: "D1" });
  });

  it("los errores de la libreta, en la vista que los tiene", () => {
    const a = armadaAt(ida, 1);
    // Una lectura de 5 m ya no es error (Fase 42): avisa en el popup.
    const tall = writeArmada(ida, 1, { ...a, back: { ...a.back, reading: 5 } });
    expect(armadaProblem(tall, 1, "open")).toBeNull();
    const noDist = writeArmada(ida, 1, { ...a, fore: { ...a.fore, distanceM: null } });
    expect(armadaProblem(noDist, 1, "open")).toBe(
      "Vista adelante: Falta la distancia de la V−: sin ella el recorrido no acumula.",
    );
    expect(armadaProblem(ida, 1, "open")).toBeNull();
  });

  it("una armada que no quedó en la libreta es un error, no un silencio", () => {
    expect(armadaProblem(ida, 99, "open")).toBe("La armada no quedó en la libreta: revisa sus puntos.");
  });
});

describe("readingWarnings", () => {
  it("avisa por vista de las lecturas fuera de 0 a 4 m, sin bloquear", () => {
    expect(
      readingWarnings([
        ["Vista atrás", "1.218"],
        ["B10", "4,120"],
        ["Vista adelante", ""],
      ]),
    ).toEqual(["B10: La lectura de 4.120 m está fuera de 0.000 a 4.000 m: compruebe que sea correcta."]);
  });
});
