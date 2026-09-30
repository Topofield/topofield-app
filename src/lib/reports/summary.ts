// Filas del resumen consolidado de precisiones (Fase 22: salió de la página de
// impresión para compartirse con el informe de cada proceso). Función pura.

import { levelMeetsOrder, totalStationMeetsOrder } from "@/lib/calculations/tolerances";
import { formatEquipmentLine, formatPrecision } from "@/lib/utils/format";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import { CANDIDATE_KIND_LABELS } from "@/types/report";
import { fixed, n } from "./values";
import type { ReportSection } from "./sections";

export interface PrecisionSummaryRow {
  key: string;
  nombre: string;
  tipo: string;
  precision: string;
  equipo: string;
  cumple: boolean | null;
  /** «Sí» con un equipo declarado que no alcanza el orden: lleva nota al pie. */
  marcar: boolean;
}

export function precisionSummaryRows(sections: ReportSection[]): PrecisionSummaryRow[] {
  return sections.map((s) => {
    let precision = "—";
    let equipo = "—";
    let cumple: boolean | null = null;
    // ¿El equipo declarado da para el orden declarado? No entra en
    // `meets_tolerance` —capacidad del instrumento y conformidad de las
    // medidas son cantidades distintas, y el aviso de equipo es informativo,
    // no bloqueante—, pero un «Sí» junto a una columna de equipo que no lo
    // alcanza, sin nada que los relacione, se lee como una conformidad que el
    // instrumento no respalda. Marca y nota al pie, no cambio de resultado.
    let equipoAlcanza = true;

    if (s.kind === "polygonal") {
      precision = formatPrecision(s.data.process.relative_precision);
      cumple = s.data.process.meets_tolerance;
      equipo = formatEquipmentLine(
        s.data.process.equipment_brand,
        s.data.process.equipment_model,
        s.data.process.equipment_serial,
      );
      equipoAlcanza = totalStationMeetsOrder(
        s.data.process.precision_order,
        n(s.data.process.angular_precision_seconds) ?? Number.NaN,
      );
    } else if (s.kind === "leveling") {
      const p = s.data.process;
      // En una abierta con vuelta el veredicto es la discrepancia (Fase 23).
      precision =
        p.type === "open" && p.has_return_run
          ? `Δ ${fixed(p.discrepancy_mm, 1)} mm (tol. ${fixed(p.discrepancy_tolerance_mm, 1)})`
          : `${fixed(p.closure_error_mm, 1)} mm (tol. ${fixed(p.tolerance_mm, 1)})`;
      cumple = s.data.process.meets_tolerance;
      equipo = formatEquipmentLine(
        s.data.process.equipment_brand,
        s.data.process.equipment_model,
        s.data.process.equipment_serial,
      );
      equipoAlcanza = levelMeetsOrder(
        s.data.process.precision_order,
        n(s.data.process.km_precision_mm) ?? Number.NaN,
      );
    } else if (s.kind === "site") {
      const last = s.data.history.visits[s.data.history.visits.length - 1];
      precision = last ? `Peor alerta: ${ALERT_LEVEL_LABELS[last.worstAlert]}` : "Sin visitas";
      const lastVisit = s.data.visits[s.data.visits.length - 1];
      if (lastVisit) {
        equipo = formatEquipmentLine(
          lastVisit.equipment_brand,
          lastVisit.equipment_model,
          lastVisit.equipment_serial,
        );
        equipoAlcanza = levelMeetsOrder(
          lastVisit.precision_order,
          n(lastVisit.km_precision_mm) ?? Number.NaN,
        );
      }
    }

    return {
      key: `${s.entry.type}:${s.entry.id}`,
      nombre: s.entry.name,
      tipo: CANDIDATE_KIND_LABELS[s.entry.type],
      precision,
      equipo,
      cumple,
      // La marca solo tiene sentido sobre un «Sí»: si el cierre no cumple, no
      // hay conformidad que acotar.
      marcar: cumple === true && !equipoAlcanza,
    };
  });
}
