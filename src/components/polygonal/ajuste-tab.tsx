"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Alert, Card } from "@/components/design-system";
import { correctionBreakdown, type AngularStep, type CorrectionBreakdown } from "@/lib/calculations/correction-breakdown";
import { validateLeastSquaresWeights } from "@/lib/validators/polygonal";
import { cn } from "@/lib/utils/cn";
import type { ReferencePoint } from "@/types/project";
import {
  CORRECTION_METHODS,
  CORRECTION_METHOD_LABELS,
  type AngleInputFormat,
  type CorrectionMethod,
  type PolygonalProcess,
  type PolygonalStationWithReadings,
} from "@/types/polygonal";
import { AdjustedTable } from "./adjusted-table";
import { formatSeconds } from "./angle-format";
import { GeoreferenceDialog } from "./georeference-dialog";
import { georeferenceSummary } from "./georeference-plan";
import { LeastSquaresPanel, LeastSquaresWeightsFields, PointPrecisionTable } from "./least-squares-panel";
import { OrderVerdict } from "./order-verdict";
import { PolygonalPlotViewer } from "./polygonal-plot-viewer";
import { typedWeights, weightsFromDraft, type LeastSquaresWeightsDraft } from "./polygonal-draft";
import type { PolygonalDraft } from "./polygonal-save";
import { usePolygonalComputation, usePolygonalDraft } from "./use-polygonal-draft";

const text = (v: number | null) => (v == null ? "" : String(v));

/** Un factor pequeño con su signo y tres cifras: «−0.0000727». */
function factor(v: number): string {
  const rounded = Number(v.toPrecision(3));
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}`;
}

const m = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(3)}`;

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-ink-2">{label}</div>
      <div className="font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function AngularLine({ step }: { step: AngularStep }) {
  if (step.errorSec === null || step.count === null || step.perAngleSec === null) {
    return <p className="text-sm text-ink-2">Sin cierre angular: los ángulos no se corrigen.</p>;
  }
  return (
    <p className="text-sm">
      Corrección angular: {formatSeconds(-step.errorSec)} entre {step.count} ángulos,{" "}
      <span className="font-semibold">{formatSeconds(step.perAngleSec, 2)}</span> cada uno
      {step.includesOrientation ? ", incluido el de orientación." : "."}
    </p>
  );
}

/** Las cifras de la corrección del método, como el bloque inferior de la hoja. */
function MethodFactors({ breakdown }: { breakdown: CorrectionBreakdown }) {
  if (breakdown.method === "least_squares") {
    return (
      <p className="text-sm">
        Mínimos cuadrados reparte las correcciones según los pesos de cada observación.
        {breakdown.datumStation
          ? ` El ángulo de orientación en ${breakdown.datumStation} fija el datum y no se corrige.`
          : ""}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <AngularLine step={breakdown.angular} />
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-3">
        <Figure label="Diferencias ΔN · ΔE">
          {m(breakdown.errorN)} · {m(breakdown.errorE)} m
        </Figure>
        {breakdown.method === "crandall" ? (
          <Figure label="Multiplicadores λ₁ · λ₂">
            {factor(breakdown.lambda1)} · {factor(breakdown.lambda2)}
          </Figure>
        ) : (
          <>
            {breakdown.method === "bowditch" ? (
              <Figure label="Perímetro P">{breakdown.perimeter.toFixed(3)} m</Figure>
            ) : (
              <Figure label="Suma de proyecciones |N| · |E|">
                {breakdown.sumAbsN.toFixed(3)} · {breakdown.sumAbsE.toFixed(3)} m
              </Figure>
            )}
            <Figure label={breakdown.method === "bowditch" ? "Factor −e / P · N · E" : "Corrección unitaria −e / Σ|Δ| · N · E"}>
              {factor(breakdown.factorN)} · {factor(breakdown.factorE)} m/m
            </Figure>
          </>
        )}
      </div>
    </div>
  );
}

interface AjusteTabProps {
  process: PolygonalProcess;
  stations: PolygonalStationWithReadings[];
  referencePoints: ReferencePoint[];
  angleFormat: AngleInputFormat;
  basePath: string;
}

/**
 * Paso 2 · Ajuste (Fase 35, maqueta «Ajuste»): el método, las cifras con el
 * orden alcanzado y su «Por qué», la poligonal ajustada al estilo de la hoja,
 * los factores del método y el dibujo ajustado con Georreferenciar. Cambiar el
 * método guarda; mínimos cuadrados, cuando están sus tres pesos.
 */
export function AjusteTab({ process, stations, referencePoints, angleFormat, basePath }: AjusteTabProps) {
  const { draft, save } = usePolygonalDraft(process, stations);
  // Mínimos cuadrados elegido sin pesos guardados: se ve, pero no se guarda
  // hasta que estén los tres.
  const [pendingMethod, setPendingMethod] = useState<CorrectionMethod | null>(null);
  const [weights, setWeights] = useState<LeastSquaresWeightsDraft>({
    sigmaAngleSeconds: text(draft.lsSigmaAngleSeconds),
    sigmaDistanceM: text(draft.lsSigmaDistanceM),
    // 1, el valor de una cartera que anota una distancia por lado (Fase 39,
    // decisión 7). Los σ no tienen valor por defecto: dependen del equipo.
    distanceMeasurements: text(draft.lsDistanceMeasurements ?? 1),
  });
  const [weightsError, setWeightsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const type = draft.details.type;
  const method = pendingMethod ?? draft.method;

  // Lo que se calcula: el borrador con el método elegido y, con mínimos
  // cuadrados, los pesos tecleados si son válidos.
  const effective = useMemo<PolygonalDraft>(() => {
    const typed = weightsFromDraft(weights);
    const valid = typed !== null && validateLeastSquaresWeights("least_squares", type, typed) === null;
    return {
      ...draft,
      method,
      ...(method === "least_squares" && valid && typed
        ? {
            lsSigmaAngleSeconds: typed.sigmaAngleSeconds,
            lsSigmaDistanceM: typed.sigmaDistanceM,
            lsDistanceMeasurements: typed.distanceMeasurements,
          }
        : {}),
    };
  }, [draft, method, weights, type]);
  const { input, result, order, referenceLabel, referenceCoords } = usePolygonalComputation(effective, referencePoints);
  const breakdown = useMemo(() => correctionBreakdown(input, result), [input, result]);

  function commit(next: PolygonalDraft) {
    setError(null);
    startTransition(async () => {
      const response = await save(next);
      if (response.ok) setPendingMethod(null);
      else setError(response.error ?? "No se pudo guardar.");
    });
  }

  function chooseMethod(next: CorrectionMethod) {
    if (next === method) return;
    if (next !== "least_squares") {
      setPendingMethod(null);
      setWeightsError(null);
      return commit({ ...draft, method: next });
    }
    const complete =
      draft.lsSigmaAngleSeconds != null && draft.lsSigmaDistanceM != null && draft.lsDistanceMeasurements != null;
    if (complete) return commit({ ...draft, method: next });
    setPendingMethod(next);
    setWeightsError(validateLeastSquaresWeights("least_squares", type, typedWeights(weights)));
  }

  function commitWeights() {
    if (method !== "least_squares") return;
    const typed = weightsFromDraft(weights);
    const problem = validateLeastSquaresWeights("least_squares", type, typedWeights(weights));
    setWeightsError(problem);
    if (problem || !typed) return;
    const same =
      draft.method === "least_squares" &&
      draft.lsSigmaAngleSeconds === typed.sigmaAngleSeconds &&
      draft.lsSigmaDistanceM === typed.sigmaDistanceM &&
      draft.lsDistanceMeasurements === typed.distanceMeasurements;
    if (same) return;
    commit({
      ...draft,
      method: "least_squares",
      lsSigmaAngleSeconds: typed.sigmaAngleSeconds,
      lsSigmaDistanceM: typed.sigmaDistanceM,
      lsDistanceMeasurements: typed.distanceMeasurements,
    });
  }

  // La partida siempre tiene coordenadas: hay ajuste si hay al menos otro punto.
  const computed = result.stations.filter((s) => s.north != null).length;
  const hasCoordinates = computed >= 2;
  const adjustable = type !== "open_uncontrolled";
  const georefBlocked = pendingMethod
    ? "Completa los pesos de mínimos cuadrados, o elige otro método, antes de georreferenciar."
    : !hasCoordinates
      ? "Para georreferenciar hacen falta coordenadas calculadas."
      : null;
  const summary = georeferenceSummary(process);
  const amarre = { start: draft.amarre.startCode, reference: referenceLabel, end: draft.amarre.endCode };

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert variant="error">{error}</Alert>}

      {adjustable ? (
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">Método de ajuste</span>
              <div
                role="group"
                aria-label="Método de ajuste"
                className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong sm:inline-flex"
              >
                {CORRECTION_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    disabled={isPending}
                    onClick={() => chooseMethod(m)}
                    className={cn(
                      "min-h-11 border-b border-r border-rule px-3.5 text-sm font-medium sm:border-b-0 sm:last:border-r-0",
                      method === m ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                    )}
                  >
                    {CORRECTION_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            {method === "least_squares" && (
              <LeastSquaresWeightsFields
                weights={weights}
                error={weightsError}
                onChange={setWeights}
                onCommit={commitWeights}
              />
            )}
            <OrderVerdict result={result} type={type} order={order} />
          </div>
        </Card>
      ) : (
        <Alert variant="info">
          Sin verificación de cierre: la abierta sin control no llega a un punto conocido y no hay nada que ajustar. Las
          coordenadas se encadenan con los ángulos y las distancias medidos.
        </Alert>
      )}

      {!hasCoordinates ? (
        <Card>
          {result.adjustment?.status === "missing_weights" ? (
            <p className="text-sm text-ink-2">
              El ajuste por mínimos cuadrados aparece cuando estén sus pesos.{" "}
              {validateLeastSquaresWeights("least_squares", type, typedWeights(weights))}
            </p>
          ) : result.adjustment?.status === "unadjustable" ? (
            <LeastSquaresPanel result={result} />
          ) : (
            <p className="text-sm text-ink-2">
              El ajuste aparece cuando la poligonal está completa.{" "}
              <Link href={`${basePath}?tab=datos`} className="font-medium text-mira-ink underline underline-offset-2">
                Termina la captura en Datos
              </Link>
              .
            </p>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[5fr_3fr]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card
              title={
                adjustable ? `Poligonal ajustada · ${CORRECTION_METHOD_LABELS[method]}` : "Coordenadas encadenadas"
              }
            >
              <AdjustedTable
                input={input}
                result={result}
                amarre={amarre}
                angleFormat={angleFormat}
                corrected={adjustable}
              />
            </Card>
            {breakdown && (
              <Card title={`Corrección por método ${CORRECTION_METHOD_LABELS[method]}`}>
                <div className="flex flex-col gap-4">
                  <MethodFactors breakdown={breakdown} />
                  {method === "least_squares" && <LeastSquaresPanel result={result} />}
                </div>
              </Card>
            )}
            {method === "least_squares" && result.adjustment?.status === "adjusted" && (
              <Card title="Precisión de cada punto">
                <PointPrecisionTable result={result} angleFormat={angleFormat} />
              </Card>
            )}
          </div>
          <div className="min-w-0">
            <div className="lg:sticky lg:top-[calc(var(--barra-alto)+1rem)]">
              <Card
                title="Dibujo"
                actions={
                  <GeoreferenceDialog
                    process={process}
                    stations={stations}
                    referencePoints={referencePoints}
                    disabledReason={georefBlocked}
                  />
                }
              >
                {(summary || georefBlocked) && (
                  <p className="mb-3 text-sm text-ink-2">{summary ? `Georreferenciado ${summary}.` : georefBlocked}</p>
                )}
                <PolygonalPlotViewer input={input} result={result} reference={referenceCoords} />
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
