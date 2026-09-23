import { useState } from "react";
import { Button, Input, Select } from "@/components/design-system";
import type { ReadingCaptureIssues } from "@/lib/validators/leveling";
import {
  POINT_TYPE_LABELS,
  POINT_TYPES,
  type ComputedReading,
  type PointType,
} from "@/types/leveling";
import type { LevelType } from "@/types/project";
import { cn } from "@/lib/utils/cn";

/** Fila editable de la libreta de campo (todo texto, sin parsear). */
export interface ReadingDraftState {
  /** Clave estable para React (no se persiste). */
  id: string;
  pointCode: string;
  pointType: PointType;
  backsight: string;
  foresight: string;
  /** Hilos opcionales; el medio es la lectura de mira. */
  backUpperM: string;
  backLowerM: string;
  foreUpperM: string;
  foreLowerM: string;
  /** Distancia por visual: autocompletada desde los hilos, o tecleada. */
  backDistanceM: string;
  foreDistanceM: string;
}

export function emptyReading(): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: "",
    pointType: "pc",
    backsight: "",
    foresight: "",
    backUpperM: "",
    backLowerM: "",
    foreUpperM: "",
    foreLowerM: "",
    backDistanceM: "",
    foreDistanceM: "",
  };
}

/** Parseo laxo: la celda vacía o a medio teclear no es un número. */
function parseCell(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Al teclear un hilo: si el par queda completo, autocompleta la distancia de
 * esa visual; si además la lectura de mira está VACÍA, la rellena con el hilo
 * medio.
 *
 * No sobrescribe una lectura ya escrita: la lectura es el dato, el hilo medio
 * es una forma de obtenerlo. El topógrafo que anotó la lectura y luego añade
 * los hilos no debe ver cambiar lo que escribió.
 */
export function applyWireDerivation(
  row: ReadingDraftState,
  side: "back" | "fore",
): ReadingDraftState {
  const upper = parseCell(side === "back" ? row.backUpperM : row.foreUpperM);
  const lower = parseCell(side === "back" ? row.backLowerM : row.foreLowerM);
  if (upper == null || lower == null || upper <= lower) return row;

  const readingKey = side === "back" ? "backsight" : "foresight";
  const distanceKey = side === "back" ? "backDistanceM" : "foreDistanceM";

  return {
    ...row,
    [distanceKey]: ((upper - lower) * 100).toFixed(3),
    [readingKey]:
      row[readingKey].trim() === ""
        ? ((upper + lower) / 2).toFixed(4)
        : row[readingKey],
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
  /** `automatico` ofrece los hilos; `digital` no los usa. */
  levelType: LevelType | null;
  /** Distancias reconstruidas por el backfill: el equilibrado no se evalúa. */
  distancesReconstructed?: boolean;
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
  levelType,
  distancesReconstructed = false,
}: ReadingsTableProps) {
  const [showWires, setShowWires] = useState(false);
  // Los hilos son cosa del nivel automático: con uno digital el instrumento
  // entrega la distancia y no se leen hilos sobre la mira.
  const wiresAvailable = levelType === "automatico";
  const wiresVisible = wiresAvailable && showWires;
  function update(index: number, patch: Partial<ReadingDraftState>) {
    onChange(readings.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  /** Aplica el cambio de un hilo y deriva distancia y lectura de esa visual. */
  function updateWires(
    index: number,
    patch: Partial<ReadingDraftState>,
    side: "back" | "fore",
  ) {
    onChange(
      readings.map((r, i) =>
        i === index ? applyWireDerivation({ ...r, ...patch }, side) : r,
      ),
    );
  }

  // `Input` ya pinta el borde rojo vía `error`; el amarillo de advertencia no
  // tiene prop propia, así que se aplica por className cuando no hay error.
  function warningClass(hasError?: string, hasWarning?: string) {
    return !hasError && hasWarning ? "border-warning-500" : undefined;
  }

  return (
    <div className="flex flex-col gap-3">
      {distancesReconstructed && (
        <p className="text-sm text-warning-500">
          Las distancias por visual de este proceso las reconstruyó la
          migración repartiendo por mitades; el equilibrado de visuales no se
          evalúa.
        </p>
      )}
      {wiresAvailable && (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={showWires}
            onChange={(e) => setShowWires(e.target.checked)}
          />
          Capturar los tres hilos (la distancia se calcula por taquimetría)
        </label>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">Punto</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              {wiresVisible && (
                <>
                  <th className="py-2 pr-3 font-medium">HS atrás</th>
                  <th className="py-2 pr-3 font-medium">HI atrás</th>
                </>
              )}
              <th className="py-2 pr-3 font-medium">L.Atrás</th>
              <th className="py-2 pr-3 font-medium">Dist atrás (m)</th>
              <th className="py-2 pr-3 font-medium">AI</th>
              {wiresVisible && (
                <>
                  <th className="py-2 pr-3 font-medium">HS adelante</th>
                  <th className="py-2 pr-3 font-medium">HI adelante</th>
                </>
              )}
              <th className="py-2 pr-3 font-medium">L.Adelante</th>
              <th className="py-2 pr-3 font-medium">Dist adelante (m)</th>
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
                  {wiresVisible && (
                    <>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label="Hilo superior atrás"
                          value={reading.backUpperM}
                          disabled={backsightDisabled}
                          error={issue?.errors.backWires}
                          className="w-24"
                          onChange={(e) =>
                            updateWires(i, { backUpperM: e.target.value }, "back")
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label="Hilo inferior atrás"
                          value={reading.backLowerM}
                          disabled={backsightDisabled}
                          error={issue?.errors.backWires}
                          className="w-24"
                          onChange={(e) =>
                            updateWires(i, { backLowerM: e.target.value }, "back")
                          }
                        />
                      </td>
                    </>
                  )}
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
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label="Distancia atrás (m)"
                      value={reading.backDistanceM}
                      disabled={backsightDisabled}
                      error={issue?.errors.backDistanceM}
                      className="w-24"
                      onChange={(e) =>
                        update(i, { backDistanceM: e.target.value })
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {showInstrumentHeight
                      ? formatElevation(row?.instrumentHeight)
                      : "—"}
                  </td>
                  {wiresVisible && (
                    <>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label="Hilo superior adelante"
                          value={reading.foreUpperM}
                          disabled={foresightDisabled}
                          error={issue?.errors.foreWires}
                          className="w-24"
                          onChange={(e) =>
                            updateWires(i, { foreUpperM: e.target.value }, "fore")
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label="Hilo inferior adelante"
                          value={reading.foreLowerM}
                          disabled={foresightDisabled}
                          error={issue?.errors.foreWires}
                          className="w-24"
                          onChange={(e) =>
                            updateWires(i, { foreLowerM: e.target.value }, "fore")
                          }
                        />
                      </td>
                    </>
                  )}
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
                      aria-label="Distancia adelante (m)"
                      value={reading.foreDistanceM}
                      disabled={foresightDisabled}
                      error={issue?.errors.foreDistanceM}
                      className="w-24"
                      onChange={(e) =>
                        update(i, { foreDistanceM: e.target.value })
                      }
                    />
                  </td>
                  {/* Derivada: la calcula el motor desde las distancias por
                      visual. Solo lectura — que se teclease era la causa de
                      que el punto de cierre pudiera quedar sin compensar. */}
                  <td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {row?.distanceAccumulatedKm == null
                      ? "—"
                      : row.distanceAccumulatedKm.toFixed(3)}
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
