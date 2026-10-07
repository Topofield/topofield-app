// El formulario del popup de armada (Fase 36, captura A): del texto tecleado a
// la armada, los hilos opcionales con la comprobación del medio, la casilla de
// fin según el tipo y los errores de la libreta en la vista que los tiene. Sin
// «use client»: lo usan el popup y las pruebas.
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { distanceFromWires, samePointCode } from "@/lib/calculations/leveling";
import { MIDDLE_WIRE_TOLERANCE_M } from "@/lib/calculations/tolerances";
import { parseNumber, readNumberText } from "@/lib/utils/parse";
import { validateRunCapture, type ReadingCaptureIssues } from "@/lib/validators/leveling";
import type { LevelingType, RunType } from "@/types/leveling";
import { armadaSpans, type Armada, type Visual } from "./armadas";
import type { LevelingDraft } from "./leveling-save";

export interface VisualForm {
  reading: string;
  distance: string;
  upper: string;
  lower: string;
}

export interface ArmadaForm {
  back: VisualForm;
  forePoint: string;
  fore: VisualForm;
  intermediates: { pointCode: string; reading: string }[];
  /** La casilla de fin: «Llega al BM», «Llega a …» o «Fin de la ida». */
  ends: boolean;
}

const text = (v: number | null) => (v == null ? "" : String(v));
const visualForm = (v: Visual | null): VisualForm => ({
  reading: text(v?.reading ?? null),
  distance: text(v?.distanceM ?? null),
  upper: text(v?.upperM ?? null),
  lower: text(v?.lowerM ?? null),
});

/** El formulario de una armada guardada, o vacío para una nueva. */
export function armadaFormOf(a: Armada | null, ends: boolean): ArmadaForm {
  return {
    back: visualForm(a?.back ?? null),
    forePoint: a?.forePoint ?? "",
    fore: visualForm(a && a.forePoint !== "" ? a.fore : null),
    intermediates: (a?.intermediates ?? []).map((m) => ({ pointCode: m.pointCode, reading: text(m.reading) })),
    ends,
  };
}

export interface WireCheck {
  /** (superior − inferior) × 100. */
  distanceM: number;
  /** El hilo medio frente al promedio de los otros dos; `null` sin lectura. */
  middle: { expected: number; deltaMm: number; ok: boolean } | null;
}

/** Con los dos hilos, la distancia que dan y la comprobación del medio; si no, `null`. */
export function wiresOf(v: VisualForm): WireCheck | null {
  const upper = parseNumber(v.upper);
  const lower = parseNumber(v.lower);
  const raw = distanceFromWires(upper, lower);
  if (raw == null) return null;
  // Al milímetro, como el acumulado: (3.416 − 3.135) × 100 da 28.100000000000023.
  const distanceM = Math.round(raw * 1000) / 1000;
  const reading = parseNumber(v.reading);
  const expected = (upper! + lower!) / 2;
  const deltaMm = reading == null ? null : Math.abs(reading - expected) * 1000;
  return {
    distanceM,
    middle: deltaMm == null ? null : { expected, deltaMm, ok: deltaMm <= MIDDLE_WIRE_TOLERANCE_M * 1000 + 1e-9 },
  };
}

export interface ArmadaEnd {
  label: string;
  detail: string;
  /** El punto que fija la casilla; `null` si se teclea (el fin de la ida de una abierta). */
  fixedCode: string | null;
}

/** La casilla de fin según el tipo y el recorrido. */
export function armadaEnd(draft: LevelingDraft, run: RunType): ArmadaEnd {
  const { startCode, endCode } = draft.bm;
  if (run === "return") {
    return { label: `Llega a ${startCode}`, detail: "la vuelta termina en el BM de partida.", fixedCode: startCode };
  }
  if (draft.details.type === "closed") {
    return { label: "Llega al BM", detail: `este punto es ${startCode} y cierra el circuito.`, fixedCode: startCode };
  }
  if (draft.details.type === "link") {
    const code = endCode ?? "";
    return { label: `Llega a ${code}`, detail: "el BM de llegada, de cota conocida.", fixedCode: code };
  }
  return {
    label: "Fin de la ida",
    detail: draft.details.hasReturnRun
      ? "este punto es el final de la ida y desde aquí empieza la vuelta."
      : "este es el último punto de la nivelación.",
    fixedCode: null,
  };
}

type Read<T> = { value: T } | { error: string };

function readOptional(raw: string, what: string): Read<number | null> {
  const t = readNumberText(raw);
  if (t.kind === "invalid") return { error: `${what} no es un número.` };
  return { value: parseNumber(raw) };
}

function readVisual(v: VisualForm, where: string): Read<Visual> {
  if (v.reading.trim() === "") return { error: `${where}: la lectura es obligatoria.` };
  const reading = readOptional(v.reading, `${where}: la lectura`);
  if ("error" in reading) return reading;
  const upper = readOptional(v.upper, `${where}: el hilo superior`);
  if ("error" in upper) return upper;
  const lower = readOptional(v.lower, `${where}: el hilo inferior`);
  if ("error" in lower) return lower;
  const wires = wiresOf(v);
  const typed = readOptional(v.distance, `${where}: la distancia`);
  if (wires == null && "error" in typed) return typed;
  const distanceM = wires?.distanceM ?? ("value" in typed ? typed.value : null);
  return { value: { reading: reading.value, distanceM, upperM: upper.value, lowerM: lower.value } };
}

/** Lee el formulario; un error en texto o la armada lista para escribir. */
export function readArmadaForm(form: ArmadaForm, end: ArmadaEnd): { armada: Armada } | { error: string } {
  const back = readVisual(form.back, "Vista atrás");
  if ("error" in back) return back;
  const forePoint = form.ends && end.fixedCode != null ? end.fixedCode : form.forePoint.trim();
  if (forePoint === "") return { error: "Vista adelante: el punto necesita un código." };
  if (!form.ends && end.fixedCode != null && samePointCode(forePoint, end.fixedCode)) {
    return { error: `Para llegar a ${end.fixedCode}, marca la casilla «${end.label}».` };
  }
  const fore = readVisual(form.fore, "Vista adelante");
  if ("error" in fore) return fore;
  const intermediates: Armada["intermediates"] = [];
  for (const [i, m] of form.intermediates.entries()) {
    if (m.pointCode.trim() === "" && m.reading.trim() === "") continue;
    const reading = readOptional(m.reading, `Vista intermedia ${i + 1}: la lectura`);
    if ("error" in reading) return reading;
    if (m.pointCode.trim() === "" || reading.value == null) {
      return { error: `Vista intermedia ${i + 1}: el punto y la lectura son obligatorios.` };
    }
    intermediates.push({ pointCode: m.pointCode.trim(), reading: reading.value });
  }
  return {
    armada: { back: back.value, forePoint, foreType: form.ends ? "bm" : "pc", fore: fore.value, intermediates },
  };
}

type IssueField = keyof ReadingCaptureIssues["errors"];

function firstError(issues: ReadingCaptureIssues | undefined, fields: IssueField[]): string | null {
  for (const f of fields) {
    const e = issues?.errors[f];
    if (e) return e;
  }
  return null;
}

/**
 * El primer error de captura de la armada `k` ya escrita en las filas, en la
 * vista que lo tiene. La libreta puede ir a medias (`allowUnfinished`).
 */
export function armadaProblem(rows: readonly ReadingDraft[], k: number, type: LevelingType): string | null {
  const span = armadaSpans(rows)[k];
  if (!span) return "La armada no quedó en la libreta: revisa sus puntos.";
  const issues = validateRunCapture(
    rows.map((d) => ({ ...d, distanceAccumulatedKm: null })),
    type,
    { allowUnfinished: true },
  );
  const back = firstError(issues[span.opener], ["backsight", "backWires", "backDistanceM"]);
  if (back) return `Vista atrás: ${back}`;
  for (const [n, i] of span.intermediates.entries()) {
    const mid = firstError(issues[i], ["pointCode", "foresight"]);
    if (mid) return `Vista intermedia ${n + 1}: ${mid}`;
  }
  if (span.closer == null) return null;
  const fore = firstError(issues[span.closer], ["pointCode", "foresight", "foreWires", "foreDistanceM", "pointType"]);
  return fore ? `Vista adelante: ${fore}` : null;
}
