import type { ReactNode } from "react";
import { closureOf, type ReportSection } from "@/lib/reports/sections";
import { formatDate } from "@/lib/utils/format";

interface ClosureRecordProps {
  sections: ReportSection[];
  /** Texto al pie del informe. */
  footer: ReactNode;
}

/** Registro de cierre: quién cerró cada proceso y cuándo (§ 4.7). */
export function ClosureRecord({ sections, footer }: ClosureRecordProps) {
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
          {sections.map((s) => {
            const { closedAt, closedBy } = closureOf(s);
            return (
              <tr key={`${s.entry.type}:${s.entry.id}`}>
                <td>{s.entry.name}</td>
                <td>{closedAt ? formatDate(closedAt) : "—"}</td>
                <td className="mono">{closedBy ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="report-footer">{footer}</p>
    </section>
  );
}
