// Cómo se muestra un ángulo de la poligonal (Fase 35): en DMS o en grados
// decimales, según el selector de la barra de pasos. Sin «use client»: lo usan
// la pestaña Datos, la de Ajuste y el informe.

import {
  decimalToDms,
  dmsFieldValue,
  formatDecimalDegrees,
  type DmsFields,
} from "@/lib/calculations/angles";
import { readNumberText } from "@/lib/utils/parse";
import type { AngleInputFormat } from "@/types/polygonal";
import type { Dms3 } from "./polygonal-save";

const pad = (n: number) => String(n).padStart(2, "0");

/** Segundos a la décima, sin el «.0» de un valor entero: «07», «05.3». */
function secondsText(sec: number): string {
  const whole = Number.isInteger(sec);
  const text = whole ? String(sec) : sec.toFixed(1);
  return whole ? pad(sec) : text.padStart(4, "0");
}

/** Un ángulo en DMS («211°15′07″») o en grados decimales («211.251944°»). */
export function formatAngle(decimal: number | null | undefined, format: AngleInputFormat): string {
  if (decimal == null || !Number.isFinite(decimal)) return "—";
  if (format === "decimal") return `${formatDecimalDegrees(decimal)}°`;
  const { deg, min, sec } = decimalToDms(decimal);
  return `${deg}°${pad(min)}′${secondsText(sec)}″`;
}

/** Segundos de arco con signo: «+12.0″», «−1.71″». Un cero no lleva signo. */
export function formatSeconds(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return `${(0).toFixed(decimals)}″`;
  const text = Math.abs(rounded).toFixed(decimals);
  return `${rounded > 0 ? "+" : "−"}${text}″`;
}

/**
 * La lectura de unos campos DMS, o `null` si no hay grados o algo no es
 * número. Minutos y segundos en blanco valen 0. El rango lo juzga
 * `readingDmsError`, que da el motivo.
 */
export function dmsFromFields(fields: DmsFields): Dms3 | null {
  const deg = readNumberText(fields.deg);
  if (deg.kind !== "number") return null;
  const min = dmsFieldValue(fields.min);
  const sec = dmsFieldValue(fields.sec);
  if (min === null || sec === null) return null;
  return { deg: deg.value, min, sec };
}

/** Los campos de una lectura guardada, para editarla. */
export function fieldsOf(dms: Dms3): DmsFields {
  return { deg: String(dms.deg), min: String(dms.min), sec: String(dms.sec) };
}
