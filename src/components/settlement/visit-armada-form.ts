// El formulario del popup de la armada de una visita (Fase 37, decisiones 8 y
// 9): del texto tecleado a la armada, a medias. Cada lectura se guarda al
// escribirla, así que lo que falta por leer no es error: queda en null. Sin
// «use client»: lo usan el popup y las pruebas.
import { samePointCode } from "@/lib/calculations/leveling";
import { parseNumber, readNumberText } from "@/lib/utils/parse";
import type { BookRowPayload } from "@/types/settlement";
import { wiresOf, type VisualForm } from "@/components/leveling/armada-form";
import {
  appendVisitArmada,
  visitArmadaSpans,
  writeVisitArmada,
  type VisitArmada,
  type VisitVisual,
} from "./visit-armadas";

export interface VisitArmadaForm {
  from: "bm" | "pc";
  backCode: string;
  back: VisualForm;
  /** `added`: una fila de «+ Otro punto», con el código por teclear. */
  points: { pointCode: string; reading: string; added?: boolean }[];
  /** La casilla «Sin vista adelante». */
  noFore: boolean;
  foreCode: string;
  fore: VisualForm;
}

const text = (v: number | null) => (v == null ? "" : String(v));
const blankVisual: VisualForm = { reading: "", distance: "", upper: "", lower: "" };
const visualForm = (v: VisitVisual): VisualForm => ({
  reading: text(v.reading),
  distance: text(v.distanceM),
  upper: text(v.upperM),
  lower: text(v.lowerM),
});

/** El formulario de una armada guardada, o el de una nueva que sale de `fresh`. */
export function visitArmadaFormOf(
  a: VisitArmada | null,
  fresh: { from: "bm" | "pc"; backCode: string },
): VisitArmadaForm {
  if (!a) {
    return { ...fresh, back: blankVisual, points: [], noFore: false, foreCode: "", fore: blankVisual };
  }
  return {
    from: a.from,
    backCode: a.backCode,
    back: visualForm(a.back),
    points: a.points.map((p) => ({ pointCode: p.pointCode, reading: text(p.reading) })),
    noFore: a.fore == null,
    foreCode: a.fore?.pointCode ?? "",
    fore: a.fore ? visualForm(a.fore.visual) : blankVisual,
  };
}

type Read<T> = { value: T } | { error: string };

function readOptional(raw: string, what: string): Read<number | null> {
  if (readNumberText(raw).kind === "invalid") return { error: `${what} no es un número.` };
  return { value: parseNumber(raw) };
}

/** Una visual a medias: todo opcional, pero lo tecleado debe ser número. */
function readVisual(v: VisualForm, where: string): Read<VisitVisual> {
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

const typedIn = (v: VisualForm) => [v.reading, v.distance, v.upper, v.lower].some((x) => x.trim() !== "");

/**
 * Lee el formulario a medias. Una fila de punto vacía se salta; la V− sin
 * punto ni nada tecleado, o con «Sin vista adelante», no existe. La V− a un
 * BM del lugar es de tipo BM; a cualquier otro punto, punto de cambio.
 */
export function readVisitArmadaForm(
  form: VisitArmadaForm,
  benchmarks: readonly { code: string }[],
): { armada: VisitArmada } | { error: string } {
  const back = readVisual(form.back, "Vista atrás");
  if ("error" in back) return back;

  const points: VisitArmada["points"] = [];
  for (const [i, p] of form.points.entries()) {
    const code = p.pointCode.trim();
    if (code === "" && p.reading.trim() === "") continue;
    if (code === "") return { error: `Punto ${i + 1}: falta el código.` };
    const reading = readOptional(p.reading, `${code}: la lectura`);
    if ("error" in reading) return reading;
    points.push({ pointCode: code, reading: reading.value });
  }

  let fore: VisitArmada["fore"] = null;
  const foreCode = form.foreCode.trim();
  if (!form.noFore && (foreCode !== "" || typedIn(form.fore))) {
    if (foreCode === "") return { error: "Vista adelante: el punto necesita un código." };
    const visual = readVisual(form.fore, "Vista adelante");
    if ("error" in visual) return visual;
    const isBenchmark = benchmarks.some((b) => samePointCode(b.code, foreCode));
    fore = { pointCode: foreCode, pointType: isBenchmark ? "bm" : "pc", visual: visual.value };
  }

  return { armada: { from: form.from, backCode: form.backCode.trim(), back: back.value, points, fore } };
}

/** Escribe la armada `k` en la libreta: la reescribe si ya está, o la agrega tras la última. */
export function composeArmada(
  rows: readonly BookRowPayload[],
  k: number,
  armada: VisitArmada,
): { rows: BookRowPayload[] } | { error: string } {
  return k < visitArmadaSpans(rows).length ? writeVisitArmada(rows, k, armada) : appendVisitArmada(rows, armada);
}

/** «10 de 16»: los puntos con lectura de los que tienen código. */
export function readCount(points: readonly { pointCode: string; reading: string }[]): { read: number; total: number } {
  const named = points.filter((p) => p.pointCode.trim() !== "");
  return { read: named.filter((p) => p.reading.trim() !== "").length, total: named.length };
}
