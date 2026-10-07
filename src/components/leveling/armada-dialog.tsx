"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal, NumberInput } from "@/components/design-system";
import type { DraftSaveResult } from "@/components/process/use-process-draft";
import { parseNumber } from "@/lib/utils/parse";
import type { LevelingResult, RunType } from "@/types/leveling";
import { armadaAt, armadaSpans, nextArmadaIndex, removeLastArmada, writeArmada } from "./armadas";
import {
  armadaEnd,
  armadaFormOf,
  armadaProblem,
  readArmadaForm,
  wiresOf,
  type ArmadaForm,
  type VisualForm,
} from "./armada-form";
import { runRowsOf, type LevelingDraft } from "./leveling-save";

const RUN_NAME: Record<RunType, string> = { forward: "ida", return: "vuelta" };
const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

interface ArmadaDialogProps {
  draft: LevelingDraft;
  run: RunType;
  /** La armada: una existente, la que quedó a medias o la siguiente a la última. */
  k: number;
  /** El cálculo en vivo del borrador: las cotas sin compensar de cada fila. */
  result: LevelingResult;
  onSave: (next: LevelingDraft) => Promise<DraftSaveResult>;
  /** Tras guardar, sigue con otra armada (o con la vuelta). */
  onContinue: (run: RunType, k: number) => void;
  onClose: () => void;
}

/**
 * Una visual: lectura y distancia, y los hilos superior e inferior, opcionales.
 * La visita de asentamientos (Fase 37) la reutiliza con la distancia opcional.
 */
export function VisualFields({
  id,
  value,
  onChange,
  optionalDistance = false,
}: {
  id: string;
  value: VisualForm;
  onChange: (v: VisualForm) => void;
  optionalDistance?: boolean;
}) {
  const [showWires, setShowWires] = useState(value.upper !== "" || value.lower !== "");
  const wires = wiresOf(value);
  const set = (patch: Partial<VisualForm>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          id={`${id}-lectura`}
          label="Lectura"
          className="font-semibold"
          value={value.reading}
          onChange={(e) => set({ reading: e.target.value })}
        />
        {wires ? (
          <Input id={`${id}-distancia`} label="Distancia (m) · de los hilos" value={wires.distanceM.toFixed(1)} disabled />
        ) : (
          <NumberInput
            id={`${id}-distancia`}
            label={optionalDistance ? "Distancia (m) · opcional" : "Distancia (m)"}
            value={value.distance}
            onChange={(e) => set({ distance: e.target.value })}
          />
        )}
      </div>
      {showWires ? (
        <div className="flex flex-col gap-2 border-t border-dashed border-rule pt-3">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Hilo superior · opcional" value={value.upper} onChange={(e) => set({ upper: e.target.value })} />
            <NumberInput label="Hilo inferior · opcional" value={value.lower} onChange={(e) => set({ lower: e.target.value })} />
          </div>
          {wires ? (
            <p className="flex flex-wrap justify-between gap-x-3 text-xs">
              <span className="text-ink-2">Distancia = (superior − inferior) × 100</span>
              {wires.middle &&
                (wires.middle.ok ? (
                  <span className="text-success">
                    La lectura, a {wires.middle.deltaMm.toFixed(1)} mm del promedio de los hilos.
                  </span>
                ) : (
                  <span className="text-warning">
                    El hilo medio debería ser {wires.middle.expected.toFixed(4)} m, el promedio de los otros dos.
                  </span>
                ))}
            </p>
          ) : (
            <p className="text-xs text-ink-2">Con los dos hilos, la distancia sale de ellos.</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="min-h-9 self-start text-sm font-medium text-mira-ink underline-offset-2 hover:underline"
          onClick={() => setShowWires(true)}
        >
          + Hilos superior e inferior (opcional)
        </button>
      )}
    </>
  );
}

/**
 * El popup de una armada (Fase 36, captura A): la vista atrás al punto que ya
 * tiene cota, la vista adelante al siguiente, las vistas intermedias y, en la
 * última, la casilla de fin. Guarda la libreta completa al confirmar; si el
 * guardado falla, el error queda aquí y no se pierde lo tecleado.
 */
export function ArmadaDialog({ draft, run, k, result, onSave, onContinue, onClose }: ArmadaDialogProps) {
  const rows = runRowsOf(draft, run);
  const spans = armadaSpans(rows);
  const editing = k < spans.length;
  const span = spans[k];
  const isLast = k >= spans.length - 1;
  const end = armadaEnd(draft, run);
  const lastRow = rows.at(-1)!;
  const endsNow = editing && isLast && span?.closer === rows.length - 1 && lastRow.pointType === "bm";

  const [form, setForm] = useState<ArmadaForm>(() => armadaFormOf(editing ? armadaAt(rows, k) : null, endsNow));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openerIndex = span?.opener ?? rows.length - 1;
  const from = rows[openerIndex]!.pointCode;
  const computed = run === "forward" ? result.forward.readings : (result.return?.readings ?? []);
  // La cota del punto atrás; la vuelta que aún no empieza parte de donde llega la ida.
  const fromElevation = (() => {
    const c = computed[openerIndex]?.elevationCalculated;
    if (finite(c)) return c;
    if (run === "return" && openerIndex === 0) {
      if (draft.details.type === "closed") return draft.bm.startElevation;
      if (draft.details.type === "link") return draft.bm.endElevation;
      return result.forward.readings.at(-1)?.elevationCalculated ?? null;
    }
    return null;
  })();

  const to = form.ends && end.fixedCode != null ? end.fixedCode : form.forePoint.trim();
  const backReading = parseNumber(form.back.reading);
  const foreReading = parseNumber(form.fore.reading);
  const instrumentHeight = finite(fromElevation) && backReading != null ? fromElevation + backReading : null;
  const foreElevation = instrumentHeight != null && foreReading != null ? instrumentHeight - foreReading : null;
  const distanceOf = (v: VisualForm) => wiresOf(v)?.distanceM ?? parseNumber(v.distance);
  const backDistance = distanceOf(form.back);
  const foreDistance = distanceOf(form.fore);
  const continuesToReturn = form.ends && run === "forward" && draft.details.hasReturnRun;
  const canRemove = editing && k === spans.length - 1;

  function commit(next: LevelingDraft, after: { run: RunType; k: number } | null) {
    setError(null);
    startTransition(async () => {
      const response = await onSave(next);
      if (!response.ok) {
        setError(response.error ?? "No se pudo guardar la armada.");
        return;
      }
      if (after) onContinue(after.run, after.k);
      else onClose();
    });
  }

  function submit(intent: "continue" | "finish") {
    const read = readArmadaForm(form, end);
    if ("error" in read) return setError(read.error);
    const nextRows = writeArmada(rows, k, read.armada);
    const problem = armadaProblem(nextRows, k, draft.details.type);
    if (problem) return setError(problem);
    const next = { ...draft, [run]: nextRows };
    if (intent === "finish") return commit(next, null);
    if (continuesToReturn) return commit(next, { run: "return", k: nextArmadaIndex(runRowsOf(next, "return")) });
    commit(next, form.ends ? null : { run, k: k + 1 });
  }

  const set = (patch: Partial<ArmadaForm>) => setForm((f) => ({ ...f, ...patch }));
  const primaryLabel = continuesToReturn
    ? "Guardar y seguir con la vuelta"
    : form.ends
      ? "Guardar"
      : `Guardar y seguir desde ${to || "…"}`;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Armada ${k + 1} · ${RUN_NAME[run]}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {canRemove ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isPending}
              onClick={() => commit({ ...draft, [run]: removeLastArmada(rows) }, null)}
            >
              Quitar la armada
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {(!form.ends || continuesToReturn) && (
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => submit("finish")}>
                Guardar
              </Button>
            )}
            <Button type="button" disabled={isPending} onClick={() => submit("continue")}>
              {isPending ? "Guardando…" : primaryLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit("continue");
        }}
      >
        <p className="text-sm text-ink-2">
          El nivel entre <strong className="text-ink">{from}</strong>, ya con cota, y el punto siguiente.
        </p>
        {error && <Alert variant="error">{error}</Alert>}

        <fieldset className="flex flex-col gap-3 rounded-lg border border-rule px-4 py-3">
          <legend className="sr-only">Vista atrás</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Vista atrás · V+ a {from}</span>
            {finite(fromElevation) && <span className="text-xs text-ink-2 tabular-nums">cota {fromElevation.toFixed(4)}</span>}
          </div>
          <VisualFields id="atras" value={form.back} onChange={(back) => set({ back })} />
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-rule px-4 py-3">
          <legend className="sr-only">Vista adelante</legend>
          <span className="font-semibold">Vista adelante · V−</span>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_2fr]">
            {form.ends && end.fixedCode != null ? (
              <Input label="Punto" value={end.fixedCode} disabled />
            ) : (
              <Input
                label="Punto"
                className="font-semibold"
                value={form.forePoint}
                onChange={(e) => set({ forePoint: e.target.value })}
                autoFocus={!editing}
              />
            )}
            <p className="pb-2.5 text-xs text-ink-2">
              {form.ends ? "El fin del recorrido." : `Punto de cambio: abre la armada ${k + 2}.`}
            </p>
          </div>
          <VisualFields id="adelante" value={form.fore} onChange={(fore) => set({ fore })} />
        </fieldset>

        {form.intermediates.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Vistas intermedias</legend>
            {form.intermediates.map((m, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Input
                  label={`Punto ${i + 1}`}
                  value={m.pointCode}
                  onChange={(e) =>
                    set({ intermediates: form.intermediates.map((x, j) => (j === i ? { ...x, pointCode: e.target.value } : x)) })
                  }
                />
                <NumberInput
                  label="Lectura"
                  value={m.reading}
                  onChange={(e) =>
                    set({ intermediates: form.intermediates.map((x, j) => (j === i ? { ...x, reading: e.target.value } : x)) })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar la vista intermedia ${i + 1}`}
                  onClick={() => set({ intermediates: form.intermediates.filter((_, j) => j !== i) })}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </fieldset>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => set({ intermediates: [...form.intermediates, { pointCode: "", reading: "" }] })}
        >
          + Vista intermedia
        </Button>

        {isLast && (
          <label className="flex items-start gap-2.5 rounded-lg border border-rule px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5"
              checked={form.ends}
              onChange={(e) => set({ ends: e.target.checked })}
            />
            <span>
              <strong>{end.label}</strong>: {end.detail}
            </span>
          </label>
        )}

        <dl className="grid grid-cols-3 gap-3 rounded-lg bg-sel px-3 py-2.5">
          <div>
            <dt className="text-xs text-ink-2">Altura del instrumento</dt>
            <dd className="font-semibold tabular-nums">{instrumentHeight?.toFixed(4) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Cota de {to || "adelante"}</dt>
            <dd className="font-semibold tabular-nums">{foreElevation?.toFixed(4) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">Atrás · adelante</dt>
            <dd className="font-semibold tabular-nums">
              {backDistance?.toFixed(1) ?? "—"} · {foreDistance?.toFixed(1) ?? "—"} m
            </dd>
          </div>
        </dl>
      </form>
    </Modal>
  );
}
