// La lectura del popup del lugar (Fase 37, decisión 1). Sin «use client»: lo
// usan el popup y las pruebas. Las reglas de los umbrales son las de
// `createSiteAction`, que las vuelve a comprobar en el servidor.

import { thresholdsFor } from "@/lib/calculations/tolerances";
import { STRUCTURE_TYPE_LABELS, type StructureType } from "@/types/site";
import type { Thresholds } from "@/types/settlement";

export interface SiteForm {
  name: string;
  description: string;
  structureType: StructureType;
  thresholds: Thresholds;
}

export interface SiteData {
  name: string;
  description: string | null;
  structureType: StructureType;
  thresholds: Thresholds;
}

const NAMES: [keyof Thresholds, string][] = [
  ["velocityCaution", "precaución de velocidad"],
  ["velocityAlert", "alerta de velocidad"],
  ["velocityAlarm", "alarma de velocidad"],
  ["accumulatedCaution", "precaución de acumulado"],
  ["accumulatedAlert", "alerta de acumulado"],
  ["accumulatedAlarm", "alarma de acumulado"],
];

export function readSiteForm(form: SiteForm): { site: SiteData } | { error: string } {
  const name = form.name.trim();
  if (name === "") return { error: "El lugar necesita un nombre." };
  const t = form.thresholds;
  for (const [key, label] of NAMES) {
    if (!Number.isFinite(t[key]) || t[key] <= 0) {
      return { error: `El umbral de ${label} debe ser un número positivo.` };
    }
  }
  if (!(t.velocityCaution < t.velocityAlert && t.velocityAlert < t.velocityAlarm)) {
    return { error: "Los umbrales de velocidad deben ser crecientes: precaución < alerta < alarma." };
  }
  if (!(t.accumulatedCaution < t.accumulatedAlert && t.accumulatedAlert < t.accumulatedAlarm)) {
    return { error: "Los umbrales de asentamiento acumulado deben ser crecientes: precaución < alerta < alarma." };
  }
  const description = form.description.trim();
  return {
    site: {
      name,
      description: description === "" ? null : description,
      structureType: form.structureType,
      thresholds: t,
    },
  };
}

/** El resumen de los umbrales plegados; dice el tipo si son los suyos. */
export function thresholdsSummary(t: Thresholds, structureType: StructureType): string {
  const preset = thresholdsFor(structureType);
  const same = (Object.keys(preset) as (keyof Thresholds)[]).every((k) => preset[k] === t[k]);
  const text =
    `${t.accumulatedCaution} · ${t.accumulatedAlert} · ${t.accumulatedAlarm} mm y ` +
    `${t.velocityCaution} · ${t.velocityAlert} · ${t.velocityAlarm} mm/mes`;
  return same ? `${text}, de ${STRUCTURE_TYPE_LABELS[structureType].toLowerCase()}` : text;
}
