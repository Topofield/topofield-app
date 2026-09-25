"use client";

import { Drawer } from "@/components/design-system";
import { formatBookClosure, formatDateOnly } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { SettlementBookReading } from "@/types/settlement";

interface BookDrawerProps {
  open: boolean;
  onClose: () => void;
  visitLabel: string;
  date: string;
  operator: string | null;
  equipment: string;
  amarre: { code: string; elevation: number | null } | null;
  rows: SettlementBookReading[];
  closureErrorMm: number | null;
  toleranceMm: number | null;
  meetsTolerance: boolean | null;
  /** El punto seleccionado en la vista, cuya fila se marca además. */
  selectedPointId: string | null;
}

/** Un valor DECIMAL (que PostgREST entrega como cadena) a 4 decimales, o «—». */
function m4(value: number | string | null): string {
  return value == null ? "—" : Number(value).toFixed(4);
}

/** Número de armada de cada fila: sube en cada fila que abre una (la que lleva V+). */
function setupNumbers(rows: SettlementBookReading[]): number[] {
  const out: number[] = [];
  let setup = 0;
  for (const r of rows) {
    if (r.backsight != null) setup += 1;
    out.push(setup);
  }
  return out;
}

/**
 * El registro de nivelación de la visita (Fase 18), en lectura: la libreta tal
 * como se guardó, con sus cotas calculadas y compensadas. Las columnas son las
 * del prototipo: la vista intermedia de un punto de control va en su propia
 * columna, separada de la vista menos de los puntos de cambio y del cierre.
 * Lee lo persistido sin recalcular, como el Excel.
 */
export function BookDrawer({
  open,
  onClose,
  visitLabel,
  date,
  operator,
  equipment,
  amarre,
  rows,
  closureErrorMm,
  toleranceMm,
  meetsTolerance,
  selectedPointId,
}: BookDrawerProps) {
  const closure = formatBookClosure(closureErrorMm, toleranceMm, meetsTolerance);
  const sumBack = rows.reduce((a, r) => a + (r.backsight == null ? 0 : Number(r.backsight)), 0);
  // ΣV− de la cadena: las intermedias no cuentan (van en su propia columna).
  const sumFore = rows.reduce(
    (a, r) =>
      a + (r.point_type === "intermediate" || r.foresight == null ? 0 : Number(r.foresight)),
    0,
  );

  const setups = setupNumbers(rows);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Registro de nivelación, ${visitLabel.toLowerCase()}`}
      description="Lecturas de campo tal como se registraron en la libreta."
    >
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-2">Fecha</dt>
          <dd className="font-medium">{formatDateOnly(date)}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Nivelador</dt>
          <dd className="font-medium">{operator ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Equipo</dt>
          <dd className="font-medium">{equipment}</dd>
        </div>
        <div>
          <dt className="text-ink-2">BM de amarre</dt>
          <dd className="font-medium">
            {amarre ? `${amarre.code}, cota ${m4(amarre.elevation)}` : "—"}
          </dd>
        </div>
      </dl>

      {/* `relative` contiene el `sr-only` de las celdas (ver visits-table). */}
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-2">
              <th className="py-2 pr-3 font-medium">Arm.</th>
              <th className="py-2 pr-3 font-medium">Punto</th>
              <th className="py-2 pr-3 text-right font-medium">V+ (m)</th>
              <th className="py-2 pr-3 text-right font-medium">AI (m)</th>
              <th className="py-2 pr-3 text-right font-medium">V. int. (m)</th>
              <th className="py-2 pr-3 text-right font-medium">V− (m)</th>
              <th className="py-2 pr-3 text-right font-medium">Cota (m)</th>
              <th className="py-2 pr-3 text-right font-medium">Compensada (m)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              // Por `point_id` y no por código: una visita cerrada conserva el
              // código con que se midió aunque el punto se renombre después
              // (Fase 18, decisión 20), y seguiría siendo su punto de control.
              const isControl = r.point_id != null;
              const isSelected = selectedPointId != null && r.point_id === selectedPointId;
              const intermediate = r.point_type === "intermediate";
              const newSetup = i === 0 || setups[i] !== setups[i - 1];
              return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-rule font-mono tabular-nums",
                    newSetup && i > 0 && "border-t-2 border-t-neutral-200",
                    isSelected && "bg-sel",
                  )}
                >
                  <td className="py-1.5 pr-3 font-sans text-ink-2">
                    {newSetup && r.backsight != null ? setups[i] : ""}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 font-sans">
                    {r.point_code}
                    {isControl && <span className="sr-only"> (punto de control)</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{m4(r.backsight)}</td>
                  <td className="py-1.5 pr-3 text-right">{m4(r.instrument_height)}</td>
                  <td
                    className={cn(
                      "py-1.5 pr-3 text-right",
                      intermediate && isControl && "bg-warning-bg font-semibold text-ink",
                    )}
                  >
                    {intermediate ? m4(r.foresight) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{intermediate ? "—" : m4(r.foresight)}</td>
                  <td className="py-1.5 pr-3 text-right">{m4(r.elevation_calculated)}</td>
                  <td className="py-1.5 pr-3 text-right">{m4(r.elevation_corrected)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ["Σ vistas más", sumBack.toFixed(4)],
          ["Σ vistas menos", sumFore.toFixed(4)],
          ["Error de cierre", closure.value],
          ["Tolerancia", closure.detail],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-rule px-3 py-2">
            <dt className="text-ink-2">{label}</dt>
            <dd
              className={cn(
                "font-medium",
                label === "Tolerancia" && closure.status === "out" && "text-warning",
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-ink-2">
        Tolerancia de cierre K·√D según el orden de la visita, con D la
        longitud del circuito en km. Las cotas de los puntos de control se
        toman de la columna de cotas compensadas; si el cierre no cumple la
        tolerancia, no se compensa. Las vistas intermedias de los puntos de
        control están resaltadas.
      </p>
    </Drawer>
  );
}
