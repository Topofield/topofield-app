"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { RunPreview, TemplateLink } from "@/components/leveling/import-dialog";
import { saveVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import { samePointCode } from "@/lib/calculations/leveling";
import { callAction } from "@/lib/errors/action-call";
import { FORMAT_LABELS, decodeFileBytes, readLevelingFile, toLibreta, type ReadResult } from "@/lib/import/leveling";
import type { PointType } from "@/types/leveling";
import type { VisitData } from "./visit-dialog-form";
import { bookFromLibreta } from "./visit-armadas";

interface VisitImportButtonProps {
  projectId: string;
  siteId: string;
  visitId: string;
  /** La cabecera de la visita, que viaja con el guardado. */
  visit: VisitData;
  benchmarkCodes: string[];
  /** Los puntos de control del lugar, para marcarlos en la vista previa. */
  pointCodes: string[];
  /** La visita ya tiene lecturas o cotas tecleadas: se reemplazan, y se avisa. */
  hasReadings: boolean;
}

/**
 * «Importar .L o CSV» en la barra de pasos de la visita (Fase 37, decisiones 5
 * y 6). Lee el `.L` de un nivel digital Leica o la plantilla CSV de la
 * nivelación como un tramo desde el BM de su primera fila, que debe estar en
 * los BM del lugar. Se guardan las lecturas: la cota la da la medida, no el
 * archivo.
 */
export function VisitImportButton({
  projectId,
  siteId,
  visitId,
  visit,
  benchmarkCodes,
  pointCodes,
  hasReadings,
}: VisitImportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [read, setRead] = useState<ReadResult | null>(null);
  const [overrides, setOverrides] = useState<Record<number, PointType>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const file = read?.ok ? read.file : null;
  const rows = useMemo(() => {
    if (!file) return null;
    return toLibreta(file, { kind: "single" }).forward.map((r, i) => ({ ...r, pointType: overrides[i] ?? r.pointType }));
  }, [file, overrides]);

  const startCode = rows?.[0]?.pointCode.trim() ?? "";
  const startIsBenchmark = benchmarkCodes.some((c) => samePointCode(c, startCode));
  const notes = rows?.map((r, i) =>
    i === 0
      ? startIsBenchmark
        ? "BM del lugar"
        : null
      : pointCodes.some((c) => samePointCode(c, r.pointCode))
        ? "Punto de control"
        : benchmarkCodes.some((c) => samePointCode(c, r.pointCode))
          ? "BM del lugar"
          : null,
  );

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setRead(readLevelingFile(decodeFileBytes(await f.arrayBuffer())));
    setOverrides({});
    setError(null);
  }

  async function accept() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    const r = await callAction(() =>
      saveVisitAction(projectId, { siteId, visitId, ...visit, book: bookFromLibreta(rows) }),
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo guardar la libreta importada.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setRead(null);
          setFileName(null);
          setError(null);
          setOpen(true);
        }}
      >
        Importar .L o CSV
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Importar la libreta de la visita"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void accept()} disabled={!rows || !startIsBenchmark || busy}>
              {busy ? "Guardando…" : "Usar estas lecturas"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            Se leen el archivo <strong>.L de un nivel digital Leica</strong> y la <strong>plantilla CSV</strong> de
            TopoField, como un tramo desde el BM de su primera fila. Se guardan las lecturas; la cota de cada punto sale
            de la medida.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-ink">
              <span className="sr-only">Archivo</span>
              <input
                type="file"
                onChange={onFile}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-rule-strong file:bg-card file:px-3 file:py-1.5 file:text-sm"
              />
            </label>
            <TemplateLink />
          </div>

          {read && !read.ok && (
            <Alert variant="error">
              {fileName ? `${fileName}: ` : ""}
              {read.error} Si su instrumento no es uno de esos, pase las lecturas a la plantilla CSV.
            </Alert>
          )}
          {error && <Alert variant="error">{error}</Alert>}

          {file && rows && (
            <div className="flex flex-col gap-4">
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-ink-2">Formato</dt>
                <dd>{FORMAT_LABELS[file.format]}</dd>
                <dt className="text-ink-2">Armadas · visuales leídas</dt>
                <dd className="font-mono tabular-nums">
                  {file.setups.length} · {file.rawSights}
                </dd>
                <dt className="text-ink-2">Sale de</dt>
                <dd>{startCode || "—"}</dd>
              </dl>
              {!startIsBenchmark && (
                <Alert variant="error">
                  El archivo arranca en {startCode || "un punto sin código"}, que no está en los BM del lugar: agrégalo en
                  la pestaña BMs antes de importar.
                </Alert>
              )}
              {hasReadings && (
                <Alert variant="warning">
                  La visita ya tiene lecturas o cotas: se reemplazarán por las del archivo.
                </Alert>
              )}
              {file.warnings.map((w) => (
                <Alert key={w} variant="warning">
                  {w}
                </Alert>
              ))}
              <p className="text-sm text-ink-2">
                Revisa el tipo de cada punto antes de aceptar: los puntos de control suelen ser vistas intermedias.
              </p>
              <RunPreview
                title="Libreta"
                rows={rows}
                notes={notes}
                onType={(i, t) => setOverrides({ ...overrides, [i]: t })}
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
