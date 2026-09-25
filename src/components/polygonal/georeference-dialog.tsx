"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Modal, NumberInput, Select } from "@/components/design-system";
import { georeferencePolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { decimalToDms } from "@/lib/calculations/angles";
import { parseNumber } from "@/lib/utils/parse";
import type { PolygonalProcess, PolygonalStationWithReadings } from "@/types/polygonal";
import type { ReferencePoint } from "@/types/project";
import { formatRotation, planGeoreference, type ControlPoint } from "./georeference-plan";
import { polygonalInputOf } from "./polygonal-draft";

interface GeoreferenceDialogProps {
  process: PolygonalProcess;
  /** Las filas guardadas: se georreferencia lo guardado, no el borrador. */
  stations: PolygonalStationWithReadings[];
  /** Catálogo del proyecto, para tomar de ahí las coordenadas reales. */
  referencePoints: ReferencePoint[];
  /** Si no se puede georreferenciar ahora, por qué. */
  disabledReason: string | null;
}

interface PointDraft {
  index: string;
  north: string;
  east: string;
}

const EMPTY: PointDraft = { index: "", north: "", east: "" };

function toControlPoint(p: PointDraft): ControlPoint {
  return {
    index: p.index === "" ? null : Number(p.index),
    north: parseNumber(p.north),
    east: parseNumber(p.east),
  };
}

function formatDms(deg: number): string {
  const d = decimalToDms(deg);
  return formatRotation(d.deg, d.min, d.sec);
}

/** En mm mientras es pequeño; en m cuando ya no es un residuo sino un error. */
function formatResidual(meters: number): string {
  return meters < 1 ? `${(meters * 1000).toFixed(1)} mm` : `${meters.toFixed(3)} m`;
}

/**
 * Georreferencia la poligonal con dos de sus estaciones de coordenadas
 * conocidas (Fase 15). Se recalcula con la entrada transformada y se
 * reescriben coordenadas y azimuts, también en un proceso cerrado: el
 * veredicto no cambia, y la base no deja que cambie.
 */
export function GeoreferenceDialog({
  process,
  stations,
  referencePoints,
  disabledReason,
}: GeoreferenceDialogProps) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState<PointDraft>(EMPTY);
  const [b, setB] = useState<PointDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const closed = process.status === "closed" || process.status === "rejected";

  // Vértices con coordenadas, sin repetir: con orientación el arranque
  // aparece al principio y al final, y es el mismo punto.
  const options = useMemo(() => {
    const result = computePolygonal(polygonalInputOf(process, stations));
    const seen = new Set<string>();
    return result.stations.flatMap((s, i) => {
      if (s.north == null || s.east == null || seen.has(s.pointCode)) return [];
      seen.add(s.pointCode);
      return [{ value: String(i), label: s.pointCode || `E${i + 1}` }];
    });
  }, [process, stations]);

  const catalog = referencePoints.filter((p) => p.north != null && p.east != null);

  const planned = useMemo(
    () =>
      a.index !== "" || b.index !== ""
        ? planGeoreference(process, stations, toControlPoint(a), toControlPoint(b))
        : null,
    [process, stations, a, b],
  );
  const plan = planned?.ok ? planned.plan : null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const r = await georeferencePolygonalProcessAction(
        process.id,
        toControlPoint(a),
        toControlPoint(b),
      );
      if (r.ok) setOpen(false);
      else setError(r.error ?? "No se pudo georreferenciar.");
    });
  }

  function pointFields(
    label: string,
    value: PointDraft,
    onChange: (p: PointDraft) => void,
  ) {
    return (
      <fieldset className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3">
        <legend className="px-1 text-sm font-semibold text-neutral-800">{label}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Estación"
            placeholder="Elegir…"
            options={options}
            value={value.index}
            onChange={(e) => onChange({ ...value, index: e.target.value })}
          />
          {catalog.length > 0 && (
            <Select
              label="Tomar del catálogo"
              placeholder="(teclear)"
              options={catalog.map((p) => ({ value: p.id, label: p.code }))}
              value=""
              onChange={(e) => {
                const p = catalog.find((c) => c.id === e.target.value);
                if (p) onChange({ ...value, north: String(p.north), east: String(p.east) });
              }}
            />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberInput
            label="Norte real"
            value={value.north}
            onChange={(e) => onChange({ ...value, north: e.target.value })}
          />
          <NumberInput
            label="Este real"
            value={value.east}
            onChange={(e) => onChange({ ...value, east: e.target.value })}
          />
        </div>
      </fieldset>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setA(EMPTY);
          setB(EMPTY);
          setError(null);
          setOpen(true);
        }}
        disabled={disabledReason != null}
        title={disabledReason ?? undefined}
      >
        Georreferenciar
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Georreferenciar la poligonal"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={!plan || isPending}>
              {isPending
                ? "Georreferenciando…"
                : closed
                  ? "Reescribir coordenadas"
                  : "Georreferenciar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-500">
            Dos estaciones del levantamiento con sus coordenadas reales llevan
            la poligonal al sistema real: se gira y se traslada, sin cambiar
            ángulos ni distancias. Use las dos estaciones más alejadas entre
            sí: con puntos cercanos, un error pequeño en sus coordenadas gira
            mucho la poligonal.
          </p>
          {pointFields("Punto A", a, setA)}
          {pointFields("Punto B", b, setB)}

          {/* El error, solo cuando ya está todo tecleado: antes es el paso
              siguiente, no un fallo. */}
          {planned && !planned.ok && [a, b].every((p) => p.index !== "" && p.north !== "" && p.east !== "") && (
            <p className="text-sm text-danger-500">{planned.error}</p>
          )}

          {plan && (
            <div className="flex flex-col gap-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-neutral-500">Rotación</dt>
                <dd className="font-mono tabular-nums">{formatDms(plan.fit.transform.rotation)}</dd>
                <dt className="text-neutral-500">Traslación</dt>
                <dd className="font-mono tabular-nums">
                  N {plan.fit.transform.shiftNorth.toFixed(4)} · E{" "}
                  {plan.fit.transform.shiftEast.toFixed(4)}
                </dd>
                <dt className="text-neutral-500">Factor de escala</dt>
                <dd className="font-mono tabular-nums">{plan.fit.scaleFactor.toFixed(6)}</dd>
                <dt className="text-neutral-500">Residuos</dt>
                <dd className="font-mono tabular-nums">
                  {plan.pointCodes
                    .map(
                      (code, i) =>
                        `${code} ${formatResidual(Math.hypot(plan.residuals[i]!.north, plan.residuals[i]!.east))}`,
                    )
                    .join(" · ")}
                </dd>
              </dl>

              {!plan.scaleWithinOrder && (
                <Alert variant="warning">
                  La distancia real entre {plan.pointCodes[0]} y {plan.pointCodes[1]} no
                  concuerda con la medida a la precisión del orden (factor{" "}
                  {plan.fit.scaleFactor.toFixed(6)}). Revise sus coordenadas. Si
                  están en una proyección con factor de escala distinto de 1
                  (p. ej. CTM12), la diferencia puede ser de la proyección y no
                  un error. La escala no se aplica: se conservan las distancias
                  medidas.
                </Alert>
              )}
              {process.correction_method === "transit" && (
                <Alert variant="warning">
                  Con Tránsito las coordenadas no se trasladan rígidamente: el
                  reparto del error depende de la orientación y cambia unos
                  milímetros. El veredicto no cambia.
                </Alert>
              )}
              {process.reference_point_id != null && (
                <Alert variant="warning">
                  El amarre {process.reference_point_code} es del catálogo y sus
                  coordenadas siguen en el sistema anterior: pasa a amarre
                  manual, con el mismo código.
                </Alert>
              )}
              {closed && (
                <p className="text-sm text-neutral-700">
                  El proceso está cerrado: se reescriben solo coordenadas y
                  azimuts. El veredicto de cierre no cambia.
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Coordenadas actuales y georreferenciadas</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Estación</th>
                      <th className="py-2 pr-3 font-medium">Norte actual</th>
                      <th className="py-2 pr-3 font-medium">Este actual</th>
                      <th className="py-2 pr-3 font-medium">Norte real</th>
                      <th className="py-2 pr-3 font-medium">Este real</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.after.stations.map((s, i) => (
                      <tr key={i} className="border-b border-neutral-100">
                        <td className="py-1.5 pr-3 font-medium">{s.pointCode}</td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums text-neutral-500">
                          {plan.before.stations[i]?.north?.toFixed(3) ?? "—"}
                        </td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums text-neutral-500">
                          {plan.before.stations[i]?.east?.toFixed(3) ?? "—"}
                        </td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums">{s.north?.toFixed(3) ?? "—"}</td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums">{s.east?.toFixed(3) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
