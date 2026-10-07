// La lectura del popup de la visita (Fase 37, decisión 4). Sin «use client»:
// lo usan el popup y las pruebas. La fecha frente a las de las demás visitas
// la comprueba el servidor (`validateVisitCapture`).

import { isCalendarDate } from "@/lib/validators/settlement";

export interface VisitForm {
  date: string;
  operator: string;
  notes: string;
  brand: string;
  model: string;
  serial: string;
}

export interface VisitData {
  date: string;
  operator: string | null;
  notes: string | null;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
}

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

export function readVisitForm(form: VisitForm): { visit: VisitData } | { error: string } {
  if (!isCalendarDate(form.date)) return { error: "La visita necesita una fecha válida." };
  return {
    visit: {
      date: form.date,
      operator: blank(form.operator),
      notes: blank(form.notes),
      equipmentBrand: blank(form.brand),
      equipmentModel: blank(form.model),
      equipmentSerial: blank(form.serial),
    },
  };
}

/** Qué libreta trae la visita nueva, dicho en el popup (decisión 4). */
export function templateNote({
  previousNumber,
  armadas,
  startCode,
  points,
  firstBenchmark,
}: {
  previousNumber: number | null;
  armadas: number;
  startCode: string | null;
  points: number;
  firstBenchmark: string | null;
}): string {
  if (previousNumber != null && armadas > 0) {
    const desde = startCode ? ` desde ${startCode}` : "";
    return (
      `La libreta llega armada como la visita ${previousNumber}: ${armadas} ${armadas === 1 ? "armada" : "armadas"}${desde}, ` +
      `con sus ${points} ${points === 1 ? "punto" : "puntos"}. En campo solo se teclean las lecturas.`
    );
  }
  if (!firstBenchmark) {
    return "El lugar no tiene BM: agrégalos en la pestaña BMs, porque las visitas se arman desde ellos.";
  }
  return `Primera visita: la libreta llega con una armada desde ${firstBenchmark} y los ${points} puntos vigentes.`;
}
