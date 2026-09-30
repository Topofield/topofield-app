import type { PrecisionSummaryRow } from "@/lib/reports/summary";

/** Resumen consolidado de precisiones, con su nota si algún equipo no alcanza. */
export function PrecisionSummary({
  rows,
  title = "Resumen consolidado de precisiones",
}: {
  rows: PrecisionSummaryRow[];
  title?: string;
}) {
  const hayEquipoInsuficiente = rows.some((f) => f.marcar);
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
                {f.marcar && <sup> (*)</sup>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hayEquipoInsuficiente && (
        <p className="report-footnote">
          (*) El cierre cumple la tolerancia de su orden, pero la precisión del equipo declarado
          no alcanza el coeficiente K de ese orden.
        </p>
      )}
    </section>
  );
}
