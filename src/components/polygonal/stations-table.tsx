"use client";

import { useState } from "react";
import {
  Button,
  type DmsValue,
  EMPTY_DMS,
  Input,
  NumberInput,
  Select,
} from "@/components/design-system";
import { decimalToDms, formatDecimalDegrees } from "@/lib/calculations/angles";
import { averageOf, readingValues } from "./polygonal-draft";
import {
  validateReadings,
  type CaptureIssues,
} from "@/lib/validators/polygonal";
import {
  DEFLECTION_DIRECTION_LABELS,
  type DeflectionDirection,
  type PolygonalResult,
} from "@/types/polygonal";
import { AngleInput } from "./angle-input";
import type { AngleInputFormat } from "@/types/polygonal";

export interface StationDraftState {
  /** Clave estable para React (no se persiste). */
  id: string;
  pointCode: string;
  /**
   * Promedio de las lecturas. Derivado: lo recalcula `averageOf` en cada
   * cambio y el servidor lo vuelve a calcular al guardar.
   */
  angle: DmsValue;
  /** Lecturas del ángulo. El mínimo lo fija el proceso. */
  readings: DmsValue[];
  deflectionDirection: DeflectionDirection | null;
  distance: string;
}

export function emptyStation(readingsMin = 3): StationDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: "",
    angle: { ...EMPTY_DMS },
    readings: Array.from({ length: readingsMin }, () => ({ ...EMPTY_DMS })),
    deflectionDirection: null,
    distance: "",
  };
}

const DEFLECTION_OPTIONS = [
  { value: "right", label: DEFLECTION_DIRECTION_LABELS.right },
  { value: "left", label: DEFLECTION_DIRECTION_LABELS.left },
];

function formatAngle(decimal: number | null): string {
  if (decimal == null) return "—";
  const { deg, min, sec } = decimalToDms(decimal);
  return `${deg}°${min}′${sec}″`;
}

function formatCoord(value: number | null): string {
  return value == null ? "—" : value.toFixed(3);
}

/**
 * Celda de ángulo con N lecturas.
 *
 * Fuera del despliegue se muestra promedio y dispersión, que es lo que el
 * topógrafo quiere ver de un vistazo: tres lecturas que difieren 40" dicen
 * algo que el promedio esconde.
 */
function AngleReadingsCell({
  station,
  issue,
  readingIssue,
  disabled,
  format,
  onChange,
}: {
  station: StationDraftState;
  issue?: CaptureIssues;
  readingIssue?: { error?: string; warning?: string };
  disabled?: boolean;
  format: AngleInputFormat;
  onChange: (readings: DmsValue[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const average = averageOf(station.readings);
  const values = readingValues(station.readings);
  const dispersion =
    values.length > 1
      ? (Math.max(...values) - Math.min(...values)) * 3600
      : null;

  function setReading(index: number, value: DmsValue) {
    onChange(station.readings.map((r, i) => (i === index ? value : r)));
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-baseline gap-2 text-left tabular-nums"
      >
        <span className={average ? "font-medium" : "text-ink-3"}>
          {average
            ? format === "decimal"
              ? // El promedio en decimal sale de las lecturas, no del DMS ya
                // redondeado: es el mismo ángulo en las dos vistas.
                `${formatDecimalDegrees(values.reduce((x, y) => x + y, 0) / values.length)}°`
              : `${average.deg}°${average.min}′${average.sec}″`
            : "Sin lecturas"}
        </span>
        <span className="text-xs text-ink-2">
          {dispersion != null ? `±${dispersion.toFixed(1)}″` : ""}
          {` · ${values.length}/${station.readings.length}`}
        </span>
        <span aria-hidden className="text-xs text-ink-3">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {issue?.errors.angle && (
        <p className="text-xs text-danger">{issue.errors.angle}</p>
      )}
      {readingIssue?.error && (
        <p className="text-xs text-warning">{readingIssue.error}</p>
      )}
      {readingIssue?.warning && (
        <p className="text-xs text-warning">{readingIssue.warning}</p>
      )}

      {open && (
        <div className="mt-1 flex flex-col gap-1 rounded-md bg-paper p-2">
          {station.readings.map((reading, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-4 text-xs text-ink-2">{index + 1}</span>
              <AngleInput
                format={format}
                value={reading}
                disabled={disabled}
                onChange={(v) => setReading(index, v)}
              />
            </div>
          ))}
          {!disabled && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange([...station.readings, { ...EMPTY_DMS }])}
              className="mt-1 self-start"
            >
              + lectura
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface StationsTableProps {
  stations: StationDraftState[];
  onChange: (stations: StationDraftState[]) => void;
  result: PolygonalResult;
  issues: CaptureIssues[];
  showDeflection: boolean;
  /** Mínimo de lecturas que exige el proceso. */
  readingsMin: number;
  /** Precisión angular del equipo, para la dispersión. */
  angularPrecisionSeconds: number;
  disabled?: boolean;
  /** Formato de captura de los ángulos (Fase 13, P1). */
  angleFormat: AngleInputFormat;
}

/** Tabla editable de estaciones con las columnas calculadas en vivo. */
export function StationsTable({
  stations,
  onChange,
  result,
  issues,
  showDeflection,
  readingsMin,
  angularPrecisionSeconds,
  disabled,
  angleFormat,
}: StationsTableProps) {
  function update(index: number, patch: Partial<StationDraftState>) {
    onChange(stations.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  /** Diagnóstico de las lecturas de una estación. */
  function readingIssue(station: StationDraftState): {
    error?: string;
    warning?: string;
  } {
    const readings = readingValues(station.readings).map((angle, i) => ({
      order: i + 1,
      angle,
    }));
    return validateReadings(readings, readingsMin, angularPrecisionSeconds);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-2">
              <th className="py-2 pr-3 font-medium">Estación</th>
              <th className="py-2 pr-3 font-medium">Ángulo</th>
              {showDeflection && (
                <th className="py-2 pr-3 font-medium">Sentido</th>
              )}
              <th className="py-2 pr-3 font-medium">Distancia (m)</th>
              <th className="py-2 pr-3 font-medium">Azimut</th>
              <th className="py-2 pr-3 font-medium">ΔN</th>
              <th className="py-2 pr-3 font-medium">ΔE</th>
              {!disabled && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {stations.map((station, i) => {
              const issue = issues[i];
              const computed = result.stations[i];
              return (
                <tr
                  key={station.id}
                  className="border-b border-rule align-top"
                >
                  <td className="py-2 pr-3">
                    <Input
                      value={station.pointCode}
                      disabled={disabled}
                      error={issue?.errors.pointCode}
                      onChange={(e) =>
                        update(i, { pointCode: e.target.value })
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <AngleReadingsCell
                      station={station}
                      issue={issue}
                      readingIssue={readingIssue(station)}
                      disabled={disabled}
                      format={angleFormat}
                      onChange={(readings) =>
                        update(i, {
                          readings,
                          angle: averageOf(readings) ?? station.angle,
                        })
                      }
                    />
                  </td>
                  {showDeflection && (
                    <td className="py-2 pr-3">
                      <Select
                        options={DEFLECTION_OPTIONS}
                        placeholder="—"
                        value={station.deflectionDirection ?? ""}
                        disabled={disabled}
                        onChange={(e) =>
                          update(i, {
                            deflectionDirection:
                              e.target.value === ""
                                ? null
                                : (e.target.value as DeflectionDirection),
                          })
                        }
                        className="w-28"
                      />
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <NumberInput
                      value={station.distance}
                      disabled={disabled}
                      error={issue?.errors.distance}
                      onChange={(e) =>
                        update(i, { distance: e.target.value })
                      }
                      className="w-28"
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-ink-2">
                    {formatAngle(computed?.azimuth ?? null)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-ink-2">
                    {formatCoord(computed?.deltaNorth ?? null)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-ink-2">
                    {formatCoord(computed?.deltaEast ?? null)}
                  </td>
                  {!disabled && (
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          onChange(stations.filter((_, j) => j !== i))
                        }
                      >
                        Eliminar
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {stations.length === 0 && (
              <tr>
                <td
                  colSpan={showDeflection ? 8 : 7}
                  className="py-6 text-center text-sm text-ink-2"
                >
                  Aún no hay estaciones. Agrega la primera para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {stations.map((station, i) => {
          const issue = issues[i];
          const computed = result.stations[i];
          return (
            <li
              key={station.id}
              className="rounded-lg border border-rule p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Input
                  value={station.pointCode}
                  disabled={disabled}
                  error={issue?.errors.pointCode}
                  onChange={(e) => update(i, { pointCode: e.target.value })}
                  className="w-28"
                  aria-label={`Código de la estación ${i + 1}`}
                />
                {!disabled && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => onChange(stations.filter((_, j) => j !== i))}
                  >
                    Eliminar
                  </Button>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <p className="mb-1 text-xs font-medium text-ink-2">Ángulo</p>
                  <AngleReadingsCell
                    station={station}
                    issue={issue}
                    readingIssue={readingIssue(station)}
                    disabled={disabled}
                    format={angleFormat}
                    onChange={(readings) =>
                      update(i, {
                        readings,
                        angle: averageOf(readings) ?? station.angle,
                      })
                    }
                  />
                </div>

                {showDeflection && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-2">
                      Sentido
                    </p>
                    <Select
                      options={DEFLECTION_OPTIONS}
                      placeholder="—"
                      value={station.deflectionDirection ?? ""}
                      disabled={disabled}
                      aria-label="Sentido"
                      onChange={(e) =>
                        update(i, {
                          deflectionDirection:
                            e.target.value === ""
                              ? null
                              : (e.target.value as DeflectionDirection),
                        })
                      }
                    />
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-medium text-ink-2">
                    Distancia (m)
                  </p>
                  <NumberInput
                    value={station.distance}
                    disabled={disabled}
                    error={issue?.errors.distance}
                    aria-label="Distancia (m)"
                    onChange={(e) => update(i, { distance: e.target.value })}
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-rule pt-3">
                <div>
                  <dt className="text-xs text-ink-2">Azimut</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink-2">
                    {formatAngle(computed?.azimuth ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-2">ΔN</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink-2">
                    {formatCoord(computed?.deltaNorth ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-2">ΔE</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink-2">
                    {formatCoord(computed?.deltaEast ?? null)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
        {stations.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-2">
            Aún no hay estaciones. Agrega la primera para empezar.
          </li>
        )}
      </ul>
      {!disabled && (
        <div>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => onChange([...stations, emptyStation()])}
          >
            + Agregar estación
          </Button>
        </div>
      )}
    </div>
  );
}
