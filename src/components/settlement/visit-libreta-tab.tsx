"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/design-system";
import { LibretaTable } from "@/components/leveling/libreta-table";
import { formatReading, readingDecimals } from "@/components/leveling/libreta-rows";
import { useProcessDraft } from "@/components/process/use-process-draft";
import { saveVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  bookBenchmarkChecks,
  bookElevations,
  bookRowInputOf,
  computeBook,
  verifyingBenchmarks,
} from "@/lib/calculations/settlement-book";
import { benchmarkCheckMessage } from "@/lib/validators/settlement-book";
import { cn } from "@/lib/utils/cn";
import type { BenchmarkInput, BookRowPayload, PointInput, Thresholds, VisitInput } from "@/types/settlement";
import { PointBarsChart } from "./charts/point-bars-chart";
import { VisitArmadaDialog, type ArmadaStart } from "./visit-armada-dialog";
import type { VisitData } from "./visit-dialog-form";
import { pendingChangePoint, visitArmadaSpans } from "./visit-armadas";
import { armadaItems, pointMovements, resumeOf, tramoItems, visitSheetRows } from "./visit-libreta-rows";

interface VisitLibretaTabProps {
  projectId: string;
  siteId: string;
  visitId: string;
  visitNumber: number;
  /** La cabecera de la visita, que viaja con cada guardado. */
  visit: VisitData;
  updatedAt: string;
  book: BookRowPayload[];
  benchmarks: BenchmarkInput[];
  points: PointInput[];
  /** Las demás visitas del lugar, para el movimiento desde la anterior. */
  others: VisitInput[];
  thresholds: Thresholds;
}

type Dialog = { k: number; start: ArmadaStart; focusRow: number | null; opened: number };

/**
 * Paso 1 · Libreta de la visita (Fase 37, decisiones 7 a 11 y 20): a la
 * izquierda, la tabla de la nivelación; a la derecha, fijos, las armadas, la
 * verificación de cada tramo y el movimiento de cada punto desde la visita
 * anterior. Cada lectura se guarda al escribirla, desde el popup de la armada.
 */
export function VisitLibretaTab({
  projectId,
  siteId,
  visitId,
  visitNumber,
  visit,
  updatedAt,
  book,
  benchmarks,
  points,
  others,
  thresholds,
}: VisitLibretaTabProps) {
  const persist = useCallback(
    (rows: BookRowPayload[]) => saveVisitAction(projectId, { siteId, visitId, ...visit, book: rows }),
    [projectId, siteId, visitId, visit],
  );
  const { draft, save } = useProcessDraft(updatedAt, book, persist);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const view = useMemo(() => {
    const inputs = draft.map(bookRowInputOf);
    const computed = computeBook(inputs, benchmarks, visitId);
    const checks = bookBenchmarkChecks(computed, inputs, benchmarks, points, visitId);
    const { readings } = bookElevations(computed, inputs, points, visit.date);
    const candidate: VisitInput = {
      id: visitId,
      visitNumber,
      date: visit.date,
      readings: readings.map(({ pointId, elevation }) => ({ pointId, elevation })),
    };
    const history = computeHistory(points, [...others, candidate], thresholds);
    return {
      sheet: visitSheetRows(draft, computed, checks),
      items: armadaItems(draft, computed),
      tramos: tramoItems(computed),
      checks: checks.map((c) => ({
        ...c,
        message: benchmarkCheckMessage(
          c,
          computed.tramos.find((t) => t.start <= c.rowIndex && c.rowIndex <= t.end)?.startCode ?? "",
        ),
      })),
      movements: pointMovements(history.visits, visitId, points),
      resume: resumeOf(draft),
    };
  }, [draft, benchmarks, points, others, thresholds, visit.date, visitId, visitNumber]);

  const spans = visitArmadaSpans(draft);
  const empty = draft.length === 0;
  // Un punto auxiliar que esta visita guardó en los BM sigue siendo, en ella,
  // un punto de cambio.
  const changePoint = pendingChangePoint(draft, verifyingBenchmarks(benchmarks, visitId));

  function open(k: number, focusRow: number | null = null, start?: ArmadaStart) {
    setDialog({
      k,
      focusRow,
      opened: Date.now(),
      start: start ?? (changePoint ? { from: "pc", backCode: changePoint } : { from: "bm", backCode: benchmarks[0]?.code ?? "" }),
    });
  }

  if (empty && benchmarks.length === 0) {
    return (
      <Alert variant="info">
        Agrega un BM en la pestaña{" "}
        <Link href={`/projects/${projectId}/settlement/${siteId}?tab=bms`} className="font-medium underline">
          BMs
        </Link>{" "}
        para empezar: cada armada sale de un BM del lugar o de un punto de cambio.
      </Alert>
    );
  }

  const addButton = (
    <Button type="button" variant="secondary" size="sm" onClick={() => open(spans.length)}>
      + Armada
    </Button>
  );
  const decimals = readingDecimals(view.items.flatMap((a) => a.points.map((p) => p.reading)));
  const warnings = view.movements.filter((m) => m.warning);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col gap-4">
        {view.resume && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mira bg-mira-bg/40 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold">La medición quedó a medias</p>
              <p className="text-sm text-ink-2">{view.resume.text}</p>
            </div>
            <Button type="button" onClick={() => open(view.resume!.k, view.resume!.rowIndex)}>
              Retomar medición
            </Button>
          </div>
        )}

        <section className="rounded-lg border border-rule bg-card shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <h2 className="text-lg font-semibold">Libreta</h2>
            {!empty && addButton}
          </header>
          {empty ? (
            <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
              <p className="max-w-md text-sm text-ink-2">
                Cada armada es una posición del nivel: una vista atrás a un BM del lugar o a un punto de cambio, y las
                vistas a los puntos.
              </p>
              <Button type="button" onClick={() => open(0)}>
                + Agregar la primera armada
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden sm:block">
                <LibretaTable rows={view.sheet} onEdit={(k) => open(k)} />
              </div>
              <ul className="divide-y divide-rule sm:hidden">
                {view.items.map((a) => (
                  <li key={a.k}>
                    <button
                      type="button"
                      onClick={() => open(a.k)}
                      aria-label={`Editar la armada ${a.k + 1}`}
                      className="flex min-h-11 w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-sel"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{a.title}</span>
                        {a.pending && <Badge tone="neutral">a medias</Badge>}
                      </span>
                      <span className="text-xs text-ink-2">{a.detail}</span>
                      {a.points.map((p, i) => (
                        <span key={i} className="flex justify-between gap-3 text-xs tabular-nums">
                          <span>
                            <span className="font-medium">{p.code}</span>{" "}
                            <span className="text-ink-2">VI {formatReading(p.reading, decimals)}</span>
                          </span>
                          <span className="font-medium">{p.elevation?.toFixed(4) ?? "—"}</span>
                        </span>
                      ))}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="min-w-0">
        <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--barra-alto)+1rem)]">
          {/* En el teléfono, la libreta ya es la lista de armadas. */}
          {!empty && (
            <Card title="Armadas" actions={addButton} className="hidden sm:block">
              <ul className="flex flex-col divide-y divide-rule">
                {view.items.map((a) => (
                  <li key={a.k} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-ink-2">{a.detail}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => open(a.k)}>
                      {a.pending ? "Retomar" : "Editar"}
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {view.tramos.map((t, i) => (
            <Card key={i} title={t.title} description={t.route}>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-2">Cierre</dt>
                  <dd className="font-semibold tabular-nums">{t.closure ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-2">Orden alcanzado</dt>
                  <dd className={cn("font-semibold", !t.verified && "font-normal text-ink-2")}>{t.verdict}</dd>
                </div>
              </dl>
            </Card>
          ))}
          {view.checks.map((c) => (
            <Alert key={c.rowIndex} variant={c.meetsTolerance === false ? "warning" : "info"}>
              {c.message}
            </Alert>
          ))}
          {view.tramos.length > 0 && (
            <p className="text-xs text-ink-2">Las cotas son las de la medida: el cierre comprueba, no se reparte.</p>
          )}

          <Card title="Movimiento desde la visita anterior" description="Por punto, en mm.">
            {view.movements.some((m) => m.partialMm != null) ? (
              <div className="flex flex-col gap-3">
                <PointBarsChart
                  bars={view.movements.map((m) => ({ pointId: m.pointId, label: m.code, value: m.partialMm }))}
                  axisLabel="Movimiento (mm)"
                  ariaLabel="Movimiento de cada punto desde la visita anterior"
                  selectedPointId={warnings[0]?.pointId ?? null}
                />
                {warnings.map((m) => (
                  <Alert key={m.pointId} variant="warning">
                    {m.warning} Verifica la lectura.
                  </Alert>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-2">
                {view.movements.length === 0
                  ? "Todavía no hay puntos leídos en esta visita."
                  : "Es la primera lectura de sus puntos: no hay movimiento que comparar."}
              </p>
            )}
          </Card>
        </div>
      </div>

      {dialog && (
        <VisitArmadaDialog
          key={`${dialog.opened}:${dialog.k}`}
          siteId={siteId}
          visitId={visitId}
          visitNumber={visitNumber}
          rows={draft}
          k={dialog.k}
          start={dialog.start}
          focusRow={dialog.focusRow}
          benchmarks={benchmarks}
          points={points}
          onSave={save}
          onContinue={(start, k) => open(k, null, start)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
