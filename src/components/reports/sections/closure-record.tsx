import type { ReactNode } from "react";
import { closureOf, type ReportSection } from "@/lib/reports/sections";
import { formatDate } from "@/lib/utils/format";

interface ClosureRecordProps {
  sections: ReportSection[];
  /** Nombre de cada responsable, por id de usuario (`responsibleNames`). */
  names: Map<string, string>;
  /** Texto al pie del informe. */
  footer: ReactNode;
}

/**
 * Registro de cierre: quién cerró cada proceso y cuándo (§ 4.7). La poligonal
 * no se cierra (Fase 35) y no tiene fila; sin nada que se cierre, queda el pie.
 */
export function ClosureRecord({ sections, names, footer }: ClosureRecordProps) {
  const closable = sections.filter((s) => s.kind !== "polygonal");
  if (closable.length === 0) return <p className="report-footer">{footer}</p>;
  return (
    <section className="report-section">
      <h2>Registro de cierre</h2>
      <table className="report-table">
        <thead>
          <tr>
            <th>Proceso</th>
            <th>Cerrado</th>
            <th>Responsable</th>
          </tr>
        </thead>
        <tbody>
          {closable.map((s) => {
            const { closedAt, closedBy } = closureOf(s);
            return (
              <tr key={`${s.entry.type}:${s.entry.id}`}>
                <td>{s.entry.name}</td>
                <td>{closedAt ? formatDate(closedAt) : "—"}</td>
                <td>{(closedBy ? names.get(closedBy) : undefined) ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="report-footer">{footer}</p>
    </section>
  );
}
