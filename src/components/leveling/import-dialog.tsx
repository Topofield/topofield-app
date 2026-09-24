"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Alert, Button, Modal, Select } from "@/components/design-system";
import {
  CSV_TEMPLATE,
  FORMAT_LABELS,
  decodeFileBytes,
  detectTurnSetup,
  proposedLevelingType,
  readLevelingFile,
  toLibreta,
  type ImportMode,
  type LibretaRow,
  type ReadResult,
} from "@/lib/import/leveling";
import type { LevelingConfigState } from "./leveling-config-fields";
import {
  LEVELING_TYPE_LABELS,
  POINT_TYPES,
  POINT_TYPE_LABELS,
  type LevelingType,
  type PointType,
} from "@/types/leveling";

/** Lo que la importación entrega al editor o al formulario de creación. */
export interface LevelingImport {
  forward: LibretaRow[];
  return: LibretaRow[] | null;
  startBm: { code: string; elevation: number | null };
  type: LevelingType;
}

/**
 * La configuración con lo que trae la importación: tipo, vuelta, BM de
 * partida y modo digital (el archivo es de un nivel digital). Una sola regla
 * para el editor y el formulario de creación.
 */
export function configWithImport(
  config: LevelingConfigState,
  imported: LevelingImport,
): LevelingConfigState {
  return {
    ...config,
    type: imported.type,
    hasReturnRun: imported.return != null,
    startBm: {
      code: imported.startBm.code,
      elevation: imported.startBm.elevation != null ? String(imported.startBm.elevation) : "",
    },
    level: { ...config.level, levelType: "digital" },
  };
}

interface ImportDialogProps {
  /** Tipo y BM de partida actuales del proceso (o del formulario). */
  currentType: LevelingType;
  currentStartCode: string;
  currentStartElevation: number | null;
  /** El proceso ya tiene lecturas: se reemplazan, y se avisa. */
  hasReadings: boolean;
  onAccept: (result: LevelingImport) => void;
  disabled?: boolean;
}

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

const TYPE_OPTIONS = POINT_TYPES.map((value) => ({ value, label: POINT_TYPE_LABELS[value] }));

function fmt(value: number | null, decimals: number): string {
  return value == null ? "" : value.toFixed(decimals);
}

export function TemplateLink() {
  return (
    <a
      href={TEMPLATE_HREF}
      download="plantilla-nivelacion.csv"
      className="text-sm font-medium text-primary-700 underline underline-offset-2"
    >
      Descargar plantilla CSV
    </a>
  );
}

/**
 * Tabla de una libreta importada, con el tipo de punto editable. La reutiliza
 * la importación de la visita de asentamientos (Fase 18), que pasa `notes`
 * para marcar los puntos de control.
 */
export function RunPreview({
  title,
  rows,
  onType,
  notes,
}: {
  title: string;
  rows: LibretaRow[];
  onType: (index: number, type: PointType) => void;
  notes?: (string | null)[];
}) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
            <th className="py-1.5 pr-3 font-medium">Punto</th>
            <th className="py-1.5 pr-3 font-medium">Tipo</th>
            <th className="py-1.5 pr-3 font-medium">V+</th>
            <th className="py-1.5 pr-3 font-medium">V−</th>
            <th className="py-1.5 pr-3 font-medium">Dist. V+</th>
            <th className="py-1.5 pr-3 font-medium">Dist. V−</th>
            {notes && <th className="py-1.5 pr-3 font-medium">Nota</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-neutral-100">
              <td className="py-1 pr-3 font-medium">{r.pointCode}</td>
              <td className="py-1 pr-3">
                <Select
                  aria-label={`Tipo de ${r.pointCode}`}
                  options={TYPE_OPTIONS}
                  value={r.pointType}
                  onChange={(e) => onType(i, e.target.value as PointType)}
                />
              </td>
              <td className="py-1 pr-3 font-mono tabular-nums">{fmt(r.backsight, 4)}</td>
              <td className="py-1 pr-3 font-mono tabular-nums">{fmt(r.foresight, 4)}</td>
              <td className="py-1 pr-3 font-mono tabular-nums">{fmt(r.backDistanceM, 3)}</td>
              <td className="py-1 pr-3 font-mono tabular-nums">{fmt(r.foreDistanceM, 3)}</td>
              {notes && <td className="py-1 pr-3 text-neutral-500">{notes[i] ?? ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Importa una libreta desde el archivo de un nivel digital, o desde la
 * plantilla CSV (Fase 16). Nada se guarda aquí: al aceptar, entrega las filas
 * y la configuración propuesta, y quien la abrió las pone en su borrador.
 */
export function ImportDialog({
  currentType,
  currentStartCode,
  currentStartElevation,
  hasReadings,
  onAccept,
  disabled,
}: ImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [read, setRead] = useState<ReadResult | null>(null);
  const [mode, setMode] = useState<"single" | "split">("single");
  const [turnSetup, setTurnSetup] = useState(2);
  const [useFileElevation, setUseFileElevation] = useState(true);
  // Tipos corregidos a mano, por recorrido y fila. Se vacían al cambiar cómo
  // se lee el archivo: las filas dejan de ser las mismas.
  const [overrides, setOverrides] = useState<Record<string, PointType>>({});

  const file = read?.ok ? read.file : null;

  const rows = useMemo(() => {
    if (!file) return null;
    const importMode: ImportMode =
      mode === "split" ? { kind: "split", turnSetup } : { kind: "single" };
    const base = toLibreta(file, importMode);
    const apply = (run: string, list: LibretaRow[]) =>
      list.map((r, i) => ({ ...r, pointType: overrides[`${run}:${i}`] ?? r.pointType }));
    return {
      forward: apply("forward", base.forward),
      return: base.return ? apply("return", base.return) : null,
    };
  }, [file, mode, turnSetup, overrides]);

  const fileElevation = file?.startPoint?.elevation ?? null;
  const elevationsDiffer =
    fileElevation != null && currentStartElevation != null && fileElevation !== currentStartElevation;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const result = readLevelingFile(decodeFileBytes(await f.arrayBuffer()));
    setRead(result);
    setOverrides({});
    if (result.ok) {
      const turn = detectTurnSetup(result.file);
      // Se propone la lectura que el propio archivo sugiere: con vuelta
      // declarada o detectada, ida y vuelta. El usuario decide.
      setMode(turn != null ? "split" : "single");
      setTurnSetup(turn ?? Math.max(2, Math.ceil(result.file.setups.length / 2) + 1));
      setUseFileElevation(true);
    }
  }

  function accept() {
    if (!file || !rows) return;
    // El BM va entero, código y cota: quedarse con la cota del proceso y el
    // código del archivo emparejaría la cota de un punto con el nombre de otro.
    const takeFile = fileElevation == null
      ? currentStartElevation == null || currentStartCode.trim() === ""
      : useFileElevation || currentStartElevation == null;
    const startBm = takeFile
      ? { code: rows.forward[0]?.pointCode ?? file.startPoint?.code ?? "", elevation: fileElevation }
      : { code: currentStartCode, elevation: currentStartElevation };
    onAccept({
      forward: rows.forward,
      return: rows.return,
      startBm,
      type: proposedLevelingType(rows, currentType),
    });
    setOpen(false);
  }

  const setupOptions = file
    ? Array.from({ length: Math.max(file.setups.length - 1, 0) }, (_, i) => ({
        value: String(i + 2),
        label: `Armada ${i + 2}`,
      }))
    : [];

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
        title="Importar libreta desde archivo"
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
          <p className="text-sm text-neutral-500">
            Se leen el archivo <strong>.L de un nivel digital Leica</strong> y
            la <strong>plantilla CSV</strong> de TopoField. Las dos lecturas de
            cada visual se promedian. Nada se guarda hasta que pulse Guardar.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-neutral-800">
              <span className="sr-only">Archivo</span>
              <input
                type="file"
                onChange={onFile}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
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
                <dt className="text-neutral-500">Formato</dt>
                <dd>{FORMAT_LABELS[file.format]}</dd>
                <dt className="text-neutral-500">Armadas · visuales leídas</dt>
                <dd className="font-mono tabular-nums">
                  {file.setups.length} · {file.rawSights}
                </dd>
                {file.instrumentSummary && (
                  <>
                    <dt className="text-neutral-500">Según el instrumento</dt>
                    <dd className="font-mono tabular-nums">
                      Δ {file.instrumentSummary.heightDifference.toFixed(4)} m ·{" "}
                      {file.instrumentSummary.distance.toFixed(3)} m
                    </dd>
                  </>
                )}
                {file.quality.maxRepeatSpreadMm != null && (
                  <>
                    <dt className="text-neutral-500">Mayor dispersión entre repeticiones</dt>
                    <dd className="font-mono tabular-nums">{file.quality.maxRepeatSpreadMm.toFixed(1)} mm</dd>
                  </>
                )}
                {file.quality.maxSigmaMm != null && (
                  <>
                    <dt className="text-neutral-500">Mayor σ del instrumento</dt>
                    <dd className="font-mono tabular-nums">{file.quality.maxSigmaMm.toFixed(1)} mm</dd>
                  </>
                )}
              </dl>

              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Cómo se lee el recorrido"
                  options={
                    // Con una sola armada no hay ida y vuelta que partir.
                    file.setups.length < 2
                      ? [{ value: "single", label: "Un recorrido" }]
                      : [
                          { value: "single", label: "Un recorrido" },
                          { value: "split", label: "Ida y vuelta" },
                        ]
                  }
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as "single" | "split");
                    setOverrides({});
                  }}
                />
                {mode === "split" && (
                  <Select
                    label="La vuelta empieza en"
                    options={setupOptions}
                    value={String(turnSetup)}
                    onChange={(e) => {
                      setTurnSetup(Number(e.target.value));
                      setOverrides({});
                    }}
                    helperText={
                      detectTurnSetup(file) != null
                        ? `Detectada: armada ${detectTurnSetup(file)}, donde el recorrido vuelve sobre sus puntos.`
                        : undefined
                    }
                  />
                )}
              </div>

              {elevationsDiffer && (
                <Select
                  label="Cota del BM de partida"
                  options={[
                    {
                      value: "file",
                      label: `La del archivo: ${file.startPoint?.code ?? ""} = ${fileElevation!.toFixed(4)}`,
                    },
                    {
                      value: "process",
                      label: `La del proceso: ${currentStartCode} = ${currentStartElevation!.toFixed(4)}`,
                    },
                  ]}
                  value={useFileElevation ? "file" : "process"}
                  onChange={(e) => setUseFileElevation(e.target.value === "file")}
                />
              )}

              <p className="text-sm text-neutral-700">
                El proceso quedará como{" "}
                <strong>{LEVELING_TYPE_LABELS[proposedLevelingType(rows, currentType)]}</strong>
                {rows.return ? " con recorrido de vuelta" : ""}, en modo{" "}
                <strong>digital</strong>. Puede cambiarlo después en la
                configuración. Revise el tipo de cada punto: el .L no lo trae
                y se deduce de su posición; la plantilla CSV puede declararlo.
              </p>

              {hasReadings && (
                <Alert variant="warning">
                  El proceso ya tiene lecturas: se reemplazarán por las del archivo.
                </Alert>
              )}
              {file.warnings.map((w) => (
                <Alert key={w} variant="warning">
                  {w}
                </Alert>
              ))}

              <RunPreview
                title={rows.return ? "Ida" : "Recorrido"}
                rows={rows.forward}
                onType={(i, t) => setOverrides({ ...overrides, [`forward:${i}`]: t })}
              />
              {rows.return && (
                <RunPreview
                  title="Vuelta"
                  rows={rows.return}
                  onType={(i, t) => setOverrides({ ...overrides, [`return:${i}`]: t })}
                />
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
