"use client";

import { Badge } from "@/components/design-system";
import { DEFLECTION_DIRECTION_LABELS, type AngleInputFormat } from "@/types/polygonal";
import { formatAngle } from "./angle-format";
import type { CaptureRole, CaptureRow } from "./capture-rows";

const ROLE_BADGE: Partial<Record<CaptureRole, string>> = {
  backsight: "0 atrás",
  closing: "cierre",
  closing_angle: "cierre angular",
};

/**
 * Las mediciones «desde → hacia» (Fase 35): el 0 atrás, cada lado con su ángulo
 * y su distancia, y el azimut sin ajustar. En el teléfono, el azimut va bajo el
 * punto y la columna # se oculta, para que la tabla no desborde.
 */
export function MeasurementsTable({
  rows,
  angleFormat,
  onEdit,
}: {
  rows: CaptureRow[];
  angleFormat: AngleInputFormat;
  onEdit: (row: CaptureRow, number: number) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-rule text-left text-ink-2">
          <th scope="col" className="hidden py-2 pr-2 font-medium sm:table-cell">
            #
          </th>
          <th scope="col" className="py-2 pr-2 font-medium">
            Punto
          </th>
          <th scope="col" className="py-2 pr-2 text-right font-medium">
            Ángulo
          </th>
          <th scope="col" className="py-2 pr-2 text-right font-medium">
            Distancia (m)
          </th>
          <th scope="col" className="hidden py-2 pr-2 text-right font-medium sm:table-cell">
            Azimut
          </th>
          <th scope="col" className="py-2">
            <span className="sr-only">Editar</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const number = i + 1;
          const badge = ROLE_BADGE[row.role];
          const pending = row.role === "pending";
          return (
            <tr key={`${row.stationIndex ?? "ref"}-${row.role}`} className="border-b border-rule last:border-b-0">
              <td className="hidden py-2 pr-2 text-ink-2 sm:table-cell">{number}</td>
              <td className="py-2 pr-2">
                <span className="font-semibold">
                  {row.from}
                  {row.to && ` → ${row.to}`}
                </span>
                {badge && (
                  <Badge tone={row.role === "backsight" ? "neutral" : "primary"} className="ml-2">
                    {badge}
                  </Badge>
                )}
                {pending && <span className="ml-2 text-ink-2">pendiente</span>}
                {row.azimuth !== null && (
                  <span className="block text-xs text-ink-2 sm:hidden">Az {formatAngle(row.azimuth, angleFormat)}</span>
                )}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">
                {pending ? "—" : formatAngle(row.angle, angleFormat)}
                {row.deflectionDirection && row.angle !== null && (
                  <span className="block text-xs text-ink-2">{DEFLECTION_DIRECTION_LABELS[row.deflectionDirection]}</span>
                )}
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{row.distance?.toFixed(3) ?? "—"}</td>
              <td className="hidden py-2 pr-2 text-right tabular-nums sm:table-cell">
                {formatAngle(row.azimuth, angleFormat)}
              </td>
              <td className="py-1 text-right">
                {!pending && (
                  <button
                    type="button"
                    aria-label={`Editar medición ${number}`}
                    className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sel hover:text-ink"
                    onClick={() => onEdit(row, number)}
                  >
                    <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="currentColor">
                      <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-9 9-3.9 1.1 1.1-3.9 9-9Z" />
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
