"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Alert, Button, Modal, Select } from "@/components/design-system";
import { RunPreview, TemplateLink } from "@/components/leveling/import-dialog";
import { samePointCode } from "@/lib/calculations/leveling";
import {
  FORMAT_LABELS,
  decodeFileBytes,
  readLevelingFile,
  toLibreta,
  type LibretaRow,
  type ReadResult,
} from "@/lib/import/leveling";
import type { PointType } from "@/types/leveling";

/** Lo que la importación entrega al editor de la visita. */
export interface VisitImport {
  rows: LibretaRow[];
  /** El amarre que queda en la visita: el de la visita, o el del archivo. */
  amarre: { code: string; elevation: number | null };
}

interface VisitImportDialogProps {
  /** Códigos del catálogo del lugar, para marcar los puntos de control. */
  pointCodes: string[];
  /** El amarre actual de la visita (vacío si aún no tiene). */
  amarre: { code: string; elevation: number | null };
  /** La visita ya tiene libreta: se reemplaza, y se avisa. */
  hasRows: boolean;
  onAccept: (result: VisitImport) => void;
  disabled?: boolean;
  /** Abierto al montar: la visita se creó eligiendo «importar un archivo». */
  defaultOpen?: boolean;
}

/**
 * Importa la libreta de la visita desde el archivo de un nivel digital o la
 * plantilla CSV (Fase 18, decisión 18). Reutiliza los lectores y la
 * previsualización de la Fase 16, con dos diferencias: la libreta de la
 * visita es siempre UN recorrido —el circuito cerrado sobre el amarre, sin
 * ida y vuelta— y no hay tipo de proceso que proponer. Nada se guarda aquí.
 */
export function VisitImportDialog({
  pointCodes,
  amarre,
  hasRows,
  onAccept,
  disabled,
  defaultOpen = false,
}: VisitImportDialogProps) {
  const [open, setOpen] = useState(defaultOpen && !disabled);
  const [fileName, setFileName] = useState<string | null>(null);
  const [read, setRead] = useState<ReadResult | null>(null);
  const [useFileElevation, setUseFileElevation] = useState(true);
  const [overrides, setOverrides] = useState<Record<number, PointType>>({});

  const file = read?.ok ? read.file : null;

  const rows = useMemo(() => {
    if (!file) return null;
    return toLibreta(file, { kind: "single" }).forward.map((r, i) => ({
      ...r,
      pointType: overrides[i] ?? r.pointType,
    }));
  }, [file, overrides]);

  // El amarre sale de la primera fila del archivo: es donde arrancó el
  // circuito que se midió.
  const fileCode = rows?.[0]?.pointCode ?? file?.startPoint?.code ?? "";
  const fileElevation = file?.startPoint?.elevation ?? null;
  const visitCode = amarre.code.trim();
  const sameCode = visitCode !== "" && samePointCode(fileCode, visitCode);
  const elevationsDiffer =
    sameCode &&
    fileElevation != null &&
    amarre.elevation != null &&
    fileElevation !== amarre.elevation;
  const closesOnStart =
    rows != null &&
    rows.length >= 2 &&
    samePointCode(rows[0]!.pointCode, rows.at(-1)!.pointCode);

  const notes = rows?.map((r, i) => {
    if (i === 0 || i === rows.length - 1) {
      return samePointCode(r.pointCode, fileCode) ? "BM de amarre" : null;
    }
    return pointCodes.some((c) => samePointCode(c, r.pointCode))
      ? "Punto de control"
      : null;
  });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setRead(readLevelingFile(decodeFileBytes(await f.arrayBuffer())));
    setOverrides({});
    setUseFileElevation(true);
  }

  function accept() {
    if (!rows) return;
    // El amarre va entero, código y cota. Con el mismo código se conserva la
    // cota de la visita salvo que el usuario elija la del archivo; con otro
    // código manda el archivo, porque su primera fila es el amarre medido.
    const result: VisitImport["amarre"] = sameCode
      ? {
          code: visitCode,
          elevation:
            fileElevation != null && (useFileElevation || amarre.elevation == null)
              ? fileElevation
              : amarre.elevation,
        }
      : { code: fileCode, elevation: fileElevation };
    onAccept({ rows, amarre: result });
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setRead(null);
          setFileName(null);
          setOpen(true);
        }}
      >
        Importar desde archivo
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
            <Button onClick={accept} disabled={!rows}>
              Usar estas lecturas
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            Se leen el archivo <strong>.L de un nivel digital Leica</strong> y
            la <strong>plantilla CSV</strong> de TopoField, como un solo
            recorrido: el circuito cerrado sobre el BM de amarre. Las dos
            lecturas de cada visual se promedian. Nada se guarda hasta que
            pulse Guardar.
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
              {read.error} Si su instrumento no es uno de esos, pase las
              lecturas a la plantilla CSV.
            </Alert>
          )}

          {file && rows && (
            <div className="flex flex-col gap-4">
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                <dt className="text-ink-2">Formato</dt>
                <dd>{FORMAT_LABELS[file.format]}</dd>
                <dt className="text-ink-2">Armadas · visuales leídas</dt>
                <dd className="font-mono tabular-nums">
                  {file.setups.length} · {file.rawSights}
                </dd>
                <dt className="text-ink-2">BM de amarre</dt>
                <dd>
                  {fileCode || "—"}
                  {fileElevation != null && (
                    <span className="font-mono tabular-nums"> = {fileElevation.toFixed(4)}</span>
                  )}
                </dd>
              </dl>

              {visitCode !== "" && !sameCode && (
                <Alert variant="warning">
                  El archivo arranca en {fileCode || "un punto sin código"} y la
                  visita tenía como amarre {visitCode}. Al aceptar, el amarre
                  de la visita pasa a ser {fileCode}
                  {fileElevation == null
                    ? "; elija después su cota en el catálogo del proyecto."
                    : "."}
                </Alert>
              )}
              {visitCode === "" && fileElevation == null && (
                <Alert variant="info">
                  El archivo no trae la cota de {fileCode}. Elíjala después en
                  el BM de amarre de la visita.
                </Alert>
              )}
              {elevationsDiffer && (
                <Select
                  label="Cota del BM de amarre"
                  options={[
                    { value: "file", label: `La del archivo: ${fileElevation!.toFixed(4)}` },
                    { value: "visit", label: `La de la visita: ${amarre.elevation!.toFixed(4)}` },
                  ]}
                  value={useFileElevation ? "file" : "visit"}
                  onChange={(e) => setUseFileElevation(e.target.value === "file")}
                />
              )}
              {!closesOnStart && (
                <Alert variant="warning">
                  El recorrido del archivo no termina en su punto de partida.
                  La libreta de una visita es un circuito cerrado sobre el
                  amarre: sin cerrar no se calcula el cierre.
                </Alert>
              )}
              {hasRows && (
                <Alert variant="warning">
                  La visita ya tiene libreta: se reemplazará por la del archivo.
                </Alert>
              )}
              {file.warnings.map((w) => (
                <Alert key={w} variant="warning">
                  {w}
                </Alert>
              ))}

              <p className="text-sm text-ink-2">
                Revise el tipo de cada punto: el .L no lo trae y se deduce de
                su posición; la plantilla CSV puede declararlo. Los puntos de
                control suelen ser radiaciones (intermedios).
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
