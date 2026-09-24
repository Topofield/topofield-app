import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
  getReferencePoints,
  getReport,
  getSettlementReadingsBySite,
  getSite,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { computeHistory, pointInputOf } from "@/lib/calculations/settlement";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { PolygonalPlot } from "@/components/polygonal/polygonal-plot";
import { polygonalInputOf } from "@/components/polygonal/polygonal-draft";
import {
  levelMeetsOrder,
  thresholdsOf,
  totalStationMeetsOrder,
} from "@/lib/calculations/tolerances";
import {
  formatAngularPrecision,
  formatDate,
  formatDateOnly,
  formatDistancePrecision,
  formatEquipmentLine,
  formatKmPrecision,
  formatPrecision,
} from "@/lib/utils/format";
import { LEVEL_TYPE_LABELS, PRECISION_ORDER_LABELS } from "@/types/project";
import {
  CORRECTION_METHOD_LABELS,
  POLYGONAL_TYPE_LABELS,
  type PolygonalInput,
  type PolygonalResult,
} from "@/types/polygonal";
import {
  LEVELING_TYPE_LABELS,
  POINT_TYPE_LABELS,
  RUN_TYPE_LABELS,
  type LevelingType,
  type PointType,
  type RunType,
} from "@/types/leveling";
import { ALERT_LEVEL_LABELS, type PointInput, type VisitInput } from "@/types/settlement";
import { STRUCTURE_TYPE_LABELS, type StructureType } from "@/types/site";
import { CANDIDATE_KIND_LABELS, type IncludedProcess } from "@/types/report";
import { PrintButton } from "@/components/reports/print-button";
import { SettlementPlot } from "@/components/reports/settlement-plot";

interface PrintPageProps {
  params: Promise<{ id: string; reportId: string }>;
}

function n(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

function fixed(
  value: number | string | null | undefined,
  decimals: number,
): string {
  const v = n(value);
  return v === null ? "—" : v.toFixed(decimals);
}

function dms(
  deg: number | null,
  min: number | null,
  sec: number | null,
): string {
  if (deg === null || min === null || sec === null) return "—";
  return `${deg}° ${min}' ${sec}"`;
}

/** Una sección del informe, ya resuelta a datos. */
type Section =
  | { kind: "polygonal"; entry: IncludedProcess; data: PolygonalSection }
  | { kind: "leveling"; entry: IncludedProcess; data: LevelingSection }
  | { kind: "site"; entry: IncludedProcess; data: SiteSection }
  | { kind: "missing"; entry: IncludedProcess; data: null };

interface PolygonalSection {
  process: Awaited<ReturnType<typeof getPolygonalProcess>>;
  stations: Awaited<ReturnType<typeof getPolygonalStations>>;
  /**
   * Lo que consume el dibujo (Fase 13). La entrada sale de `polygonalInputOf`,
   * el mismo camino que usa el editor, así que el dibujo del informe es por
   * construcción el del editor.
   */
  plot: {
    input: PolygonalInput;
    result: PolygonalResult;
    reference: { code: string; north: number; east: number } | null;
  };
}
interface LevelingSection {
  process: Awaited<ReturnType<typeof getLevelingProcess>>;
  readings: Awaited<ReturnType<typeof getLevelingReadings>>;
}
interface SiteSection {
  site: NonNullable<Awaited<ReturnType<typeof getSite>>>;
  points: Awaited<ReturnType<typeof getSitePoints>>;
  /** Los mismos puntos en la forma que consume la gráfica. */
  pointInputs: PointInput[];
  visits: Awaited<ReturnType<typeof getVisits>>;
  history: ReturnType<typeof computeHistory>;
}

/**
 * Ruta imprimible del informe (§ 4.7).
 *
 * El PDF se produce con «Imprimir → Guardar como PDF» del navegador sobre esta
 * página: no hay motor de PDF en el servidor. Por eso la maquetación vive en
 * `@media print` y la página se sirve sin la navegación de la aplicación.
 *
 * El contenido se **reconstruye** en cada visita a partir de los procesos que
 * el informe referencia. Es seguro porque solo puede incluir procesos
 * cerrados, que son inmutables por trigger de base: reabrir el informe dentro
 * de un año da exactamente lo mismo.
 */
export default async function ReportPrintPage({ params }: PrintPageProps) {
  const { id, reportId } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) notFound();

  const report = await getReport(supabase, reportId);
  if (!report || report.project_id !== project.id) notFound();

  const entries = [...report.included_processes].sort(
    (a, b) => a.order - b.order,
  );

  // Catálogo de amarres, una sola vez por informe y solo si hay poligonales:
  // el dibujo de cada una lo necesita para su punto de amarre.
  const referencePoints = entries.some((e) => e.type === "polygonal")
    ? await getReferencePoints(supabase, project.id)
    : [];

  const sections: Section[] = await Promise.all(
    entries.map(async (entry): Promise<Section> => {
      if (entry.type === "polygonal") {
        const process = await getPolygonalProcess(supabase, entry.id);
        if (!process || process.project_id !== project.id) {
          return { kind: "missing", entry, data: null };
        }
        const stations = await getPolygonalStations(supabase, process.id);
        const input = polygonalInputOf(process, stations);
        const amarre = referencePoints.find(
          (p) => p.id === process.reference_point_id,
        );
        const reference =
          amarre && amarre.north !== null && amarre.east !== null
            ? { code: amarre.code, north: Number(amarre.north), east: Number(amarre.east) }
            : null;
        return {
          kind: "polygonal",
          entry,
          data: {
            process,
            stations,
            plot: { input, result: computePolygonal(input), reference },
          },
        };
      }
      if (entry.type === "leveling") {
        const process = await getLevelingProcess(supabase, entry.id);
        if (!process || process.project_id !== project.id) {
          return { kind: "missing", entry, data: null };
        }
        const readings = await getLevelingReadings(supabase, process.id);
        return { kind: "leveling", entry, data: { process, readings } };
      }
      const site = await getSite(supabase, entry.id);
      if (!site || site.project_id !== project.id) {
        return { kind: "missing", entry, data: null };
      }
      const [points, visits, readingsBySite] = await Promise.all([
        getSitePoints(supabase, site.id),
        getVisits(supabase, site.id),
        getSettlementReadingsBySite(supabase, site.id),
      ]);
      const pointInputs: PointInput[] = points.map(pointInputOf);
      const visitInputs: VisitInput[] = visits.map((v) => ({
        id: v.id,
        visitNumber: v.visit_number,
        date: v.date,
        readings: (readingsBySite[v.id] ?? []).map((r) => ({
          pointId: r.point_id,
          elevation: Number(r.elevation),
        })),
      }));
      const history = computeHistory(
        pointInputs,
        visitInputs,
        thresholdsOf(site),
      );
      return {
        kind: "site",
        entry,
        data: { site, points, pointInputs, visits, history },
      };
    }),
  );

  // ---- Resumen consolidado de precisiones -----------------------------------
  // Se calcula aquí y no dentro del JSX porque la nota al pie depende de si
  // alguna fila quedó marcada, y eso hay que saberlo antes de pintar la tabla.
  const filasResumen = sections.map((s) => {
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

    if (s.kind === "polygonal" && s.data.process) {
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
    } else if (s.kind === "leveling" && s.data.process) {
      precision = `${fixed(s.data.process.closure_error_mm, 1)} mm (tol. ${fixed(s.data.process.tolerance_mm, 1)})`;
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
      precision = last
        ? `Peor alerta: ${ALERT_LEVEL_LABELS[last.worstAlert]}`
        : "Sin visitas";
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
  const hayEquipoInsuficiente = filasResumen.some((f) => f.marcar);

  return (
    <div className="report">
      <PrintButton />

      {/* ---------- Portada ---------- */}
      <section className="report-cover">
        <p className="report-kicker">TopoField — Informe técnico</p>
        <h1 className="report-title">{report.title}</h1>
        <dl className="report-cover-grid">
          <dt>Proyecto</dt>
          <dd>{project.name}</dd>
          {project.client && (
            <>
              <dt>Cliente</dt>
              <dd>{project.client}</dd>
            </>
          )}
          {project.location && (
            <>
              <dt>Ubicación</dt>
              <dd>{project.location}</dd>
            </>
          )}
          {project.datum && (
            <>
              <dt>Datum / proyección</dt>
              <dd>
                {project.datum}
                {project.projection ? ` · ${project.projection}` : ""}
              </dd>
            </>
          )}
          <dt>Fecha de emisión</dt>
          <dd>
            {report.generated_at ? formatDate(report.generated_at) : "—"}
          </dd>
        </dl>
      </section>

      {/* ---------- Índice ---------- */}
      <section className="report-section">
        <h2>Índice de procesos incluidos</h2>
        <ol className="report-index">
          {sections.map((s, i) => (
            <li key={`${s.entry.type}:${s.entry.id}`}>
              <span className="report-index-kind">
                {CANDIDATE_KIND_LABELS[s.entry.type]}
              </span>
              <span>{s.entry.name}</span>
              <span className="report-index-num">{i + 1}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Una sección por proceso ---------- */}
      {sections.map((section, i) => (
        <section
          key={`${section.entry.type}:${section.entry.id}`}
          className="report-section report-break"
        >
          <h2>
            {i + 1}. {section.entry.name}
            <span className="report-kind-tag">
              {CANDIDATE_KIND_LABELS[section.entry.type]}
            </span>
          </h2>

          {section.kind === "missing" && (
            <p className="report-missing">
              Este proceso ya no está disponible. Se emitió con el nombre «
              {section.entry.name}».
            </p>
          )}

          {section.kind === "polygonal" && section.data.process && (
            <>
              <dl className="report-pairs">
                <dt>Tipo</dt>
                <dd>{POLYGONAL_TYPE_LABELS[section.data.process.type]}</dd>
                <dt>Método de corrección</dt>
                <dd>
                  {section.data.process.correction_method
                    ? CORRECTION_METHOD_LABELS[
                        section.data.process.correction_method
                      ]
                    : "—"}
                </dd>
                <dt>Error angular</dt>
                <dd>{fixed(section.data.process.angular_error_seconds, 1)}&Prime;</dd>
                <dt>Error lineal</dt>
                <dd>{fixed(section.data.process.linear_error, 3)} m</dd>
                <dt>Perímetro</dt>
                <dd>{fixed(section.data.process.perimeter, 3)} m</dd>
                <dt>Precisión relativa</dt>
                <dd>{formatPrecision(section.data.process.relative_precision)}</dd>
                <dt>Orden de precisión</dt>
                <dd>
                  {PRECISION_ORDER_LABELS[section.data.process.precision_order]}
                </dd>
                <dt>Equipo</dt>
                <dd>
                  {formatEquipmentLine(
                    section.data.process.equipment_brand,
                    section.data.process.equipment_model,
                    section.data.process.equipment_serial,
                  )}
                </dd>
                <dt>Precisión angular</dt>
                <dd>
                  {formatAngularPrecision(
                    section.data.process.angular_precision_seconds,
                  )}
                </dd>
                <dt>Precisión de distancia</dt>
                <dd>
                  {formatDistancePrecision(
                    section.data.process.distance_precision_mm,
                    section.data.process.distance_precision_ppm,
                  )}
                </dd>
              </dl>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Punto</th>
                    <th>Ángulo corregido</th>
                    <th>Azimut</th>
                    <th>Norte (m)</th>
                    <th>Este (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {section.data.stations.map((st) => (
                    <tr key={st.id}>
                      <td>{st.point_code}</td>
                      <td>
                        {dms(
                          st.corrected_angle_deg,
                          st.corrected_angle_min,
                          st.corrected_angle_sec,
                        )}
                      </td>
                      <td>
                        {dms(st.azimuth_deg, st.azimuth_min, st.azimuth_sec)}
                      </td>
                      <td className="num">{fixed(st.north, 3)}</td>
                      <td className="num">{fixed(st.east, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="report-plot">
                <PolygonalPlot
                  input={section.data.plot.input}
                  result={section.data.plot.result}
                  reference={section.data.plot.reference}
                />
              </div>
            </>
          )}

          {section.kind === "leveling" && section.data.process && (
            <>
              <dl className="report-pairs">
                <dt>Tipo</dt>
                <dd>
                  {LEVELING_TYPE_LABELS[
                    section.data.process.type as LevelingType
                  ] ?? section.data.process.type}
                </dd>
                <dt>Error de cierre</dt>
                <dd>{fixed(section.data.process.closure_error_mm, 1)} mm</dd>
                <dt>Tolerancia</dt>
                <dd>{fixed(section.data.process.tolerance_mm, 1)} mm</dd>
                <dt>Distancia total</dt>
                <dd>{fixed(section.data.process.total_distance_km, 3)} km</dd>
                <dt>Orden de precisión</dt>
                <dd>
                  {PRECISION_ORDER_LABELS[section.data.process.precision_order]}
                </dd>
                <dt>Equipo</dt>
                <dd>
                  {formatEquipmentLine(
                    section.data.process.equipment_brand,
                    section.data.process.equipment_model,
                    section.data.process.equipment_serial,
                  )}
                </dd>
                <dt>Tipo de nivel</dt>
                <dd>
                  {section.data.process.level_type
                    ? LEVEL_TYPE_LABELS[section.data.process.level_type]
                    : "—"}
                </dd>
                <dt>Desviación típica</dt>
                <dd>{formatKmPrecision(section.data.process.km_precision_mm)}</dd>
              </dl>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Recorrido</th>
                    <th>Punto</th>
                    <th>Tipo</th>
                    <th>Cota corregida (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {section.data.readings.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {RUN_TYPE_LABELS[r.run_type as RunType] ?? r.run_type}
                      </td>
                      <td>{r.point_code}</td>
                      <td>
                        {POINT_TYPE_LABELS[r.point_type as PointType] ??
                          r.point_type}
                      </td>
                      <td className="num">{fixed(r.elevation_corrected, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {section.kind === "site" && (
            <>
              <dl className="report-pairs">
                <dt>Tipo de estructura</dt>
                <dd>
                  {STRUCTURE_TYPE_LABELS[
                    section.data.site.structure_type as StructureType
                  ] ?? section.data.site.structure_type}
                </dd>
                <dt>Puntos de control</dt>
                <dd>
                  {(() => {
                    // Fase 11: un punto de baja sigue contando —su serie es
                    // historia válida—, pero el informe dice cuál y desde
                    // cuándo, para que su ausencia en la última visita no
                    // parezca un olvido.
                    const points = section.data.points;
                    const bajas = points.filter((p) => p.retired_on !== null);
                    if (bajas.length === 0) return points.length;
                    const detalle = bajas
                      .map(
                        (p) =>
                          `${p.code}, desde el ${formatDateOnly(p.retired_on!)}`,
                      )
                      .join("; ");
                    return `${points.length} (${bajas.length} de baja: ${detalle})`;
                  })()}
                </dd>
                <dt>Visitas</dt>
                <dd>{section.data.visits.length}</dd>
                <dt>Peor alerta (última visita)</dt>
                <dd>
                  {(() => {
                    const last =
                      section.data.history.visits[
                        section.data.history.visits.length - 1
                      ];
                    return last ? ALERT_LEVEL_LABELS[last.worstAlert] : "—";
                  })()}
                </dd>
                {/* El equipo es de la VISITA, no del lugar: el instrumento puede
                    cambiar entre campañas (§ Fase 8). Se muestra el de la más
                    reciente, la misma que informa la peor alerta de arriba. */}
                {(() => {
                  const lastVisit =
                    section.data.visits[section.data.visits.length - 1];
                  if (!lastVisit) return null;
                  return (
                    <>
                      <dt>Orden de precisión (última visita)</dt>
                      <dd>
                        {PRECISION_ORDER_LABELS[lastVisit.precision_order]}
                      </dd>
                      <dt>Equipo (última visita)</dt>
                      <dd>
                        {formatEquipmentLine(
                          lastVisit.equipment_brand,
                          lastVisit.equipment_model,
                          lastVisit.equipment_serial,
                        )}
                      </dd>
                      <dt>Tipo de nivel</dt>
                      <dd>
                        {lastVisit.level_type
                          ? LEVEL_TYPE_LABELS[lastVisit.level_type]
                          : "—"}
                      </dd>
                      <dt>Desviación típica</dt>
                      <dd>{formatKmPrecision(lastVisit.km_precision_mm)}</dd>
                    </>
                  );
                })()}
              </dl>
              <SettlementPlot
                points={section.data.pointInputs}
                visits={section.data.history.visits}
              />
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Punto</th>
                    <th>Acumulado (mm)</th>
                    <th>Velocidad (mm/mes)</th>
                    <th>Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    section.data.history.visits[
                      section.data.history.visits.length - 1
                    ]?.readings ?? []
                  ).map((r) => {
                    const code =
                      section.data.points.find((p) => p.id === r.pointId)
                        ?.code ?? r.pointId;
                    return (
                      <tr key={r.pointId}>
                        <td>{code}</td>
                        <td className="num">
                          {r.accumulatedSettlement === null
                            ? "—"
                            : r.accumulatedSettlement.toFixed(1)}
                        </td>
                        <td className="num">
                          {r.velocity === null ? "—" : r.velocity.toFixed(2)}
                        </td>
                        <td>{ALERT_LEVEL_LABELS[r.alertStatus]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {section.data.points.some((p) => p.active_from !== null) && (
                <p className="report-footnote">
                  {section.data.points
                    .filter((p) => p.active_from !== null)
                    .map(
                      (p) =>
                        `El acumulado de ${p.code} se mide desde su alta (${formatDateOnly(p.active_from!)}), no desde la línea base del lugar.`,
                    )
                    .join(" ")}
                </p>
              )}
            </>
          )}
        </section>
      ))}

      {/* ---------- Resumen consolidado de precisiones ---------- */}
      <section className="report-section report-break">
        <h2>Resumen consolidado de precisiones</h2>
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
            {filasResumen.map((f) => (
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
            (*) El cierre cumple la tolerancia de su orden, pero la precisión
            del equipo declarado no alcanza el coeficiente K de ese orden. El
            «Sí» es sobre las medidas, no sobre la capacidad del instrumento.
          </p>
        )}
      </section>

      {/* ---------- Observaciones ---------- */}
      {report.observations && (
        <section className="report-section">
          <h2>Observaciones</h2>
          <p className="report-observations">{report.observations}</p>
        </section>
      )}

      {/* ---------- Registro de cierre ---------- */}
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
              const closedAt =
                s.kind === "polygonal"
                  ? s.data.process?.closed_at
                  : s.kind === "leveling"
                    ? s.data.process?.closed_at
                    : s.kind === "site"
                      ? s.data.site.closed_at
                      : null;
              const closedBy =
                s.kind === "polygonal"
                  ? s.data.process?.closed_by
                  : s.kind === "leveling"
                    ? s.data.process?.closed_by
                    : s.kind === "site"
                      ? s.data.site.closed_by
                      : null;
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
        <p className="report-footer">
          Informe emitido desde TopoField el{" "}
          {report.generated_at ? formatDate(report.generated_at) : "—"}. El
          contenido procede de procesos cerrados, inmutables desde su cierre.
        </p>
      </section>
    </div>
  );
}
