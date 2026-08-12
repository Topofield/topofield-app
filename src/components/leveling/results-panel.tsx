import { Alert, Card, StatusIndicator } from "@/components/design-system";
import { evaluateLevelingClosure } from "@/lib/validators/leveling";
import { RUN_TYPE_LABELS, type LevelingResult, type LevelingType } from "@/types/leveling";

/** Formatea metros como cota, a 4 decimales. */
function formatElevation(value: number): string {
  return value.toFixed(4);
}

/** Formatea un valor en milímetros, a 1 decimal. */
function formatMm(value: number): string {
  return value.toFixed(1);
}

/** Formatea una distancia acumulada en km, a 3 decimales. */
function formatKm(value: number | null): string {
  return value == null ? "—" : value.toFixed(3);
}

interface ResultsPanelProps {
  result: LevelingResult;
  type: LevelingType;
}

/**
 * Panel de resultados del proceso de nivelación: comprobación aritmética,
 * cierre, ida y vuelta, y cotas corregidas. Consume `LevelingResult` ya
 * calculado por `computeLeveling` en el editor — no recalcula nada.
 */
export function ResultsPanel({ result, type }: ResultsPanelProps) {
  const closure = evaluateLevelingClosure(result);
  const arithmeticDifference = result.sumBacksights - result.sumForesights;

  return (
    <div className="flex flex-col gap-6">
      {/* Bloque 1: comprobación aritmética. */}
      <Card title="Comprobación aritmética">
        <div className="flex flex-col gap-4">
          {!result.arithmeticCheckOk && (
            <Alert variant="error" title="La comprobación aritmética no cuadra">
              ΣL.Atrás − ΣL.Adelante no coincide con el desnivel total del
              recorrido. Es un fallo de gabinete (suma o traslado de datos):
              cuadra igual con el nivel descolimado, así que no dice nada
              sobre la calidad de la medición. Revisa la libreta antes de
              continuar.
            </Alert>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-neutral-500">ΣL.Atrás</dt>
              <dd className="font-mono tabular-nums text-neutral-900">
                {formatElevation(result.sumBacksights)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">ΣL.Adelante</dt>
              <dd className="font-mono tabular-nums text-neutral-900">
                {formatElevation(result.sumForesights)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Diferencia</dt>
              <dd className="font-mono tabular-nums text-neutral-900">
                {formatElevation(arithmeticDifference)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Desnivel total (ida)</dt>
              <dd className="font-mono tabular-nums text-neutral-900">
                {formatElevation(result.forward.heightDifference)}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Bloque 2: cierre. Oculto en `open`, que no cierra contra nada. */}
      {type !== "open" &&
        result.closureErrorMm != null &&
        result.toleranceMm != null &&
        result.meetsTolerance != null && (
          <Card title="Cierre">
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-neutral-500">Error de cierre</dt>
                  <dd className="font-mono tabular-nums text-neutral-900">
                    {formatMm(result.closureErrorMm)} mm
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Tolerancia (K·√D)</dt>
                  <dd className="font-mono tabular-nums text-neutral-900">
                    {formatMm(result.toleranceMm)} mm
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Cumplimiento</dt>
                  <dd>
                    <StatusIndicator
                      status={result.meetsTolerance ? "ok" : "danger"}
                      label={result.meetsTolerance ? "Cumple" : "No cumple"}
                    />
                  </dd>
                </div>
              </dl>
              {closure.messages.map((message) => (
                <Alert
                  key={message}
                  variant={closure.mustReject ? "error" : "warning"}
                >
                  {message}
                </Alert>
              ))}
            </div>
          </Card>
        )}

      {/* Bloque 3: ida y vuelta. Solo si hay recorrido de vuelta. */}
      {result.return != null && (
        <Card title="Ida y vuelta">
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-neutral-500">
                  Desnivel {RUN_TYPE_LABELS.forward.toLowerCase()}
                </dt>
                <dd className="font-mono tabular-nums text-neutral-900">
                  {formatElevation(result.forward.heightDifference)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">
                  Desnivel {RUN_TYPE_LABELS.return.toLowerCase()}
                </dt>
                <dd className="font-mono tabular-nums text-neutral-900">
                  {formatElevation(result.return.heightDifference)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">
                  Error de cierre {RUN_TYPE_LABELS.forward.toLowerCase()}
                </dt>
                <dd className="font-mono tabular-nums text-neutral-900">
                  {result.forward.errorMm != null
                    ? `${formatMm(result.forward.errorMm)} mm`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">
                  Error de cierre {RUN_TYPE_LABELS.return.toLowerCase()}
                </dt>
                <dd className="font-mono tabular-nums text-neutral-900">
                  {result.return.errorMm != null
                    ? `${formatMm(result.return.errorMm)} mm`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Discrepancia</dt>
                <dd className="font-mono tabular-nums text-neutral-900">
                  {result.discrepancyMm != null
                    ? `${formatMm(result.discrepancyMm)} mm`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Tolerancia (T·√2)</dt>
                <dd className="font-mono tabular-nums text-neutral-900">
                  {result.discrepancyToleranceMm != null
                    ? `${formatMm(result.discrepancyToleranceMm)} mm`
                    : "—"}
                </dd>
              </div>
            </dl>
            {result.meetsDiscrepancy != null && (
              <StatusIndicator
                status={result.meetsDiscrepancy ? "ok" : "danger"}
                label={
                  result.meetsDiscrepancy
                    ? "Discrepancia dentro de tolerancia"
                    : "Discrepancia fuera de tolerancia"
                }
              />
            )}
          </div>
        </Card>
      )}

      {/* Bloque 4: cotas corregidas de la ida (§4.4). */}
      <Card title="Cotas corregidas">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Punto</th>
                <th className="py-2 pr-3 font-medium">Dist. acum. (km)</th>
                <th className="py-2 pr-3 font-medium">Corrección (mm)</th>
                <th className="py-2 pr-3 font-medium">Cota corregida</th>
              </tr>
            </thead>
            <tbody>
              {result.forward.readings.map((reading, i) => (
                <tr
                  key={`${reading.pointCode}-${i}`}
                  className="border-b border-neutral-100"
                >
                  <td className="py-2 pr-3 text-neutral-900">
                    {reading.pointCode}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatKm(reading.distanceAccumulatedKm)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatMm(reading.correctionApplied * 1000)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums font-medium text-neutral-900">
                    {formatElevation(reading.elevationCorrected)}
                  </td>
                </tr>
              ))}
              {result.forward.readings.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">
                    Aún no hay lecturas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
