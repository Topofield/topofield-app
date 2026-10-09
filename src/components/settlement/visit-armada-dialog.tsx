"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Alert, Badge, Button, Input, Modal, NumberInput, Select, Textarea } from "@/components/design-system";
import { VisualFields } from "@/components/leveling/armada-dialog";
import { readingWarnings } from "@/components/leveling/armada-form";
import { saveBenchmarkAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/benchmark-actions";
import type { ActionResult } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import { samePointCode } from "@/lib/calculations/leveling";
import {
  auxiliaryPoints,
  bookBenchmarkChecks,
  bookRowInputOf,
  computeBook,
  verifyingBenchmarks,
} from "@/lib/calculations/settlement-book";
import { callAction } from "@/lib/errors/action-call";
import { benchmarkCheckMessage } from "@/lib/validators/settlement-book";
import { cn } from "@/lib/utils/cn";
import type { BenchmarkInput, BookRowPayload } from "@/types/settlement";
import {
  composeArmada,
  readCount,
  readVisitArmadaForm,
  visitArmadaFormOf,
  type VisitArmadaForm,
} from "./visit-armada-form";
import {
  dropBookRow,
  finishVisitArmada,
  pendingChangePoint,
  removeLastVisitArmada,
  visitArmadaAt,
  visitArmadaSpans,
} from "./visit-armadas";
import { tramoItems } from "./visit-libreta-rows";

export interface ArmadaStart {
  from: "bm" | "pc";
  backCode: string;
}

type SaveResult = ActionResult | { ok: false; error: string };

interface VisitArmadaDialogProps {
  siteId: string;
  visitId: string;
  visitNumber: number;
  /** La libreta de la visita como está guardada (el borrador). */
  rows: BookRowPayload[];
  /** La armada: una existente o la siguiente a la última. */
  k: number;
  /** De dónde sale una armada nueva. */
  start: ArmadaStart;
  /** La fila de la libreta donde poner el cursor («Retomar medición»). */
  focusRow: number | null;
  benchmarks: BenchmarkInput[];
  /** Los puntos de control del lugar. */
  points: { code: string }[];
  onSave: (rows: BookRowPayload[]) => Promise<SaveResult>;
  /** Tras terminar, abre la armada siguiente: la `k` sale de la libreta recién guardada. */
  onContinue: (start: ArmadaStart, k: number) => void;
  onClose: () => void;
}

type Status = "idle" | "saving" | "saved" | "error";
type After = "close" | ArmadaStart;
type Finished = { after: After; rows: BookRowPayload[] };

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const fmt4 = (v: number | null | undefined) => (finite(v) ? v.toFixed(4) : "—");

/**
 * El popup de una armada de la visita (Fase 37, lienzo «Popup · armada B»):
 * «Desde» un BM del lugar o un punto de cambio, la V+, las vistas a los
 * puntos y la V− opcional. Cada lectura se guarda al salir del campo o con
 * Enter, en fila: el guardado siguiente espera al anterior, para que una
 * respuesta lenta nunca pise una lectura posterior. Un fallo deja el error
 * aquí, con lo tecleado, y se reintenta con la lectura siguiente.
 */
export function VisitArmadaDialog({
  siteId,
  visitId,
  visitNumber,
  rows,
  k,
  start,
  focusRow,
  benchmarks,
  points,
  onSave,
  onContinue,
  onClose,
}: VisitArmadaDialogProps) {
  const [isNew] = useState(() => k >= visitArmadaSpans(rows).length);
  // Los BM que esta visita no midió: un punto auxiliar que guardó en los BM
  // sigue siendo, en ella, un punto de cambio (revisión final de la Fase 37).
  const own = useMemo(() => verifyingBenchmarks(benchmarks, visitId), [benchmarks, visitId]);
  const [form, setForm] = useState<VisitArmadaForm>(() =>
    visitArmadaFormOf(isNew ? null : visitArmadaAt(rows, k), start),
  );
  const [savedForm, setSavedForm] = useState<VisitArmadaForm>(form);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ code: string; rows: number[]; sent: BookRowPayload[] } | null>(null);
  const [aux, setAux] = useState<{ code: string; elevation: number; rows: BookRowPayload[]; after: After } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const warnings = readingWarnings([
    ["Vista atrás", form.back.reading],
    ...form.points.map((p, i) => [p.pointCode.trim() || `Punto ${i + 1}`, p.reading] as const),
    ...(form.noFore ? [] : ([["Vista adelante", form.fore.reading]] as const)),
  ]);
  // «Desde» se elige antes de la primera lectura guardada; después es fijo.
  const [touched, setTouched] = useState(false);

  // Lo último de cada cosa, para los guardados encadenados.
  const formRef = useRef(form);
  const rowsRef = useRef(rows);
  useLayoutEffect(() => {
    formRef.current = form;
    rowsRef.current = rows;
  });
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Lo «ya guardado» es la libreta armada con el formulario sin tocar: así
  // abrir y cerrar una armada, o una nueva sin teclear nada, no guarda.
  const [initialKey] = useState(() => {
    const read = readVisitArmadaForm(form, verifyingBenchmarks(benchmarks, visitId));
    const composed = "armada" in read ? composeArmada(rows, k, read.armada) : null;
    return JSON.stringify(composed && "rows" in composed ? composed.rows : rows);
  });
  const lastSent = useRef<string | null>(initialKey);
  const lastOk = useRef(true);
  const inFlight = useRef(0);
  const desdeLocked = !isNew || touched;

  // --- El cálculo en vivo: la libreta con esta armada como va. ---------------
  const live = useMemo(() => {
    const read = readVisitArmadaForm(form, own);
    const composed = "armada" in read ? composeArmada(rows, k, read.armada) : null;
    const candidate = composed && "rows" in composed ? composed.rows : rows;
    const inputs = candidate.map(bookRowInputOf);
    const book = computeBook(inputs, benchmarks, visitId);
    const span = visitArmadaSpans(candidate)[k] ?? null;
    const tramo = span ? book.tramos.find((t) => t.start <= span.opener && span.opener <= t.end) : undefined;
    const closes = tramo && span?.closer === tramo.end && tramo.kind !== "open" ? tramoItems({ tramos: [tramo], readings: [] })[0] : null;
    const checks = span
      ? bookBenchmarkChecks(book, inputs, benchmarks, points, visitId).filter(
          (c) => c.rowIndex > span.opener && c.rowIndex <= (span.closer ?? span.intermediates.at(-1) ?? span.opener),
        )
      : [];
    // La fila de cada punto del formulario: los vacíos no están en la libreta.
    let j = 0;
    const pointRows = form.points.map((p) =>
      p.pointCode.trim() === "" && p.reading.trim() === "" ? null : (span?.intermediates[j++] ?? null),
    );
    return { book, span, tramo, closes, checks, pointRows };
  }, [form, rows, k, benchmarks, points, own, visitId]);

  const elevationAt = (i: number | null | undefined) =>
    i == null ? null : live.book.readings[i]?.elevationCalculated ?? null;
  const fromElevation = live.span ? elevationAt(live.span.opener) : null;
  const instrumentHeight =
    live.span && finite(fromElevation) && form.back.reading.trim() !== ""
      ? live.book.readings[live.span.opener]?.instrumentHeight
      : null;
  const foreCode = form.foreCode.trim();
  const foreBm = foreCode !== "" ? own.find((b) => samePointCode(b.code, foreCode)) : undefined;
  const foreIsPoint = foreCode !== "" && points.some((p) => samePointCode(p.code, foreCode));
  const hasFore = !form.noFore && foreCode !== "";
  const changePoint = isNew ? pendingChangePoint(rows, own) : null;
  const spans = visitArmadaSpans(rows);
  const canRemove = !isNew && k === spans.length - 1;
  const count = readCount(form.points);

  // --- El cursor al abrir. -----------------------------------------------------
  useEffect(() => {
    let id = "armada-atras-lectura";
    if (focusRow != null && !isNew) {
      const span = visitArmadaSpans(rows)[k];
      const j = span?.intermediates.indexOf(focusRow) ?? -1;
      if (j >= 0) id = `armada-punto-${j}`;
      else if (span?.closer === focusRow) id = "armada-adelante-lectura";
    }
    document.getElementById(id)?.focus();
    // Solo al abrir: después manda quien teclea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Guardar, en fila. ---------------------------------------------------------
  function enqueue(next: BookRowPayload[], snapshot: VisitArmadaForm, force = false): Promise<boolean> {
    const key = JSON.stringify(next);
    if (!force && key === lastSent.current) return queue.current.then(() => lastOk.current);
    lastSent.current = key;
    inFlight.current += 1;
    setTouched(true);
    setStatus("saving");
    const run = queue.current.then(async () => {
      const response = await onSave(next);
      inFlight.current -= 1;
      lastOk.current = response.ok;
      if (response.ok) {
        setSavedForm(snapshot);
        setError(null);
        setStatus(inFlight.current > 0 ? "saving" : "saved");
      } else {
        // Se reintenta con la lectura siguiente.
        lastSent.current = null;
        setStatus("error");
        setError(response.error ?? "No se pudo guardar la lectura.");
        if ("duplicate" in response && response.duplicate) setDuplicate({ ...response.duplicate, sent: next });
      }
      return response.ok;
    });
    queue.current = run;
    return run;
  }

  /** Arma la libreta con el formulario y la guarda; null si el formulario tiene un error. */
  function compose(f: VisitArmadaForm): BookRowPayload[] | null {
    const read = readVisitArmadaForm(f, own);
    if ("error" in read) {
      setError(read.error);
      return null;
    }
    const composed = composeArmada(rowsRef.current, k, read.armada);
    if ("error" in composed) {
      setError(composed.error);
      return null;
    }
    return composed.rows;
  }

  function commit(f: VisitArmadaForm = formRef.current): Promise<boolean> {
    const next = compose(f);
    return next ? enqueue(next, f) : Promise.resolve(false);
  }

  const set = (patch: Partial<VisitArmadaForm>) => setForm((f) => ({ ...f, ...patch }));

  /** Enter guarda y pasa al campo siguiente, como en la libreta de papel. */
  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (e.key !== "Enter" || target.tagName !== "INPUT" || (target as HTMLInputElement).type === "checkbox") return;
    e.preventDefault();
    void commit();
    const fields = [...e.currentTarget.querySelectorAll<HTMLInputElement>("input:not([disabled]):not([type=checkbox])")];
    fields[fields.indexOf(target as HTMLInputElement) + 1]?.focus();
  }

  // --- Terminar. -------------------------------------------------------------
  /** Sigue con la armada siguiente si la libreta ya la trae (la plantilla); si no, con una nueva. */
  function proceed({ after, rows: saved }: Finished) {
    if (after === "close") return onClose();
    const count = visitArmadaSpans(saved).length;
    onContinue(after, k + 1 < count ? k + 1 : count);
  }

  async function finish(after: After) {
    const composed = compose(formRef.current);
    if (!composed) return;
    setBusy(true);
    const finished = finishVisitArmada(composed, k);
    const ok = await enqueue(finished, formRef.current);
    setBusy(false);
    if (!ok) return;
    // Una V− a un punto auxiliar: ¿pasa a los BM del lugar? (decisión 11)
    const span = visitArmadaSpans(finished)[k];
    const found = auxiliaryPoints(finished, points, benchmarks).find((a) => a.rowIndex === span?.closer);
    const elevation = found
      ? computeBook(finished.map(bookRowInputOf), benchmarks, visitId).readings[found.rowIndex]?.elevationCalculated
      : null;
    if (found && finite(elevation)) {
      setAux({ code: found.code, elevation: Number(elevation.toFixed(4)), rows: finished, after });
      return;
    }
    proceed({ after, rows: finished });
  }

  /** Guarda y cierra; con un dato mal escrito se queda abierto con su error, para no perder lo tecleado. */
  async function later() {
    setBusy(true);
    const ok = await commit();
    setBusy(false);
    if (ok) onClose();
  }

  async function remove() {
    setBusy(true);
    const ok = await enqueue(removeLastVisitArmada(rowsRef.current), formRef.current, true);
    setBusy(false);
    if (ok) onClose();
  }

  const next: After = hasFore && !foreBm ? { from: "pc", backCode: foreCode } : { from: "bm", backCode: benchmarks[0]?.code ?? "" };
  const nextExists = k + 1 < spans.length;
  const continueLabel = nextExists
    ? `Terminar y seguir con la armada ${k + 2}`
    : hasFore && !foreBm
      ? `Terminar y seguir desde ${foreCode}`
      : "Terminar y agregar armada";
  const closesOnBm = hasFore && foreBm != null;
  const statusText =
    status === "saving" ? "guardando…" : status === "error" ? "sin guardar" : status === "saved" ? "guardado" : null;

  return (
    <Modal
      open
      onClose={() => void later()}
      size="lg"
      fullOnPhone
      title={`Armada ${k + 1} · visita ${visitNumber}`}
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex min-h-9 items-center justify-between gap-2">
            <p className="text-sm text-ink-2 tabular-nums" aria-live="polite">
              {count.total > 0 && (
                <>
                  Leídos <strong className="text-ink">{count.read} de {count.total}</strong>
                </>
              )}
              {statusText && <span>{count.total > 0 ? " · " : ""}{statusText}</span>}
            </p>
            {canRemove && (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()}>
                Quitar la armada
              </Button>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void later()}>
              Seguir después
            </Button>
            {closesOnBm ? (
              <>
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void finish(next)}>
                  {continueLabel}
                </Button>
                <Button type="button" size="sm" disabled={busy} onClick={() => void finish("close")}>
                  Terminar armada
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void finish("close")}>
                  Terminar armada
                </Button>
                <Button type="button" size="sm" disabled={busy} onClick={() => void finish(next)}>
                  {continueLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Salir de un campo guarda; pasar a un botón del pie también.
          if ((e.target as HTMLElement).tagName === "INPUT") void commit();
        }}
      >
        <p className="text-sm text-ink-2">
          Desde <strong className="text-ink">{form.backCode || "…"}</strong>. Cada lectura se guarda al escribirla.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        {warnings.length > 0 && (
          <Alert variant="warning">
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </Alert>
        )}

        {/* Vista atrás */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-rule px-4 py-3">
          <legend className="sr-only">Vista atrás</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Vista atrás · V+</span>
            {finite(fromElevation) && <span className="text-xs text-ink-2 tabular-nums">cota {fromElevation.toFixed(4)}</span>}
          </div>
          {desdeLocked ? (
            <p className="text-sm">
              {form.from === "bm" ? (
                <>
                  <strong>{form.backCode}</strong>
                  <span className="text-ink-2"> · BM del lugar</span>
                </>
              ) : (
                <>
                  <strong>{form.backCode}</strong>
                  <span className="text-ink-2"> · punto de cambio de la armada {k}</span>
                </>
              )}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div role="group" aria-label="Desde" className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong">
                {(
                  [
                    ["bm", "Un BM del lugar"],
                    ["pc", "Un punto de cambio"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.from === value}
                    disabled={value === "pc" && !changePoint}
                    onClick={() =>
                      set(
                        value === "pc"
                          ? { from: "pc", backCode: changePoint ?? "" }
                          : { from: "bm", backCode: benchmarks[0]?.code ?? "" },
                      )
                    }
                    className={cn(
                      "min-h-10 border-r border-rule px-2 text-sm font-medium last:border-r-0 disabled:text-ink-3",
                      form.from === value ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.from === "bm" ? (
                <Select
                  label="BM del lugar"
                  value={form.backCode}
                  onChange={(e) => set({ backCode: e.target.value })}
                  options={benchmarks.map((b) => ({ value: b.code, label: `${b.code} · ${b.elevation.toFixed(4)} m` }))}
                />
              ) : (
                <p className="text-sm">
                  <strong>{form.backCode}</strong>
                  <span className="text-ink-2"> · V− de la armada {k}</span>
                </p>
              )}
              {!changePoint && (
                <p className="text-xs text-ink-2">
                  {k === 0
                    ? "Es la primera armada: todavía no hay punto de cambio."
                    : "La armada anterior no terminó en un punto de cambio."}
                </p>
              )}
            </div>
          )}
          <VisualFields id="armada-atras" value={form.back} optionalDistance onChange={(back) => set({ back })} />
        </fieldset>

        {/* Vistas a los puntos */}
        <fieldset className="flex flex-col gap-2 rounded-lg border border-rule px-4 py-3">
          <legend className="sr-only">Vistas a los puntos</legend>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">Vistas a los puntos</span>
            <span className="text-xs text-ink-2">
              {count.total === 1 ? "1 punto" : `${count.total} puntos`} · VI
            </span>
          </div>
          {form.points.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_7rem_6.5rem_1.25rem] items-center gap-x-2 gap-y-1.5 text-sm">
              <span className="text-xs text-ink-2">Punto</span>
              <span className="text-xs text-ink-2">Lectura</span>
              <span className="text-right text-xs text-ink-2">Cota</span>
              <span />
              {form.points.map((p, j) => {
                const saved = savedForm.points[j];
                const isSaved =
                  p.reading.trim() !== "" && saved != null && saved.reading === p.reading && saved.pointCode === p.pointCode;
                const added = p.added === true;
                return (
                  <div key={j} className="contents">
                    {added ? (
                      <Input
                        aria-label={`Punto ${j + 1}`}
                        value={p.pointCode}
                        list="armada-puntos"
                        onChange={(e) =>
                          set({ points: form.points.map((x, i) => (i === j ? { ...x, pointCode: e.target.value } : x)) })
                        }
                      />
                    ) : (
                      <span className="truncate font-semibold">{p.pointCode}</span>
                    )}
                    <NumberInput
                      id={`armada-punto-${j}`}
                      aria-label={`Lectura a ${p.pointCode || `el punto ${j + 1}`}`}
                      value={p.reading}
                      onChange={(e) =>
                        set({ points: form.points.map((x, i) => (i === j ? { ...x, reading: e.target.value } : x)) })
                      }
                    />
                    <span className="text-right tabular-nums">
                      {p.reading.trim() !== "" ? fmt4(elevationAt(live.pointRows[j])) : "—"}
                    </span>
                    <span className="text-success" aria-label={isSaved ? "guardada" : undefined}>
                      {isSaved ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <datalist id="armada-puntos">
            {points.map((p) => (
              <option key={p.code} value={p.code} />
            ))}
          </datalist>
          {live.checks.map((c) => (
            <p key={c.rowIndex} className={cn("text-xs", c.meetsTolerance === false ? "text-warning" : "text-ink-2")}>
              Leído de paso: {benchmarkCheckMessage(c, live.tramo?.startCode ?? form.backCode)}
            </p>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => set({ points: [...form.points, { pointCode: "", reading: "", added: true }] })}
          >
            + Otro punto
          </Button>
        </fieldset>

        {/* Vista adelante */}
        <fieldset className="flex flex-col gap-3 rounded-lg border border-rule px-4 py-3">
          <legend className="sr-only">Vista adelante</legend>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Vista adelante · V−</span>
            {hasFore && <Badge tone="primary">{foreBm ? "cierra en un BM" : "punto de cambio"}</Badge>}
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5"
              checked={form.noFore}
              onChange={(e) => {
                const nextForm = { ...formRef.current, noFore: e.target.checked };
                setForm(nextForm);
                void commit(nextForm);
              }}
            />
            <span>
              <strong>Sin vista adelante</strong>: la armada termina en los puntos.
            </span>
          </label>
          {!form.noFore && (
            <>
              <Input
                label="Punto"
                className="font-semibold"
                value={form.foreCode}
                list="armada-bms"
                onChange={(e) => set({ foreCode: e.target.value })}
              />
              <datalist id="armada-bms">
                {benchmarks.map((b) => (
                  <option key={b.code} value={b.code} />
                ))}
              </datalist>
              <VisualFields id="armada-adelante" value={form.fore} optionalDistance onChange={(fore) => set({ fore })} />
              <p className="text-xs text-ink-2">
                {foreBm ? (
                  <>
                    {foreBm.code} está en los BM del lugar ({foreBm.elevation.toFixed(4)}): el tramo que salió de{" "}
                    {live.tramo?.startCode ?? form.backCode}{" "}
                    {samePointCode(foreBm.code, live.tramo?.startCode ?? "") ? "cierra en él" : "llega a él"} y se verifica.
                  </>
                ) : foreIsPoint ? (
                  <>
                    {foreCode} es un punto de control: su cota sale de esta V−. La siguiente armada puede seguir desde él.
                  </>
                ) : foreCode !== "" ? (
                  <>
                    {foreCode} no es un BM del lugar ni un punto de control: es un <strong>punto auxiliar</strong>. La
                    siguiente armada puede seguir desde él.
                  </>
                ) : (
                  <>
                    Con vista adelante a un BM del lugar, el tramo se verifica. A un punto auxiliar, la siguiente armada
                    sigue desde allí, y al terminar se pregunta si pasa a los BM del lugar.
                  </>
                )}
              </p>
            </>
          )}
        </fieldset>

        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-sel px-3 py-2.5 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-2">Altura del instrumento</dt>
            <dd className="font-semibold tabular-nums">{fmt4(instrumentHeight)}</dd>
          </div>
          {hasFore && (
            <div>
              <dt className="text-xs text-ink-2">Cota {foreBm ? "medida" : ""} de {foreCode}</dt>
              <dd className="font-semibold tabular-nums">
                {form.fore.reading.trim() !== "" ? fmt4(elevationAt(live.span?.closer)) : "—"}
              </dd>
            </div>
          )}
          {live.closes && (
            <>
              <div>
                <dt className="text-xs text-ink-2">{live.tramo?.kind === "closed" ? "Cierre" : "Llegada"}</dt>
                <dd className="font-semibold tabular-nums">{live.closes.closure ?? "—"}</dd>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink-2">Orden alcanzado</dt>
                <dd className="font-semibold">{live.closes.verdict}</dd>
              </div>
            </>
          )}
        </dl>
        {live.closes && (
          <p className="text-xs text-ink-2">Las cotas son las de la medida: el cierre comprueba, no se reparte.</p>
        )}
      </form>

      {duplicate && (
        <DuplicateDialog
          duplicate={duplicate}
          benchmarks={benchmarks}
          visitId={visitId}
          onBack={() => setDuplicate(null)}
          onDrop={(other) => {
            const dropped = dropBookRow(duplicate.sent, other);
            if ("error" in dropped) {
              setError(dropped.error);
              setDuplicate(null);
              return;
            }
            // Si la lectura que se va es de esta armada, sale también del formulario.
            const span = visitArmadaSpans(duplicate.sent)[k];
            const j = span?.intermediates.indexOf(other) ?? -1;
            let nextForm = formRef.current;
            if (j >= 0) {
              let seen = -1;
              const at = nextForm.points.findIndex((p) =>
                p.pointCode.trim() === "" && p.reading.trim() === "" ? false : ++seen === j,
              );
              nextForm = { ...nextForm, points: nextForm.points.filter((_, i) => i !== at) };
              setForm(nextForm);
            }
            setDuplicate(null);
            void enqueue(dropped.rows, nextForm);
          }}
        />
      )}

      {aux && (
        <AuxiliaryDialog
          siteId={siteId}
          visitId={visitId}
          visitNumber={visitNumber}
          k={k}
          aux={aux}
          onSkip={() => {
            setAux(null);
            proceed(aux);
          }}
          onSaved={async () => {
            // La visita se recalcula con el BM nuevo: su V− ya llega a un BM del lugar.
            await enqueue(aux.rows, formRef.current, true);
            setAux(null);
            proceed(aux);
          }}
        />
      )}
    </Modal>
  );
}

/** «TA-04 está en dos armadas» (decisión 10): se elige la lectura que se queda. */
function DuplicateDialog({
  duplicate,
  benchmarks,
  visitId,
  onBack,
  onDrop,
}: {
  duplicate: { code: string; rows: number[]; sent: BookRowPayload[] };
  benchmarks: BenchmarkInput[];
  visitId: string;
  onBack: () => void;
  onDrop: (row: number) => void;
}) {
  const [a, b] = duplicate.rows as [number, number];
  const [keep, setKeep] = useState(a);
  const other = keep === a ? b : a;
  const book = useMemo(
    () => computeBook(duplicate.sent.map(bookRowInputOf), benchmarks, visitId),
    [duplicate.sent, benchmarks, visitId],
  );
  const spans = visitArmadaSpans(duplicate.sent);
  const armadaOf = (i: number) => spans.findIndex((s) => s.intermediates.includes(i) || s.closer === i);
  const describe = (i: number) => {
    const k = armadaOf(i);
    const row = duplicate.sent[i]!;
    return {
      armada: k,
      label: `Armada ${k + 1} · desde ${duplicate.sent[spans[k]?.opener ?? 0]!.pointCode.trim()}`,
      reading: `${row.pointType === "intermediate" ? "VI" : "V−"} ${row.foresight?.toFixed(4) ?? "—"}`,
      elevation: book.readings[i]?.elevationCalculated ?? null,
    };
  };
  const ea = describe(a);
  const eb = describe(b);
  const diff =
    finite(ea.elevation) && finite(eb.elevation) ? Math.abs(ea.elevation - eb.elevation) * 1000 : null;
  const canDrop = duplicate.sent[other]?.pointType === "intermediate";

  return (
    <Modal
      open
      onClose={onBack}
      title={`${duplicate.code} está en dos armadas`}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onBack}>
            Volver a la libreta
          </Button>
          <Button type="button" variant="danger" disabled={!canDrop} onClick={() => onDrop(other)}>
            Eliminar la de la armada {armadaOf(other) + 1}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-ink-2">
          Una visita da una cota por punto. Elige la lectura que se queda; la otra se elimina de la libreta.
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium text-ink-2">Se queda</legend>
          {[
            [a, ea],
            [b, eb],
          ].map(([i, e]) => {
            const row = i as number;
            const d = e as ReturnType<typeof describe>;
            return (
              <label key={row} className="flex items-center gap-3 rounded-md border border-rule px-3 py-2.5">
                <input type="radio" name="se-queda" className="size-4" checked={keep === row} onChange={() => setKeep(row)} />
                <span className="flex-1">{d.label}</span>
                <span className="tabular-nums text-ink-2">{d.reading}</span>
                <span className="font-semibold tabular-nums">{fmt4(d.elevation)} m</span>
              </label>
            );
          })}
        </fieldset>
        {diff != null && <p className="text-ink-2">Las dos difieren en {diff.toFixed(1)} mm.</p>}
        {!canDrop && (
          <p className="text-warning">
            Esa lectura es la V− de un punto de cambio: la cadena de armadas la necesita. Elimina la otra.
          </p>
        )}
      </div>
    </Modal>
  );
}

/** «¿Guardar CP-1 en los BM del lugar?» (decisión 11). */
function AuxiliaryDialog({
  siteId,
  visitId,
  visitNumber,
  k,
  aux,
  onSkip,
  onSaved,
}: {
  siteId: string;
  visitId: string;
  visitNumber: number;
  k: number;
  aux: { code: string; elevation: number };
  onSkip: () => void;
  onSaved: () => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await callAction(() =>
      saveBenchmarkAction(siteId, {
        code: aux.code,
        elevation: aux.elevation,
        description: description.trim() === "" ? null : description.trim(),
        // La visita que lo midió no se verifica contra él.
        originVisitId: visitId,
        source: `Punto auxiliar de la visita ${visitNumber}`,
      }),
    );
    if (!r.ok) {
      setBusy(false);
      setError(r.error ?? "No se pudo guardar el BM.");
      return;
    }
    await onSaved();
  }

  return (
    <Modal
      open
      onClose={onSkip}
      title={`¿Guardar ${aux.code} en los BM del lugar?`}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onSkip}>
            Solo en esta visita
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Guardando…" : "Guardar en los BM"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          La armada {k + 1} terminó con una V− en {aux.code}, un punto auxiliar. Si lo guardas, las próximas visitas
          pueden armarse desde él.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Código" value={aux.code} disabled />
          <Input label="Cota medida hoy (m)" value={aux.elevation.toFixed(4)} disabled />
        </div>
        <Textarea
          label="Descripción · opcional"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
