import type { PrecisionSummaryRow } from "@/lib/reports/summary";

/** Resumen consolidado de precisiones. */
export function PrecisionSummary({
  rows,
  title = "Resumen consolidado de precisiones",
}: {
  rows: PrecisionSummaryRow[];
  title?: string;
}) {
  return (
    <section className="report-section report-break">
      <h2>{title}</h2>
      <table className="report-table">
        <thead>
          <tr>
            <th>Proceso</th>
            <th>Tipo</th>
            <th>Precisión / cierre</th>
            <th>Equipo</th>
            <th>¿Cumple?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.key}>
              <td>{f.nombre}</td>
              <td>{f.tipo}</td>
              <td>{f.precision}</td>
              <td>{f.equipo}</td>
              <td>
                {f.cumple === null ? "—" : f.cumple ? "Sí" : "No"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
