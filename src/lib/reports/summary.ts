// Filas del resumen consolidado de precisiones (Fase 22: salió de la página de
// impresión para compartirse con el informe de cada proceso). Función pura.

import { formatEquipmentLine, formatPrecision } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import { CANDIDATE_KIND_LABELS } from "@/types/report";
import { fixed } from "./values";
import type { ReportSection } from "./sections";

export interface PrecisionSummaryRow {
  key: string;
  nombre: string;
  tipo: string;
  precision: string;
  equipo: string;
  cumple: boolean | null;
}

export function precisionSummaryRows(sections: ReportSection[]): PrecisionSummaryRow[] {
  return sections.map((s) => {
    let precision = "—";
    let equipo = "—";
    let cumple: boolean | null = null;

    if (s.kind === "polygonal") {
      // El orden alcanzado, detectado como en el paso de Ajuste (Fase 35).
      const { result, input } = s.data.plot;
      const verifiable = input.type !== "open_uncontrolled" && result.relativePrecision != null;
      const order = s.data.order;
      precision = verifiable
        ? `${formatPrecision(result.relativePrecision)} · ${order ? PRECISION_ORDER_LABELS[order] : "ningún orden"}`
        : "Sin verificación";
      cumple = verifiable ? order !== null : null;
      equipo = formatEquipmentLine(
        s.data.process.equipment_brand,
        s.data.process.equipment_model,
        s.data.process.equipment_serial,
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
      }
    }

    return {
      key: `${s.entry.type}:${s.entry.id}`,
      nombre: s.entry.name,
      tipo: CANDIDATE_KIND_LABELS[s.entry.type],
      precision,
      equipo,
      cumple,
    };
  });
}
