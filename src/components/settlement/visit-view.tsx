"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  KpiCard,
  StatusIndicator,
} from "@/components/design-system";
import { BookDrawer } from "@/components/settlement/book-drawer";
import type { ChartThresholds } from "@/components/settlement/charts/trend-chart";
import { PointBarsChart } from "@/components/settlement/charts/point-bars-chart";
import { PointHistoryChart } from "@/components/settlement/charts/point-history-chart";
import { CloseVisitDialog } from "@/components/settlement/close-visit-dialog";
import {
  nextAccumulatedThreshold,
  type VisitSummary,
} from "@/lib/calculations/settlement-summary";
import { cn } from "@/lib/utils/cn";
import {
  formatBookClosure,
  formatDateOnly,
  formatSignedMm,
} from "@/lib/utils/format";
import { closeVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import {
  ALERT_LEVEL_LABELS,
  VISIT_STATUS_LABELS,
  type AlertLevel,
  type CaptureMode,
  type SettlementBookReading,
  type VisitStatus,
} from "@/types/settlement";

const STATUS_TONE = {
  draft: "neutral",
  calculated: "primary",
  closed: "success",
} as const;

const LEVEL_NAMES = { caution: "precaución", alert: "alerta", alarm: "alarma" } as const;

/** Un punto de control en esta visita, ya calculado en el servidor. */
export interface VisitPointRow {
  pointId: string;
  code: string;
  /** Con la marca de baja o alta (Fase 11), para las gráficas. */
  label: string;
  /** La marca corta bajo el código en la tabla: «de baja», «alta 15 mar 2025». */
  note: string | null;
  /** Índice de serie, para que el historial use la misma forma que el panel. */
  seriesIndex: number;
  baselineElevation: number | null;
  elevation: number | null;
  accumulated: number | null;
  partial: number | null;
  velocity: number | null;
  level: AlertLevel | null;
  /** Aviso de lectura fuera de tendencia (Fase 12), ya redactado. */
  trendWarning: string | null;
  /** El acumulado del punto en cada visita hasta esta. */
  history: { date: string; value: number }[];
}

interface VisitViewProps {
  projectId: string;
  siteId: string;
  visitId: string;
  visitLabel: string;
  isBaseline: boolean;
  date: string;
  operator: string | null;
  equipment: string;
  status: VisitStatus;
  captureMode: CaptureMode;
  amarre: { code: string; elevation: number | null } | null;
  closureErrorMm: number | null;
  toleranceMm: number | null;
  meetsTolerance: boolean | null;
  /** Comprobación aritmética de la libreta guardada; null sin libreta. */
  arithmeticCheckOk: boolean | null;
  summary: VisitSummary;
  /** Promedio de la visita anterior, para el Δ del KPI. */
  previousMean: number | null;
  rows: VisitPointRow[];
  thresholds: ChartThresholds;
  book: SettlementBookReading[];
  prevHref: string | null;
  nextHref: string | null;
  /** Null si la visita o el lugar están cerrados. */
  editHref: string | null;
  backHref: string;
  siteName: string;
}

/**
 * La vista de una visita (Fase 18, layout del prototipo): KPIs, puntos de
 * control con su historial, barras por punto y el registro de nivelación en
 * un panel lateral. Solo lectura: se edita en `/editar`.
 */
export function VisitView(props: VisitViewProps) {
  const { rows, summary, thresholds } = props;
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isClosing, startClose] = useTransition();

  const byId = new Map(rows.map((r) => [r.pointId, r]));
  const code = (id: string | undefined) => (id ? (byId.get(id)?.code ?? "—") : "—");
  const current = selected ? byId.get(selected) ?? null : null;
  const measured = rows.filter((r) => r.accumulated != null);
  const inAlert = measured.filter((r) => r.level != null && r.level !== "normal");
  const closure =
    props.captureMode === "book"
      ? formatBookClosure(props.closureErrorMm, props.toleranceMm, props.meetsTolerance)
      : null;

  function select(pointId: string) {
    setSelected((prev) => (prev === pointId ? null : pointId));
  }

  function confirmClose() {
    setCloseError(null);
    startClose(async () => {
      const r = await closeVisitAction(props.projectId, props.siteId, props.visitId);
      if (r.ok) {
        setCloseOpen(false);
        router.refresh();
      } else {
        setCloseError(r.error ?? "No se pudo cerrar la visita.");
      }
    });
  }

  const note = (() => {
    if (!current || current.accumulated == null) return null;
    const step = nextAccumulatedThreshold(current.accumulated, thresholds);
    if (step.kind === "beyondAlarm") {
      return `Este punto superó el umbral de alarma (−${step.thresholdMm} mm). Conviene aumentar la frecuencia de lectura y revisar los elementos estructurales cercanos.`;
    }
    return `Le faltan ${step.remainingMm.toFixed(1)} mm para el umbral de ${LEVEL_NAMES[step.level]} (−${step.thresholdMm} mm).`;
  })();

  return (
    <div className="flex flex-col gap-6">
      <Link href={props.backHref} className="w-fit text-sm text-neutral-600 hover:text-neutral-900">
        ← Volver a {props.siteName}
      </Link>

      <header className="flex flex-col gap-3 border-b-2 border-neutral-900 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {props.visitLabel}
            {props.isBaseline && <span className="text-neutral-500"> (lectura base)</span>}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {formatDateOnly(props.date)}.
            {props.amarre && ` Amarre en ${props.amarre.code}.`}
            {props.operator && ` Nivelación por ${props.operator}`}
            {props.equipment !== "—" && ` con ${props.equipment}`}
            {props.operator || props.equipment !== "—" ? "." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.prevHref ? (
            <Link href={props.prevHref} aria-label="Visita anterior" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              ←
            </Link>
          ) : (
            <Button variant="secondary" size="sm" disabled aria-label="Visita anterior">←</Button>
          )}
          {props.nextHref ? (
            <Link href={props.nextHref} aria-label="Visita siguiente" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              →
            </Link>
          ) : (
            <Button variant="secondary" size="sm" disabled aria-label="Visita siguiente">→</Button>
          )}
          {props.captureMode === "book" && props.book.length > 0 && (
            <Button size="sm" onClick={() => setBookOpen(true)}>
              Ver registro de nivelación
            </Button>
          )}
          {props.editHref && (
            <>
              <Link href={props.editHref} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Editar
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCloseError(null);
                  setCloseOpen(true);
                }}
              >
                Cerrar visita
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          label="Asentamiento máximo"
          value={summary.maxSettlement ? `${formatSignedMm(summary.maxSettlement.value)} mm` : "—"}
          hint={summary.maxSettlement ? code(summary.maxSettlement.pointId) : "Sin lecturas"}
        />
        <KpiCard
          label="Promedio"
          value={summary.mean != null ? `${formatSignedMm(summary.mean)} mm` : "—"}
          hint={
            props.isBaseline
              ? "Lectura base"
              : summary.mean != null && props.previousMean != null
                ? `${formatSignedMm(summary.mean - props.previousMean)} mm frente a la anterior`
                : undefined
          }
        />
        <KpiCard
          label="Mayor movimiento"
          value={!props.isBaseline && summary.maxMove ? `${formatSignedMm(summary.maxMove.value)} mm` : "—"}
          hint={!props.isBaseline && summary.maxMove ? `${code(summary.maxMove.pointId)} desde la visita anterior` : undefined}
        />
        <KpiCard
          label="Puntos en alerta"
          value={`${inAlert.length} de ${measured.length}`}
          hint={
            inAlert.length > 0
              ? inAlert.map((r) => r.code).join(", ")
              : "Ninguno en precaución o más"
          }
        />
        <KpiCard
          label="Cierre de nivelación"
          value={closure ? closure.value : props.closureErrorMm != null ? `${formatSignedMm(props.closureErrorMm)} mm` : "—"}
          hint={closure ? closure.detail : "Cotas directas: cierre tecleado"}
          className={closure?.status === "out" ? "border-warning-500" : undefined}
        />
        <KpiCard
          label="Estado"
          value={
            <span className="flex flex-wrap items-center gap-2 text-base">
              <StatusIndicator level={summary.worstAlert} label={ALERT_LEVEL_LABELS[summary.worstAlert]} />
              <Badge tone={STATUS_TONE[props.status]}>{VISIT_STATUS_LABELS[props.status]}</Badge>
            </span>
          }
          hint="Peor nivel de alerta y estado de la visita"
        />
      </div>

      {/* `minmax(0, …)`: sin él, la tarjeta crece al ancho de su tabla en vez
          de desplazarla, y la página entera desborda en un teléfono. */}
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] gap-6",
          current && "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]",
        )}
      >
        <Card title="Puntos de control" description="Selecciona un punto para ver su historial.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Punto</th>
                  <th className="py-2 pr-3 text-right font-medium">Cota base (m)</th>
                  <th className="py-2 pr-3 text-right font-medium">Cota actual (m)</th>
                  <th className="py-2 pr-3 text-right font-medium">Acumulado (mm)</th>
                  <th className="py-2 pr-3 text-right font-medium">Δ anterior (mm)</th>
                  <th className="py-2 pr-3 text-right font-medium">Velocidad (mm/mes)</th>
                  <th className="py-2 pr-3 font-medium">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const on = r.pointId === selected;
                  return (
                    <tr
                      key={r.pointId}
                      onClick={() => select(r.pointId)}
                      className={cn(
                        "cursor-pointer border-b border-neutral-100 align-top last:border-0 hover:bg-neutral-50",
                        on && "bg-primary-50 shadow-[inset_3px_0_0_var(--color-primary-500)]",
                      )}
                    >
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={(e) => {
                            e.stopPropagation();
                            select(r.pointId);
                          }}
                          className="whitespace-nowrap text-left font-medium text-primary-600 hover:underline"
                        >
                          {r.code}
                        </button>
                        {r.note && (
                          <div className="whitespace-nowrap text-xs text-neutral-500">{r.note}</div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {r.baselineElevation?.toFixed(4) ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {r.elevation?.toFixed(4) ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {formatSignedMm(r.accumulated)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {props.isBaseline ? "—" : formatSignedMm(r.partial)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {props.isBaseline || r.velocity == null ? "—" : r.velocity.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3">
                        {r.level ? (
                          <StatusIndicator level={r.level} label={ALERT_LEVEL_LABELS[r.level]} />
                        ) : (
                          <span className="text-neutral-500">Sin lectura</span>
                        )}
                        {r.trendWarning && (
                          <div className="mt-1 flex max-w-xs flex-col gap-1">
                            <Badge tone="warning" className="w-fit whitespace-nowrap">
                              ⚠ Lectura fuera de tendencia
                            </Badge>
                            <span className="text-xs text-neutral-600">{r.trendWarning}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {current && (
          <Card
            title={current.label}
            actions={
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)} aria-label="Cerrar el historial del punto">
                Cerrar
              </Button>
            }
          >
            <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div className="border-t-2 border-neutral-200 pt-1">
                <dt className="text-neutral-500">Acumulado</dt>
                <dd className="text-lg font-semibold">{formatSignedMm(current.accumulated)} mm</dd>
              </div>
              <div className="border-t-2 border-neutral-200 pt-1">
                <dt className="text-neutral-500">Velocidad</dt>
                <dd className="text-lg font-semibold">
                  {current.velocity == null || props.isBaseline ? "—" : `${current.velocity.toFixed(2)}`}
                  <span className="text-sm font-normal text-neutral-500"> mm/mes</span>
                </dd>
              </div>
              <div className="border-t-2 border-neutral-200 pt-1">
                <dt className="text-neutral-500">Desde la anterior</dt>
                <dd className="text-lg font-semibold">
                  {props.isBaseline ? "—" : `${formatSignedMm(current.partial)} mm`}
                </dd>
              </div>
            </dl>
            {current.history.length > 0 ? (
              <PointHistoryChart
                label={current.label}
                values={current.history}
                currentDate={props.date}
                seriesIndex={current.seriesIndex}
                thresholds={thresholds}
              />
            ) : (
              <p className="text-sm text-neutral-500">El punto no tiene lecturas hasta esta visita.</p>
            )}
            {note && <p className="mt-3 text-sm text-neutral-600">{note}</p>}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card title="Asentamiento acumulado por punto">
          <PointBarsChart
            bars={rows.map((r) => ({
              pointId: r.pointId,
              label: r.code,
              value: r.accumulated,
              level: r.level ?? undefined,
            }))}
            axisLabel="Asentamiento (mm)"
            ariaLabel="Asentamiento acumulado de cada punto de control en esta visita"
            thresholds={thresholds}
            selectedPointId={selected}
            onSelectPoint={select}
          />
        </Card>
        <Card title="Movimiento desde la visita anterior">
          {props.isBaseline ? (
            <p className="text-sm text-neutral-500">
              La lectura base no tiene visita anterior con la que comparar.
            </p>
          ) : (
            <PointBarsChart
              bars={rows.map((r) => ({ pointId: r.pointId, label: r.code, value: r.partial }))}
              axisLabel="Variación (mm)"
              ariaLabel="Variación de cada punto de control respecto a la visita anterior"
              selectedPointId={selected}
              onSelectPoint={select}
            />
          )}
        </Card>
      </div>

      <BookDrawer
        open={bookOpen}
        onClose={() => setBookOpen(false)}
        visitLabel={props.visitLabel}
        date={props.date}
        operator={props.operator}
        equipment={props.equipment}
        amarre={props.amarre}
        rows={props.book}
        closureErrorMm={props.closureErrorMm}
        toleranceMm={props.toleranceMm}
        meetsTolerance={props.meetsTolerance}
        selectedPointId={current?.pointId ?? null}
      />

      <CloseVisitDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={confirmClose}
        isPending={isClosing}
        error={closeError}
        visitDate={props.date}
        pointsMeasured={measured.length}
        worstAlert={summary.worstAlert}
        dirty={false}
        trendDeviationCodes={rows.filter((r) => r.trendWarning).map((r) => r.code)}
        book={
          props.captureMode === "book" && props.arithmeticCheckOk != null
            ? {
                closureErrorMm: props.closureErrorMm,
                toleranceMm: props.toleranceMm,
                meetsTolerance: props.meetsTolerance,
                arithmeticCheckOk: props.arithmeticCheckOk,
              }
            : null
        }
      />
    </div>
  );
}
