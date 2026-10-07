"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Card, Input, Modal, NumberInput, Select } from "@/components/design-system";
import {
  benchmarkImpactAction,
  deleteBenchmarkAction,
  importBenchmarksAction,
  saveBenchmarkAction,
} from "@/app/(app)/projects/[id]/settlement/[siteId]/benchmark-actions";
import { callAction } from "@/lib/errors/action-call";
import { benchmarksFromLeveling, parseBenchmarkCsv, type ImportedBenchmark } from "@/lib/import/benchmarks";
import { cn } from "@/lib/utils/cn";
import { formatElevation } from "@/lib/utils/format";
import { parseNumber } from "@/lib/utils/parse";

export interface BenchmarkRow {
  id: string;
  code: string;
  elevation: number;
  description: string | null;
  source: string | null;
  /** Visitas que arrancan un tramo en él. */
  amarres: number;
}

/** Una nivelación calculada del proyecto, con sus cotas ajustadas, para importar. */
export interface LevelingOption {
  id: string;
  label: string;
  source: string;
  points: { pointCode: string; elevation: number }[];
}

type Editing = { mode: "create" } | { mode: "edit"; row: BenchmarkRow };

/**
 * La pestaña BMs del lugar (Fase 37, decisiones 12 y 13, lienzo «BMs del
 * lugar»): los BM desde donde se arman las visitas. Se agregan, se editan, se
 * eliminan si nadie los usa y se importan de una nivelación del proyecto o de
 * un CSV. Son copias: no se sincronizan con nada.
 */
export function BenchmarksPanel({
  siteId,
  benchmarks,
  levelings,
}: {
  siteId: string;
  benchmarks: BenchmarkRow[];
  levelings: LevelingOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<BenchmarkRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(row: BenchmarkRow) {
    setError(null);
    startTransition(async () => {
      const r = await callAction(() => deleteBenchmarkAction(siteId, row.id));
      if (r.ok) {
        setDeleting(null);
        router.refresh();
      } else setError(r.error ?? "No se pudo eliminar el BM.");
    });
  }

  return (
    <Card
      title="BM del lugar"
      description="Los puntos de cota conocida desde donde se arman las visitas. Son de este lugar: no se sincronizan con nada."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
            Importar BM
          </Button>
          <Button size="sm" onClick={() => setEditing({ mode: "create" })}>
            + BM
          </Button>
        </div>
      }
    >
      {error && <Alert variant="error" className="mb-3">{error}</Alert>}
      {benchmarks.length === 0 ? (
        <p className="text-sm text-ink-2">
          Este lugar todavía no tiene BM. Agrega uno o impórtalo: las visitas se arman desde ellos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-2">
                <th className="py-2 pr-3 font-medium">Código</th>
                <th className="py-2 pr-3 text-right font-medium">Cota (m)</th>
                <th className="py-2 pr-3 font-medium">Descripción</th>
                <th className="py-2 pr-3 font-medium">Origen</th>
                <th className="py-2 pr-3 font-medium">Visitas</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.id} className="border-b border-rule last:border-0">
                  <td className="py-2 pr-3 font-medium">{b.code}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatElevation(b.elevation)}</td>
                  <td className="py-2 pr-3 text-ink-2">{b.description ?? "—"}</td>
                  <td className="py-2 pr-3 text-ink-2">{b.source ?? "—"}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-ink-2">
                    {b.amarres > 0 ? `Amarre en ${b.amarres}` : "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ mode: "edit", row: b })}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(b)} disabled={isPending}>
                      Eliminar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm text-ink-2">
        Cambiar la cota de un BM recalcula las visitas que lo usan; la app avisa cuántas antes de guardar. Un BM que
        usa alguna visita no se elimina.
      </p>

      {editing && (
        <BenchmarkDialog
          siteId={siteId}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {importing && (
        <ImportBenchmarksDialog
          siteId={siteId}
          levelings={levelings}
          onClose={() => setImporting(false)}
          onSaved={() => {
            setImporting(false);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <Modal
          open
          onClose={() => setDeleting(null)}
          title="Eliminar BM"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => remove(deleting)} disabled={isPending}>
                {isPending ? "Eliminando…" : "Eliminar"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">Se eliminará {deleting.code} de los BM del lugar.</p>
        </Modal>
      )}
    </Card>
  );
}

function BenchmarkDialog({
  siteId,
  editing,
  onClose,
  onSaved,
}: {
  siteId: string;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const row = editing.mode === "edit" ? editing.row : null;
  const [code, setCode] = useState(row?.code ?? "");
  const [elevation, setElevation] = useState(row ? row.elevation.toFixed(4) : "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [notice, setNotice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const value = parseNumber(elevation);
    if (code.trim() === "") return setError("El BM necesita un código.");
    if (value == null) return setError("La cota del BM debe ser un número.");
    const changes = row != null && (row.elevation !== value || row.code.trim() !== code.trim());
    startTransition(async () => {
      // Cambiar la cota o el código de un BM recalcula las visitas que lo usan
      // (decisión 13): se avisa cuántas antes de guardar.
      if (row && changes && notice === null) {
        const { visits } = await benchmarkImpactAction(siteId, row.id);
        if (visits > 0) {
          setNotice(visits);
          return;
        }
      }
      const r = await callAction(() =>
        saveBenchmarkAction(siteId, {
          id: row?.id,
          code,
          elevation: value,
          description: description.trim() === "" ? null : description.trim(),
        }),
      );
      if (r.ok) onSaved();
      else setError(r.error ?? "No se pudo guardar el BM.");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? `Editar ${row.code}` : "Nuevo BM"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Guardando…" : notice !== null ? "Guardar y recalcular" : "Guardar"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} />
          <NumberInput label="Cota (m)" value={elevation} onChange={(e) => setElevation(e.target.value)} />
        </div>
        <Input label="Descripción · opcional" value={description} onChange={(e) => setDescription(e.target.value)} />
        {notice !== null && (
          <Alert variant="warning">
            {row?.code} se usa en {notice} {notice === 1 ? "visita" : "visitas"}: al guardar se recalculan sus cotas.
          </Alert>
        )}
      </form>
    </Modal>
  );
}

function ImportBenchmarksDialog({
  siteId,
  levelings,
  onClose,
  onSaved,
}: {
  siteId: string;
  levelings: LevelingOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [from, setFrom] = useState<"leveling" | "csv">(levelings.length > 0 ? "leveling" : "csv");
  const [levelingId, setLevelingId] = useState(levelings[0]?.id ?? "");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [csv, setCsv] = useState<{ name: string; items: ImportedBenchmark[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const leveling = levelings.find((l) => l.id === levelingId) ?? null;

  const chosen: ImportedBenchmark[] =
    from === "leveling"
      ? leveling
        ? benchmarksFromLeveling(
            leveling.points.filter((p) => checked.has(p.pointCode)),
            leveling.source,
          )
        : []
      : (csv?.items ?? []);

  async function readFile(file: File) {
    setError(null);
    const read = parseBenchmarkCsv(await file.text());
    if ("error" in read) {
      setCsv(null);
      setError(read.error);
      return;
    }
    setCsv({ name: file.name, items: read.items.map((i) => ({ ...i, source: `CSV ${file.name}` })) });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await callAction(() => importBenchmarksAction(siteId, chosen));
      if (r.ok) onSaved();
      else setError(r.error ?? "No se pudieron importar los BM.");
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar BM"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending || chosen.length === 0}>
            {isPending ? "Importando…" : `Importar ${chosen.length} BM`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div role="group" aria-label="De dónde" className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong">
          {(
            [
              ["leveling", "De una nivelación del proyecto"],
              ["csv", "De un CSV"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={from === id}
              onClick={() => setFrom(id)}
              className={cn(
                "min-h-11 px-3 text-sm font-medium",
                from === id ? "bg-mira-bg text-mira-strong" : "text-ink-2 hover:bg-sel",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {from === "leveling" ? (
          levelings.length === 0 ? (
            <p className="text-sm text-ink-2">El proyecto no tiene nivelaciones calculadas con cotas ajustadas.</p>
          ) : (
            <>
              <Select
                label="Nivelación"
                value={levelingId}
                onChange={(e) => {
                  setLevelingId(e.target.value);
                  setChecked(new Set());
                }}
                options={levelings.map((l) => ({ value: l.id, label: l.label }))}
              />
              <fieldset className="overflow-hidden rounded-md border border-rule">
                <legend className="sr-only">Puntos de la nivelación</legend>
                {leveling?.points.map((p) => (
                  <label
                    key={p.pointCode}
                    className={cn(
                      "flex min-h-11 items-center gap-3 border-b border-rule px-3 text-sm last:border-0",
                      checked.has(p.pointCode) && "bg-mira-bg",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={checked.has(p.pointCode)}
                      onChange={(e) => {
                        const next = new Set(checked);
                        if (e.target.checked) next.add(p.pointCode);
                        else next.delete(p.pointCode);
                        setChecked(next);
                      }}
                    />
                    <span className="flex-1 font-medium">{p.pointCode}</span>
                    <span className="font-mono tabular-nums">{formatElevation(p.elevation)}</span>
                  </label>
                ))}
              </fieldset>
              <p className="text-sm text-ink-2">
                Se copian al lugar con su cota ajustada de hoy. Si la nivelación cambia después, estos BM no: se editan
                aquí.
              </p>
            </>
          )
        ) : (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Archivo CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                }}
                className="text-sm font-normal"
              />
            </label>
            <p className="text-sm text-ink-2">
              Una fila por BM con <code>codigo,cota,descripcion</code> (la descripción es opcional). Con punto y coma, la
              cota admite coma decimal.
            </p>
            {csv && (
              <p className="text-sm">
                {csv.items.length} BM en {csv.name}: {csv.items.map((i) => i.code).join(", ")}.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
