import {
  Button,
  DmsInput,
  EMPTY_DMS,
  Input,
  Select,
  type DmsValue,
} from "@/components/design-system";
import { decimalToDms } from "@/lib/calculations/angles";
import type { CaptureIssues } from "@/lib/validators/polygonal";
import {
  DEFLECTION_DIRECTION_LABELS,
  type DeflectionDirection,
  type PolygonalResult,
} from "@/types/polygonal";

export interface StationDraftState {
  /** Clave estable para React (no se persiste). */
  id: string;
  pointCode: string;
  angle: DmsValue;
  deflectionDirection: DeflectionDirection | null;
  distance: string;
}

export function emptyStation(): StationDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: "",
    angle: { ...EMPTY_DMS },
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

interface StationsTableProps {
  stations: StationDraftState[];
  onChange: (stations: StationDraftState[]) => void;
  result: PolygonalResult;
  issues: CaptureIssues[];
  showDeflection: boolean;
  disabled?: boolean;
}

/** Tabla editable de estaciones con las columnas calculadas en vivo. */
export function StationsTable({
  stations,
  onChange,
  result,
  issues,
  showDeflection,
  disabled,
}: StationsTableProps) {
  function update(index: number, patch: Partial<StationDraftState>) {
    onChange(stations.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
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
                  className="border-b border-neutral-100 align-top"
                >
                  <td className="py-2 pr-3">
                    <Input
                      value={station.pointCode}
                      disabled={disabled}
                      onChange={(e) =>
                        update(i, { pointCode: e.target.value })
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <DmsInput
                      value={station.angle}
                      disabled={disabled}
                      error={issue?.errors.angle}
                      onChange={(v) => update(i, { angle: v })}
                    />
                    {issue?.warnings.angle && (
                      <p className="mt-1 text-xs text-warning-500">
                        {issue.warnings.angle}
                      </p>
                    )}
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
                    <Input
                      type="number"
                      step="any"
                      value={station.distance}
                      disabled={disabled}
                      error={issue?.errors.distance}
                      onChange={(e) =>
                        update(i, { distance: e.target.value })
                      }
                      className="w-28"
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatAngle(computed?.azimuth ?? null)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatCoord(computed?.deltaNorth ?? null)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
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
                  className="py-6 text-center text-sm text-neutral-500"
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
              className="rounded-lg border border-neutral-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Input
                  value={station.pointCode}
                  disabled={disabled}
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
                  <p className="mb-1 text-xs font-medium text-neutral-500">Ángulo</p>
                  <DmsInput
                    value={station.angle}
                    disabled={disabled}
                    error={issue?.errors.angle}
                    onChange={(v) => update(i, { angle: v })}
                  />
                  {issue?.warnings.angle && (
                    <p className="mt-1 text-xs text-warning-500">
                      {issue.warnings.angle}
                    </p>
                  )}
                </div>

                {showDeflection && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-neutral-500">
                      Sentido
                    </p>
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
                    />
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-500">
                    Distancia (m)
                  </p>
                  <Input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={station.distance}
                    disabled={disabled}
                    error={issue?.errors.distance}
                    onChange={(e) => update(i, { distance: e.target.value })}
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3">
                <div>
                  <dt className="text-xs text-neutral-500">Azimut</dt>
                  <dd className="font-mono text-sm tabular-nums text-neutral-700">
                    {formatAngle(computed?.azimuth ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">ΔN</dt>
                  <dd className="font-mono text-sm tabular-nums text-neutral-700">
                    {formatCoord(computed?.deltaNorth ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">ΔE</dt>
                  <dd className="font-mono text-sm tabular-nums text-neutral-700">
                    {formatCoord(computed?.deltaEast ?? null)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
        {stations.length === 0 && (
          <li className="py-6 text-center text-sm text-neutral-500">
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
