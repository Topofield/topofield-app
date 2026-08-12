import { Button, Input, Select } from "@/components/design-system";
import type { ReadingCaptureIssues } from "@/lib/validators/leveling";
import {
  POINT_TYPE_LABELS,
  POINT_TYPES,
  type ComputedReading,
  type PointType,
} from "@/types/leveling";
import { cn } from "@/lib/utils/cn";

/** Fila editable de la libreta de campo (todo texto, sin parsear). */
export interface ReadingDraftState {
  /** Clave estable para React (no se persiste). */
  id: string;
  pointCode: string;
  pointType: PointType;
  backsight: string;
  foresight: string;
  distanceM: string;
  distanceAccumulatedKm: string;
}

export function emptyReading(): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: "",
    pointType: "pc",
    backsight: "",
    foresight: "",
    distanceM: "",
    distanceAccumulatedKm: "",
  };
}

const POINT_TYPE_OPTIONS = POINT_TYPES.map((value) => ({
  value,
  label: POINT_TYPE_LABELS[value],
}));

function formatElevation(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(4);
}

interface ReadingsTableProps {
  readings: ReadingDraftState[];
  onChange: (readings: ReadingDraftState[]) => void;
  computed: ComputedReading[];
  issues: ReadingCaptureIssues[];
  disabled?: boolean;
}

/**
 * Libreta de campo editable con las columnas calculadas en vivo.
 *
 * La AI es un valor por armada, no por fila: solo se muestra en las filas
 * que llevan lectura atrás (las que abren una armada nueva). La primera fila
 * (bm) no admite lectura adelante; la última fila, si es bm, no admite
 * lectura atrás. Las filas `intermediate` no llevan lectura atrás: cuelgan
 * de la AI vigente y no propagan cota.
 */
export function ReadingsTable({
  readings,
  onChange,
  computed,
  issues,
  disabled,
}: ReadingsTableProps) {
  function update(index: number, patch: Partial<ReadingDraftState>) {
    onChange(readings.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  // `Input` ya pinta el borde rojo vía `error`; el amarillo de advertencia no
  // tiene prop propia, así que se aplica por className cuando no hay error.
  function warningClass(hasError?: string, hasWarning?: string) {
    return !hasError && hasWarning ? "border-warning-500" : undefined;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">Punto</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 pr-3 font-medium">L.Atrás</th>
              <th className="py-2 pr-3 font-medium">AI</th>
              <th className="py-2 pr-3 font-medium">L.Adelante</th>
              <th className="py-2 pr-3 font-medium">Dist (m)</th>
              <th className="py-2 pr-3 font-medium">Dist acum (km)</th>
              <th className="py-2 pr-3 font-medium">Cota</th>
              <th className="py-2 pr-3 font-medium">Cota corregida</th>
              {!disabled && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {readings.map((reading, i) => {
              const issue = issues[i];
              const row = computed[i];
              const isFirst = i === 0;
              const isLast = i === readings.length - 1;
              const isIntermediate = reading.pointType === "intermediate";
              // La primera fila no admite L.Ad; la última, si es bm, no admite L.At.
              const foresightDisabled = disabled || isFirst;
              const backsightDisabled =
                disabled ||
                isIntermediate ||
                (isLast && reading.pointType === "bm");
              // La AI es de la armada, no de la fila: solo se pinta cuando la
              // fila lleva L.At (es la que la genera).
              const showInstrumentHeight = row?.instrumentHeight != null;

              return (
                <tr
                  key={reading.id}
                  className="border-b border-neutral-100 align-top"
                >
                  <td className="py-2 pr-3">
                    <Input
                      value={reading.pointCode}
                      disabled={disabled}
                      error={issue?.errors.pointCode}
                      onChange={(e) =>
                        update(i, { pointCode: e.target.value })
                      }
                      className="w-24"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Select
                      options={POINT_TYPE_OPTIONS}
                      value={reading.pointType}
                      disabled={disabled}
                      error={issue?.errors.pointType}
                      onChange={(e) =>
                        update(i, {
                          pointType: e.target.value as PointType,
                        })
                      }
                      className="w-32"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label="Lectura atrás"
                      value={reading.backsight}
                      disabled={backsightDisabled}
                      error={issue?.errors.backsight}
                      className={cn(
                        "w-24",
                        warningClass(issue?.errors.backsight, issue?.warnings.backsight),
                      )}
                      onChange={(e) =>
                        update(i, { backsight: e.target.value })
                      }
                    />
                    {issue?.warnings.backsight && (
                      <p className="mt-1 text-xs text-warning-500">
                        {issue.warnings.backsight}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {showInstrumentHeight
                      ? formatElevation(row?.instrumentHeight)
                      : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label="Lectura adelante"
                      value={reading.foresight}
                      disabled={foresightDisabled}
                      error={issue?.errors.foresight}
                      className={cn(
                        "w-24",
                        warningClass(issue?.errors.foresight, issue?.warnings.foresight),
                      )}
                      onChange={(e) =>
                        update(i, { foresight: e.target.value })
                      }
                    />
                    {issue?.warnings.foresight && (
                      <p className="mt-1 text-xs text-warning-500">
                        {issue.warnings.foresight}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label="Distancia (m)"
                      value={reading.distanceM}
                      disabled={disabled}
                      className="w-24"
                      onChange={(e) =>
                        update(i, { distanceM: e.target.value })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label="Distancia acumulada (km)"
                      value={reading.distanceAccumulatedKm}
                      disabled={disabled}
                      error={issue?.errors.distanceAccumulatedKm}
                      className="w-28"
                      onChange={(e) =>
                        update(i, { distanceAccumulatedKm: e.target.value })
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatElevation(row?.elevationCalculated)}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums font-medium text-neutral-900">
                    {formatElevation(row?.elevationCorrected)}
                  </td>
                  {!disabled && (
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          onChange(readings.filter((_, j) => j !== i))
                        }
                      >
                        Eliminar
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {readings.length === 0 && (
              <tr>
                <td
                  colSpan={disabled ? 9 : 10}
                  className="py-6 text-center text-sm text-neutral-500"
                >
                  Aún no hay lecturas. Agrega la primera para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => onChange([...readings, emptyReading()])}
          >
            + Agregar lectura
          </Button>
        </div>
      )}
    </div>
  );
}
