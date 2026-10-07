import { SettlementPlot } from "@/components/reports/settlement-plot";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import type { SiteSectionData } from "@/lib/reports/sections";
import { formatDateOnly, formatDateShort, formatElevation, formatEquipmentLine, formatSignedMm } from "@/lib/utils/format";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import { STRUCTURE_TYPE_LABELS, type StructureType } from "@/types/site";
import { Formula, Frac, MathLine, Mi, Mn, Mo, Mtext, Row, Sub, Sup } from "../math";

const signed = (v: { code: string; value: number } | null) => (v ? `${formatSignedMm(v.value)} ${v.code}` : "—");

/**
 * Cuerpo de la sección de un lugar (Fase 37, lienzo «Informe del lugar»): el
 * veredicto, cómo se calcula, la evolución, las visitas, los puntos de la
 * última, las notas y los avisos. Informa las visitas calculadas; las que
 * están en medición se nombran aparte.
 */
export function SettlementReportSection({ data }: { data: SiteSectionData }) {
  const { site, points, pointInputs, visits, report } = data;
  const lastVisit = visits.at(-1);
  const t = thresholdsOf(site);

  // Un punto de baja sigue contando —su serie es historia válida—, pero el
  // informe dice cuál y desde cuándo, para que su ausencia en la última visita
  // no parezca un olvido.
  const bajas = points.filter((p) => p.retired_on !== null);
  const conteoPuntos =
    bajas.length === 0
      ? points.length
      : `${points.length} (${bajas.length} de baja: ${bajas
          .map((p) => `${p.code}, desde el ${formatDateOnly(p.retired_on!)}`)
          .join("; ")})`;
  const first = report.rows[0];
  const last = report.rows.at(-1);

  return (
    <>
      <dl className="report-pairs">
        <dt>Tipo de estructura</dt>
        <dd>{STRUCTURE_TYPE_LABELS[site.structure_type as StructureType] ?? site.structure_type}</dd>
        <dt>Puntos de control</dt>
        <dd>{conteoPuntos}</dd>
        <dt>Visitas</dt>
        <dd>
          {report.rows.length}
          {first && last && first !== last
            ? `, del ${formatDateOnly(first.date)} al ${formatDateOnly(last.date)}`
            : first
              ? `, el ${formatDateOnly(first.date)}`
              : ""}
        </dd>
        {/* El BM y el equipo son de la visita, no del lugar: pueden cambiar
            entre visitas. Se muestran los de la más reciente. */}
        {lastVisit && (
          <>
            <dt>BM de arranque (última visita)</dt>
            <dd>
              {lastVisit.reference_bm_code
                ? `${lastVisit.reference_bm_code} · ${formatElevation(lastVisit.reference_bm_elevation)} m`
                : "—"}
            </dd>
            <dt>Equipo (última visita)</dt>
            <dd>{formatEquipmentLine(lastVisit.equipment_brand, lastVisit.equipment_model, lastVisit.equipment_serial)}</dd>
          </>
        )}
      </dl>

      <h3>Veredicto</h3>
      {report.verdict.length > 0 ? <p>{report.verdict.join(" ")}</p> : <p>El lugar no tiene visitas calculadas.</p>}
      {report.verification && <p>{report.verification}</p>}
      {report.inProgress.length > 0 && (
        <p className="report-footnote">
          {report.inProgress.length === 1
            ? `La visita ${report.inProgress[0]} está en medición: entra al informe cuando se termine.`
            : `Las visitas ${report.inProgress.join(", ")} están en medición: entran al informe cuando se terminen.`}
        </p>
      )}

      <h3>Cómo se calcula</h3>
      <p>La altura del instrumento, desde el BM</p>
      <Formula>
        <MathLine label="AI igual a la cota del BM más la vista atrás">
          <Mi>AI</Mi>
          <Mo>=</Mo>
          <Sub base={<Mi>C</Mi>} sub={<Mtext>BM</Mtext>} />
          <Mo>+</Mo>
          <Sup base={<Mi>V</Mi>} sup={<Mo>+</Mo>} />
        </MathLine>
      </Formula>
      <p>La cota de cada punto, con su lectura</p>
      <Formula>
        <MathLine label="La cota del punto igual a AI menos su lectura">
          <Sub base={<Mi>C</Mi>} sub={<Mi>i</Mi>} />
          <Mo>=</Mo>
          <Mi>AI</Mi>
          <Mo>−</Mo>
          <Sub base={<Mi>L</Mi>} sub={<Mi>i</Mi>} />
        </MathLine>
      </Formula>
      <p>El acumulado, contra la cota inicial del punto</p>
      <Formula>
        <MathLine label="El acumulado igual a la cota menos la inicial, por mil">
          <Sub base={<Mi>S</Mi>} sub={<Mi>i</Mi>} />
          <Mo>=</Mo>
          <Row>
            <Mo>(</Mo>
            <Sub base={<Mi>C</Mi>} sub={<Mi>i</Mi>} />
            <Mo>−</Mo>
            <Sub base={<Mi>C</Mi>} sub={<Mn>0</Mn>} />
            <Mo>)</Mo>
          </Row>
          <Mo>·</Mo>
          <Mn>1000</Mn>
        </MathLine>
      </Formula>
      <p>La velocidad, con un mes de 30.4375 días</p>
      <Formula>
        <MathLine label="La velocidad igual al cambio del acumulado entre los días sobre 30.4375">
          <Mi>v</Mi>
          <Mo>=</Mo>
          <Frac
            num={
              <>
                <Sub base={<Mi>S</Mi>} sub={<Mi>i</Mi>} />
                <Mo>−</Mo>
                <Sub
                  base={<Mi>S</Mi>}
                  sub={
                    <>
                      <Mi>i</Mi>
                      <Mo>−</Mo>
                      <Mn>1</Mn>
                    </>
                  }
                />
              </>
            }
            den={
              <>
                <Mtext>días</Mtext>
                <Mo>/</Mo>
                <Mn>30.4375</Mn>
              </>
            }
          />
        </MathLine>
      </Formula>
      <p>
        Las cotas son las de la medida: el cierre de cada tramo comprueba, no se reparte. Cada punto toma el peor de sus
        dos semáforos, por acumulado ({t.accumulatedCaution} · {t.accumulatedAlert} · {t.accumulatedAlarm} mm) y por
        velocidad ({t.velocityCaution} · {t.velocityAlert} · {t.velocityAlarm} mm/mes).
      </p>

      <h3>Evolución</h3>
      <SettlementPlot points={pointInputs} visits={report.history.visits} />

      <h3>Visitas</h3>
      <table className="report-table">
        <thead>
          <tr>
            <th>Visita</th>
            <th>Fecha</th>
            <th>Promedio (mm)</th>
            <th>Máximo (mm)</th>
            <th>Mayor Δ (mm)</th>
            <th>Verificación</th>
            <th>Peor alerta</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={r.visitId}>
              <td>{r.visitNumber}</td>
              <td>{formatDateShort(r.date)}</td>
              <td className="num">{r.mean == null ? "—" : formatSignedMm(r.mean)}</td>
              <td className="num">{r.base ? "—" : signed(r.maxSettlement)}</td>
              <td className="num">{r.base ? "—" : signed(r.maxMove)}</td>
              <td>{r.verification}</td>
              <td>{r.base ? "Base" : ALERT_LEVEL_LABELS[r.worstAlert]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {report.last && (
        <>
          <h3>Puntos en la visita {report.last.visitNumber}</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>Punto</th>
                <th>Acum. (mm)</th>
                <th>v (mm/mes)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {report.last.points.map((p) => (
                <tr key={p.code}>
                  <td>{p.code}</td>
                  <td className="num">{p.accumulated == null ? "—" : formatSignedMm(p.accumulated)}</td>
                  <td className="num">{p.velocity == null ? "—" : p.velocity.toFixed(2)}</td>
                  <td>{ALERT_LEVEL_LABELS[p.alert]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.notes.length > 0 && (
        <>
          <h3>Notas de las visitas</h3>
          <ul>
            {report.notes.map((n) => (
              <li key={n.visitNumber}>
                Visita {n.visitNumber} · {formatDateShort(n.date)}: {n.text}
              </li>
            ))}
          </ul>
        </>
      )}

      {report.warnings.length > 0 && (
        <>
          <h3>Avisos</h3>
          <ul>
            {report.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}

      {points.some((p) => p.active_from !== null) && (
        <p className="report-footnote">
          {points
            .filter((p) => p.active_from !== null)
            .map(
              (p) =>
                `El acumulado de ${p.code} se mide desde su alta (${formatDateOnly(p.active_from!)}), no desde la línea base del lugar.`,
            )
            .join(" ")}
        </p>
      )}
    </>
  );
}
