// «3. Corrección por método …» del informe de una poligonal (Fase 35): cómo
// corrigió el método elegido, con sus fórmulas en MathML y las cifras del motor
// (`correctionBreakdown`, el ajuste por mínimos cuadrados). Los textos son los
// de las maquetas aprobadas, con los números de cada poligonal.

import type { ReactNode } from "react";
import { formatAngle } from "@/components/polygonal/angle-format";
import type { CaptureRow } from "@/components/polygonal/capture-rows";
import { sigma0Interval, sigma0Reading } from "@/lib/calculations/least-squares";
import type { AngularStep, CorrectionBreakdown } from "@/lib/calculations/correction-breakdown";
import {
  CORRECTION_METHOD_LABELS,
  type AngleInputFormat,
  type PolygonalInput,
  type PolygonalResult,
} from "@/types/polygonal";
import { Formula, Frac, Gap, Hat, MathLine, Matrix, Mi, Mn, Mo, Mtext, Num, Row, Sqrt, Sub, SubSup, Sum, Sup, Thin } from "../math";

interface CorrectionProps {
  input: PolygonalInput;
  result: PolygonalResult;
  breakdown: CorrectionBreakdown | null;
  rows: CaptureRow[];
  angleFormat: AngleInputFormat;
  referenceLabel: string | null;
}

/** «+0.0084 m», con el signo siempre. */
const meters = (v: number, decimals = 4) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(decimals)} m`;
/** Milímetros con signo, a la décima: «−1.5». */
function mm(v: number | null | undefined): string {
  if (v == null) return "—";
  const r = Number((v * 1000).toFixed(1));
  if (r === 0) return "0.0";
  return `${r < 0 ? "−" : "+"}${Math.abs(r).toFixed(1)}`;
}
/** Segundos con signo, a la décima: «−1.6″». */
function sec(v: number): string {
  const r = Number(v.toFixed(1));
  if (r === 0) return "0.0″";
  return `${r < 0 ? "−" : "+"}${Math.abs(r).toFixed(1)}″`;
}

/** e_N y e_E, con su subíndice. */
const ErrorsText = ({ n, e }: { n: number; e: number }) => (
  <>
    (e<sub>N</sub> = {meters(n)}, e<sub>E</sub> = {meters(e)})
  </>
);

/** Un número en notación científica para una fórmula: «−1.1226 × 10⁻⁴». */
function Sci({ value }: { value: number }) {
  if (value === 0) return <Mn>0</Mn>;
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exp;
  return (
    <>
      <Num value={mantissa} decimals={4} sign />
      <Mo>×</Mo>
      <Sup base={<Mn>10</Mn>} sup={exp < 0 ? <><Mo>−</Mo><Mn>{-exp}</Mn></> : <Mn>{exp}</Mn>} />
    </>
  );
}

const absN = (
  <Row>
    <Mo>|</Mo>
    <Mi>Δ</Mi>
    <Mi>N</Mi>
    <Mo>|</Mo>
  </Row>
);
const absE = (
  <Row>
    <Mo>|</Mo>
    <Mi>Δ</Mi>
    <Mi>E</Mi>
    <Mo>|</Mo>
  </Row>
);

/** Los ángulos que entran en la corrección, en palabras. */
function angularClause(input: PolygonalInput, step: AngularStep, reference: string | null): string {
  const start = input.stations[0]?.pointCode ?? "";
  if (input.type === "open_controlled") return `entre las ${step.count} deflexiones de la condición`;
  if (step.includesOrientation) {
    return `entre los ${step.count} ángulos de la condición, incluido el de orientación en ${start} y el cierre contra ${reference ?? "la referencia"}`;
  }
  if (input.hasOrientation) {
    return `entre los ${step.count} ángulos de la condición. El de orientación en ${start} no entra en ella: fija el datum`;
  }
  return `entre los ${step.count} ángulos de la condición`;
}

/** Paso 1 de los métodos proporcionales: el reparto del error angular. */
function AngularStepBlock({
  input,
  step,
  reference,
  lead,
  tail,
}: {
  input: PolygonalInput;
  step: AngularStep;
  reference: string | null;
  lead?: string;
  tail?: string;
}) {
  if (step.errorSec === null || step.count === null || step.perAngleSec === null) {
    return (
      <>
        <h4>Paso 1 · Ángulos</h4>
        <p className="report-text">Sin cierre angular: los ángulos no se corrigen.</p>
      </>
    );
  }
  const e = step.errorSec;
  return (
    <>
      <h4>Paso 1 · Ángulos</h4>
      <p className="report-text">
        {lead}
        {lead ? "el" : "El"} error angular se repartió por igual {angularClause(input, step, reference)}.{tail ? ` ${tail}` : ""}
      </p>
      <Formula caption={`por ángulo, en los ${step.count} de la condición`}>
        <MathLine>
          <Mi>c</Mi>
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Frac num={<Sub base={<Mi>e</Mi>} sub={<Mi>α</Mi>} />} den={<Mi>n</Mi>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Frac
            num={
              e < 0 ? (
                <>
                  <Mo>(</Mo>
                  <Num value={e} decimals={1} />
                  <Mo>″</Mo>
                  <Mo>)</Mo>
                </>
              ) : (
                <>
                  <Num value={e} decimals={1} />
                  <Mo>″</Mo>
                </>
              )
            }
            den={<Mn>{step.count}</Mn>}
          />
          <Mo>=</Mo>
          <Num value={step.perAngleSec} decimals={2} />
          <Mo>″</Mo>
        </MathLine>
      </Formula>
    </>
  );
}

type Proportional = Extract<CorrectionBreakdown, { method: "bowditch" | "transit" }>;

function Bowditch({ b, ...p }: CorrectionProps & { b: Proportional }) {
  return (
    <>
      <p className="report-text">
        La Brújula corrige en dos pasos: primero los ángulos y después las proyecciones. Se usa cuando ángulos y
        distancias se midieron con precisión parecida, como con estación total.
      </p>
      <AngularStepBlock
        input={p.input}
        step={b.angular}
        reference={p.referenceLabel}
        tail="Con los ángulos corregidos se recalcularon los azimuts, y con ellos las proyecciones de cada lado."
      />
      <h4>Paso 2 · Proyecciones</h4>
      <p className="report-text">
        El error de cierre lineal <ErrorsText n={b.errorN} e={b.errorE} /> se repartió en proporción a la longitud de
        cada lado: los lados largos absorben más corrección.
      </p>
      <Formula>
        <MathLine>
          <Sub base={<Mi>C</Mi>} sub={<><Mi>N</Mi><Mo>,</Mo><Mi>i</Mi></>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Sub base={<Mi>e</Mi>} sub={<Mi>N</Mi>} />
          <Frac num={<Sub base={<Mi>d</Mi>} sub={<Mi>i</Mi>} />} den={<Mi>P</Mi>} />
          <Gap />
          <Sub base={<Mi>C</Mi>} sub={<><Mi>E</Mi><Mo>,</Mo><Mi>i</Mi></>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Sub base={<Mi>e</Mi>} sub={<Mi>E</Mi>} />
          <Frac num={<Sub base={<Mi>d</Mi>} sub={<Mi>i</Mi>} />} den={<Mi>P</Mi>} />
        </MathLine>
        <MathLine>
          <Mi>P</Mi>
          <Mo>=</Mo>
          <Sum under={<Mi>i</Mi>} />
          <Sub base={<Mi>d</Mi>} sub={<Mi>i</Mi>} />
          <Mo>=</Mo>
          <Mn>{b.perimeter.toFixed(3)}</Mn>
          <Mi>m</Mi>
        </MathLine>
      </Formula>
      <table className="report-table">
        <thead>
          <tr>
            <th>Lado</th>
            <th className="num">d (m)</th>
            <th className="num">d / P</th>
            <th className="num">Corr ΔN (mm)</th>
            <th className="num">Corr ΔE (mm)</th>
          </tr>
        </thead>
        <tbody>
          {b.sides.map((s, i) => (
            <tr key={i}>
              <td>
                {s.from} → {s.to}
              </td>
              <td className="num">{s.distance.toFixed(3)}</td>
              <td className="num">{(s.distance / b.perimeter).toFixed(3)}</td>
              <td className="num">{mm(s.corrN)}</td>
              <td className="num">{mm(s.corrE)}</td>
            </tr>
          ))}
          <tr className="report-sum">
            <td>Σ</td>
            <td className="num">{b.perimeter.toFixed(3)}</td>
            <td className="num">1.000</td>
            <td className="num">{mm(b.sides.reduce((a, s) => a + s.corrN, 0))}</td>
            <td className="num">{mm(b.sides.reduce((a, s) => a + s.corrE, 0))}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Transit({ b, ...p }: CorrectionProps & { b: Proportional }) {
  return (
    <>
      <p className="report-text">
        El Tránsito corrige en dos pasos: primero los ángulos y después las proyecciones. Se usa cuando los ángulos se
        midieron con más precisión que las distancias.
      </p>
      <AngularStepBlock input={p.input} step={b.angular} reference={p.referenceLabel} lead="Igual que en la Brújula: " />
      <h4>Paso 2 · Proyecciones</h4>
      <p className="report-text">
        El error de cierre <ErrorsText n={b.errorN} e={b.errorE} /> se repartió en cada eje en proporción a la
        proyección absoluta de cada lado: un lado casi norte-sur absorbe casi toda la corrección en N y poca en E.
      </p>
      <Formula caption="k: corrección unitaria de cada eje">
        <MathLine>
          <Sub base={<Mi>C</Mi>} sub={<><Mi>N</Mi><Mo>,</Mo><Mi>i</Mi></>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Sub base={<Mi>e</Mi>} sub={<Mi>N</Mi>} />
          <Frac num={<><Mo>|</Mo><Mi>Δ</Mi><Sub base={<Mi>N</Mi>} sub={<Mi>i</Mi>} /><Mo>|</Mo></>} den={<><Sum />{absN}</>} />
          <Gap />
          <Sub base={<Mi>C</Mi>} sub={<><Mi>E</Mi><Mo>,</Mo><Mi>i</Mi></>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Sub base={<Mi>e</Mi>} sub={<Mi>E</Mi>} />
          <Frac num={<><Mo>|</Mo><Mi>Δ</Mi><Sub base={<Mi>E</Mi>} sub={<Mi>i</Mi>} /><Mo>|</Mo></>} den={<><Sum />{absE}</>} />
        </MathLine>
        <MathLine>
          <Sum />
          {absN}
          <Mo>=</Mo>
          <Mn>{b.sumAbsN.toFixed(3)}</Mn>
          <Mi>m</Mi>
          <Gap />
          <Sum />
          {absE}
          <Mo>=</Mo>
          <Mn>{b.sumAbsE.toFixed(3)}</Mn>
          <Mi>m</Mi>
        </MathLine>
        <MathLine>
          <Sub base={<Mi>k</Mi>} sub={<Mi>N</Mi>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Frac num={<Sub base={<Mi>e</Mi>} sub={<Mi>N</Mi>} />} den={<><Sum />{absN}</>} />
          <Mo>=</Mo>
          <Num value={b.factorN} decimals={6} sign />
          <Gap />
          <Sub base={<Mi>k</Mi>} sub={<Mi>E</Mi>} />
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Frac num={<Sub base={<Mi>e</Mi>} sub={<Mi>E</Mi>} />} den={<><Sum />{absE}</>} />
          <Mo>=</Mo>
          <Num value={b.factorE} decimals={6} sign />
        </MathLine>
      </Formula>
      <table className="report-table">
        <thead>
          <tr>
            <th>Lado</th>
            <th className="num">|ΔN| (m)</th>
            <th className="num">|ΔE| (m)</th>
            <th className="num">Corr ΔN (mm)</th>
            <th className="num">Corr ΔE (mm)</th>
          </tr>
        </thead>
        <tbody>
          {b.sides.map((s, i) => (
            <tr key={i}>
              <td>
                {s.from} → {s.to}
              </td>
              <td className="num">{Math.abs(s.deltaN).toFixed(3)}</td>
              <td className="num">{Math.abs(s.deltaE).toFixed(3)}</td>
              <td className="num">{mm(s.corrN)}</td>
              <td className="num">{mm(s.corrE)}</td>
            </tr>
          ))}
          <tr className="report-sum">
            <td>Σ</td>
            <td className="num">{b.sumAbsN.toFixed(3)}</td>
            <td className="num">{b.sumAbsE.toFixed(3)}</td>
            <td className="num">{mm(b.sides.reduce((a, s) => a + s.corrN, 0))}</td>
            <td className="num">{mm(b.sides.reduce((a, s) => a + s.corrE, 0))}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function Crandall({ b, ...p }: CorrectionProps & { b: Extract<CorrectionBreakdown, { method: "crandall" }> }) {
  const cosAz = (
    <Row>
      <Mi>cos</Mi>
      <Thin />
      <Sub base={<Mi>Az</Mi>} sub={<Mi>i</Mi>} />
    </Row>
  );
  const senAz = (
    <Row>
      <Mi>sen</Mi>
      <Thin />
      <Sub base={<Mi>Az</Mi>} sub={<Mi>i</Mi>} />
    </Row>
  );
  const dd = (
    <Row>
      <Mi>δ</Mi>
      <Sub base={<Mi>d</Mi>} sub={<Mi>i</Mi>} />
    </Row>
  );
  return (
    <>
      <p className="report-text">
        Crandall corrige en dos pasos. Primero los ángulos, como la Brújula; después deja esos ángulos fijos y ajusta
        solo las distancias. Se usa cuando los ángulos son mucho más fiables que las distancias.
      </p>
      <AngularStepBlock
        input={p.input}
        step={b.angular}
        reference={p.referenceLabel}
        tail="Desde aquí, los azimuts ya no cambian."
      />
      <h4>Paso 2 · Distancias</h4>
      <p className="report-text">
        El error de cierre <ErrorsText n={b.errorN} e={b.errorE} /> se absorbió cambiando solo la longitud de los
        lados, por mínimos cuadrados con peso 1/d: la corrección más pequeña posible, en proporción a cada distancia,
        que hace cerrar la poligonal.
      </p>
      <Formula>
        <MathLine>
          <Mi>min</Mi>
          <Mo>⁡</Mo>
          <Sum under={<Mi>i</Mi>} />
          <Frac num={<><Mi>δ</Mi><SubSup base={<Mi>d</Mi>} sub={<Mi>i</Mi>} sup={<Mn>2</Mn>} /></>} den={<Sub base={<Mi>d</Mi>} sub={<Mi>i</Mi>} />} />
        </MathLine>
        <MathLine>
          <Mtext>sujeto a</Mtext>
          <Gap />
          <Sum under={<Mi>i</Mi>} />
          {dd}
          {cosAz}
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Sub base={<Mi>e</Mi>} sub={<Mi>N</Mi>} />
          <Gap />
          <Sum under={<Mi>i</Mi>} />
          {dd}
          {senAz}
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Sub base={<Mi>e</Mi>} sub={<Mi>E</Mi>} />
        </MathLine>
        <MathLine>
          {dd}
          <Mo>=</Mo>
          <Sub base={<Mi>d</Mi>} sub={<Mi>i</Mi>} />
          <Row>
            <Mo>(</Mo>
            <Sub base={<Mi>λ</Mi>} sub={<Mn>1</Mn>} />
            {cosAz}
            <Mo>+</Mo>
            <Sub base={<Mi>λ</Mi>} sub={<Mn>2</Mn>} />
            {senAz}
            <Mo>)</Mo>
          </Row>
        </MathLine>
        <MathLine>
          <Matrix
            rows={[
              [
                <><Sum /><Mi>d</Mi><Thin /><Sup base={<Mi>cos</Mi>} sup={<Mn>2</Mn>} /><Thin /><Mi>Az</Mi></>,
                <><Sum /><Mi>d</Mi><Thin /><Mi>cos</Mi><Thin /><Mi>Az</Mi><Thin /><Mi>sen</Mi><Thin /><Mi>Az</Mi></>,
              ],
              [
                <><Sum /><Mi>d</Mi><Thin /><Mi>cos</Mi><Thin /><Mi>Az</Mi><Thin /><Mi>sen</Mi><Thin /><Mi>Az</Mi></>,
                <><Sum /><Mi>d</Mi><Thin /><Sup base={<Mi>sen</Mi>} sup={<Mn>2</Mn>} /><Thin /><Mi>Az</Mi></>,
              ],
            ]}
          />
          <Matrix rows={[[<Sub key="l1" base={<Mi>λ</Mi>} sub={<Mn>1</Mn>} />], [<Sub key="l2" base={<Mi>λ</Mi>} sub={<Mn>2</Mn>} />]]} />
          <Mo>=</Mo>
          <Matrix
            rows={[
              [<><Mo>−</Mo><Sub base={<Mi>e</Mi>} sub={<Mi>N</Mi>} /></>],
              [<><Mo>−</Mo><Sub base={<Mi>e</Mi>} sub={<Mi>E</Mi>} /></>],
            ]}
          />
        </MathLine>
        <MathLine>
          <Sub base={<Mi>λ</Mi>} sub={<Mn>1</Mn>} />
          <Mo>=</Mo>
          <Sci value={b.lambda1} />
          <Gap />
          <Sub base={<Mi>λ</Mi>} sub={<Mn>2</Mn>} />
          <Mo>=</Mo>
          <Sci value={b.lambda2} />
        </MathLine>
      </Formula>
      <table className="report-table">
        <thead>
          <tr>
            <th>Lado</th>
            <th className="num">Azimut</th>
            <th className="num">d medida (m)</th>
            <th className="num">δd (mm)</th>
            <th className="num">d ajustada (m)</th>
          </tr>
        </thead>
        <tbody>
          {b.sides.map((s, i) => (
            <tr key={i}>
              <td>
                {s.from} → {s.to}
              </td>
              <td className="num">{formatAngle(s.azimuth, p.angleFormat)}</td>
              <td className="num">{s.distance.toFixed(3)}</td>
              <td className="num">{mm(s.deltaD)}</td>
              <td className="num">{s.adjustedDistance.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="report-footnote">
        Las proyecciones corregidas salen de las distancias ajustadas con los mismos azimuts: ΔN = d·cos Az y ΔE = d·sen
        Az.
      </p>
    </>
  );
}

const SIGMA0_READING = {
  consistent: { label: "Consistente", text: "σ₀ cae dentro del intervalo: los pesos supuestos describen bien las observaciones." },
  worse: { label: "Peor de lo supuesto", text: "σ₀ supera el intervalo: se midió peor de lo supuesto, o hay un error grueso en la cartera." },
  pessimistic: { label: "Pesimista", text: "σ₀ queda por debajo del intervalo: los σ supuestos son pesimistas, se midió mejor de lo declarado." },
} as const;

function Pairs({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="report-pairs">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function LeastSquares({ b, ...p }: CorrectionProps & { b: Extract<CorrectionBreakdown, { method: "least_squares" }> }) {
  const { input, rows, angleFormat, referenceLabel } = p;
  const adj = b.adjustment;
  const w = b.weights;
  const conditions =
    input.type === "closed"
      ? "la suma angular, Σ ΔN = 0 y Σ ΔE = 0"
      : adj?.conditions === 3
        ? "el azimut de llegada y las coordenadas de llegada en N y en E"
        : "las coordenadas de llegada en N y en E";
  const count = adj?.conditions === 2 ? "dos" : "tres";
  const start = input.stations[0]?.pointCode ?? "";
  const toFirst = input.stations[1]?.pointCode;
  const sides = rows.filter((r) => r.stationIndex !== null && (r.role === "side" || r.role === "closing"));
  const angles = rows.filter((r) => r.stationIndex !== null && r.angle !== null && r.role !== "pending");
  const label = (r: CaptureRow) => {
    if (r.role === "closing_angle") {
      return input.type === "open_controlled"
        ? `${r.from} (llegada)`
        : input.hasClosingRow
          ? `${r.from} (cierre contra ${referenceLabel ?? "la referencia"})`
          : `${r.from} (cierre angular)`;
    }
    if (r.stationIndex === 0 && input.hasOrientation) return `${r.from} (orientación)`;
    return r.from;
  };
  const bounds = adj ? sigma0Interval(adj.conditions).map((x) => x.toFixed(3)) : null;
  const reading = adj ? SIGMA0_READING[sigma0Reading(adj.sigma0, adj.conditions)] : null;
  const angleSum = adj ? adj.angleCorrectionsSec.reduce<number>((a, c) => a + (c ?? 0), 0) : 0;

  return (
    <>
      <p className="report-text">
        Los mínimos cuadrados corrigen ángulos y distancias a la vez, en un solo cálculo. Cada observación se corrige
        según su precisión: la menos fiable absorbe más. La poligonal queda cumpliendo {count} condiciones: {conditions}.
      </p>
      {w && (
        <>
          <h4>Pesos a priori</h4>
          <Pairs
            items={[
              ["σ de cada ángulo", `${w.sigmaAngleSeconds}″`],
              [
                "σ de cada distancia",
                `${(w.sigmaDistanceM * 1000).toFixed(1)} mm, ${w.distanceMeasurements} ${w.distanceMeasurements === 1 ? "medición" : "mediciones"}`,
              ],
              ["σ efectiva de la distancia, σ/√n", `${((w.sigmaDistanceM / Math.sqrt(w.distanceMeasurements)) * 1000).toFixed(1)} mm`],
              ...(adj ? ([["Condiciones · iteraciones", `${adj.conditions} · ${adj.iterations}`]] as [string, ReactNode][]) : []),
            ]}
          />
        </>
      )}
      <Formula caption="Se itera porque las condiciones no son lineales en los ángulos.">
        <MathLine>
          <Mi>v</Mi>
          <Mo>=</Mo>
          <Mo>−</Mo>
          <Mi>Q</Mi>
          <Sup base={<Mi>A</Mi>} sup={<Mi>T</Mi>} />
          <Sup base={<Row><Mo>(</Mo><Mi>A</Mi><Mi>Q</Mi><Sup base={<Mi>A</Mi>} sup={<Mi>T</Mi>} /><Mo>)</Mo></Row>} sup={<><Mo>−</Mo><Mn>1</Mn></>} />
          <Mi>w</Mi>
          <Gap />
          <Mi>Q</Mi>
          <Mo>=</Mo>
          <Mi>diag</Mi>
          <Mo>⁡</Mo>
          <Row>
            <Mo>(</Mo>
            <SubSup base={<Mi>σ</Mi>} sub={<Mi>j</Mi>} sup={<Mn>2</Mn>} />
            <Mo>)</Mo>
          </Row>
        </MathLine>
        <MathLine>
          <Sub base={<Mi>σ</Mi>} sub={<><Mi>d</Mi><Mo>,</Mo><Mtext>ef</Mtext></>} />
          <Mo>=</Mo>
          <Frac num={<Sub base={<Mi>σ</Mi>} sub={<Mi>d</Mi>} />} den={<Sqrt><Mi>n</Mi></Sqrt>} />
          <Gap />
          <Sub base={<Mi>σ</Mi>} sub={<Mn>0</Mn>} />
          <Mo>=</Mo>
          <Sqrt>
            <Frac num={<><Sup base={<Mi>v</Mi>} sup={<Mi>T</Mi>} /><Mi>P</Mi><Mi>v</Mi></>} den={<Mi>r</Mi>} />
          </Sqrt>
        </MathLine>
      </Formula>
      {b.datumStation && (
        <p className="report-text">
          El ángulo de orientación en {start}
          {toFirst && referenceLabel ? ` (hacia ${toFirst}, medido desde ${referenceLabel})` : ""} es el datum y{" "}
          <strong>no se corrige</strong>: un error suyo rota la poligonal entera sin afectar al cierre, así que las
          condiciones no lo determinan.
          {input.type === "closed" && input.hasClosingRow
            ? " Los métodos Brújula, Tránsito y Crandall, en cambio, sí lo corrigen como un ángulo más."
            : ""}
        </p>
      )}
      {!adj ? (
        <p className="report-text">
          Sin ajuste: {w ? "la geometría de la poligonal no permite el ajuste." : "faltan los pesos del ajuste."}
        </p>
      ) : (
        <>
          <h4>Correcciones a los ángulos</h4>
          <table className="report-table">
            <thead>
              <tr>
                <th>Estación</th>
                <th className="num">Ángulo medido</th>
                <th className="num">Corrección</th>
                <th className="num">Ángulo ajustado</th>
              </tr>
            </thead>
            <tbody>
              {angles.map((r) => {
                const c = adj.angleCorrectionsSec[r.stationIndex!] ?? null;
                const datum = c === null && r.stationIndex === 0 && input.hasOrientation;
                return (
                  <tr key={`${r.stationIndex}-${r.role}`}>
                    <td>{label(r)}</td>
                    <td className="num">{formatAngle(r.angle, angleFormat)}</td>
                    <td className="num">{c === null ? (datum ? "datum" : "—") : sec(c)}</td>
                    <td className="num">{formatAngle(r.angle! + (c ?? 0) / 3600, angleFormat)}</td>
                  </tr>
                );
              })}
              <tr className="report-sum">
                <td>Σ</td>
                <td />
                <td className="num">{sec(angleSum)}</td>
                <td />
              </tr>
            </tbody>
          </table>
          <h4>Correcciones a las distancias</h4>
          <table className="report-table">
            <thead>
              <tr>
                <th>Lado</th>
                <th className="num">d medida (m)</th>
                <th className="num">Corrección (mm)</th>
                <th className="num">d ajustada (m)</th>
              </tr>
            </thead>
            <tbody>
              {sides.map((r) => (
                <tr key={r.stationIndex}>
                  <td>
                    {r.from} → {r.to}
                  </td>
                  <td className="num">{r.distance?.toFixed(3) ?? "—"}</td>
                  <td className="num">{mm(adj.distanceCorrectionsM[r.stationIndex!])}</td>
                  <td className="num">{adj.adjustedDistances[r.stationIndex!]?.toFixed(4) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4>Calidad del ajuste</h4>
          <Pairs
            items={[
              ["σ₀, desviación de la unidad de peso", adj.sigma0.toFixed(3)],
              ["Redundancia r", adj.conditions],
              ["Intervalo al 95 % (χ²)", `${bounds![0]} – ${bounds![1]}`],
              ["Lectura", reading!.label],
            ]}
          />
          <p className="report-text">{reading!.text}</p>
          <PointPrecision adj={adj} result={p.result} angleFormat={angleFormat} />
        </>
      )}
    </>
  );
}

/**
 * La precisión de cada punto ajustado (Fase 39): la covarianza propagada desde
 * las observaciones ajustadas y la elipse de error al 95 %, como en Ajuste.
 */
function PointPrecision({
  adj,
  result,
  angleFormat,
}: {
  adj: Extract<NonNullable<PolygonalResult["adjustment"]>, { status: "adjusted" }>;
  result: PolygonalResult;
  angleFormat: AngleInputFormat;
}) {
  const pr = adj.precision;
  const level = Math.round(pr.confidence * 100);
  const mmOf = (m: number) => (m * 1000).toFixed(1);
  return (
    <>
      <h4>Precisión de cada punto</h4>
      <p className="report-text">
        La covarianza de cada punto sale de propagar la de las observaciones ajustadas, con el σ₀ del ajuste. La elipse
        de error al {level} % es la estándar multiplicada por c, que depende de la redundancia r (Ghilani y Wolf,{" "}
        <em>Adjustment Computations</em>, ec. 19.22). Con las pocas condiciones de una poligonal simple, c es grande.
      </p>
      <Formula>
        <MathLine>
          <Sub base={<Mi>Q</Mi>} sub={<Hat><Mi>l</Mi></Hat>} />
          <Mo>=</Mo>
          <Mi>Q</Mi>
          <Mo>−</Mo>
          <Mi>Q</Mi>
          <Sup base={<Mi>A</Mi>} sup={<Mi>T</Mi>} />
          <Sup base={<Row><Mo>(</Mo><Mi>A</Mi><Mi>Q</Mi><Sup base={<Mi>A</Mi>} sup={<Mi>T</Mi>} /><Mo>)</Mo></Row>} sup={<><Mo>−</Mo><Mn>1</Mn></>} />
          <Mi>A</Mi>
          <Mi>Q</Mi>
          <Gap />
          <Sub base={<Mi>Σ</Mi>} sub={<><Mi>N</Mi><Mi>E</Mi></>} />
          <Mo>=</Mo>
          <SubSup base={<Mi>σ</Mi>} sub={<Mn>0</Mn>} sup={<Mn>2</Mn>} />
          <Mi>J</Mi>
          <Sub base={<Mi>Q</Mi>} sub={<Hat><Mi>l</Mi></Hat>} />
          <Sup base={<Mi>J</Mi>} sup={<Mi>T</Mi>} />
        </MathLine>
        <MathLine>
          <Mi>c</Mi>
          <Mo>=</Mo>
          <Sqrt>
            <Mn>2</Mn>
            <Mi>F</Mi>
            <Row>
              <Mo>(</Mo>
              <Mn>0.05</Mn>
              <Mo>,</Mo>
              <Mn>2</Mn>
              <Mo>,</Mo>
              <Mi>r</Mi>
              <Mo>)</Mo>
            </Row>
          </Sqrt>
          <Mo>=</Mo>
          <Mn>{pr.scale.toFixed(2)}</Mn>
          <Gap />
          <Mi>r</Mi>
          <Mo>=</Mo>
          <Mn>{adj.conditions}</Mn>
        </MathLine>
      </Formula>
      <table className="report-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th className="num">σ N (mm)</th>
            <th className="num">σ E (mm)</th>
            <th className="num">Semieje mayor (mm)</th>
            <th className="num">Semieje menor (mm)</th>
            <th className="num">Azimut del mayor</th>
          </tr>
        </thead>
        <tbody>
          {result.stations.map((s, i) => {
            const pt = pr.stations[i];
            return (
              <tr key={i}>
                <td>{s.pointCode}</td>
                {pt ? (
                  <>
                    <td className="num">{mmOf(pt.sigmaNorth)}</td>
                    <td className="num">{mmOf(pt.sigmaEast)}</td>
                    <td className="num">{mmOf(pt.ellipse.semiMajor)}</td>
                    <td className="num">{mmOf(pt.ellipse.semiMinor)}</td>
                    <td className="num">{formatAngle(pt.ellipse.majorAzimuth, angleFormat)}</td>
                  </>
                ) : (
                  <td colSpan={5}>Punto fijo: sin elipse.</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

/**
 * La sección «Corrección por método …». `null` si la poligonal no se corrige:
 * abierta sin control o sin datos completos.
 */
export function PolygonalCorrection(props: CorrectionProps & { number: number }) {
  const { breakdown, input, number } = props;
  if (!breakdown) return null;
  return (
    <>
      <h3>
        {number}. Corrección por método {CORRECTION_METHOD_LABELS[input.method]}
      </h3>
      {breakdown.method === "bowditch" && <Bowditch {...props} b={breakdown} />}
      {breakdown.method === "transit" && <Transit {...props} b={breakdown} />}
      {breakdown.method === "crandall" && <Crandall {...props} b={breakdown} />}
      {breakdown.method === "least_squares" && <LeastSquares {...props} b={breakdown} />}
    </>
  );
}
