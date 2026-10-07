"use client";

import { Badge } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import { formatReading, readingDecimals, type ArmadaSummary, type SheetRow } from "./libreta-rows";

const dash = <span className="text-ink-3">—</span>;
const meters = (v: number | null) => (v == null ? dash : v.toFixed(1));
const elevation = (v: number | null) => (v == null ? dash : v.toFixed(4));

function Pencil({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sel hover:text-ink"
      onClick={onClick}
    >
      <svg viewBox="0 0 20 20" aria-hidden className="size-4" fill="currentColor">
        <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-9 9-3.9 1.1 1.1-3.9 9-9Z" />
      </svg>
    </button>
  );
}

const TH = "py-2 px-2 text-right text-xs font-medium whitespace-nowrap";
/** Los rótulos que no resaltan la fila: una vista intermedia, una lectura por tomar. */
const QUIET = new Set(["intermedia", "pendiente"]);
const TD = "py-2 px-2 text-right whitespace-nowrap tabular-nums";
const GROUP = "border-l border-rule";

/**
 * La tabla de la hoja (Fase 36, libreta B): Punto, V+ y su distancia, AI, V− y
 * su distancia, VI y la cota sin compensar. Solo lectura; el lápiz de una fila
 * abre la armada que la fila cierra. La visita (Fase 37) trae sus rótulos.
 */
export function LibretaTable({
  rows,
  onEdit,
}: {
  rows: (Omit<SheetRow, "badge"> & { badge: string | null })[];
  onEdit: (armada: number) => void;
}) {
  const decimals = readingDecimals(rows.flatMap((r) => [r.backsight, r.foresight, r.intermediate]));
  const reading = (v: number | null) => (v == null ? dash : formatReading(v, decimals));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-2">
            <th scope="col" className={cn(TH, "text-left")}>
              Punto
            </th>
            <th scope="col" className={cn(TH, GROUP)}>
              V+
            </th>
            <th scope="col" className={TH}>
              <abbr title="Distancia de la V+" className="no-underline">
                Dist.
              </abbr>
            </th>
            <th scope="col" className={cn(TH, GROUP)}>
              AI
            </th>
            <th scope="col" className={cn(TH, GROUP)}>
              V−
            </th>
            <th scope="col" className={TH}>
              <abbr title="Distancia de la V−" className="no-underline">
                Dist.
              </abbr>
            </th>
            <th scope="col" className={TH}>
              VI
            </th>
            <th scope="col" className={cn(TH, GROUP)}>
              Cota
            </th>
            <th scope="col" className="w-9">
              <span className="sr-only">Editar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn("border-b border-rule last:border-b-0", row.badge && !QUIET.has(row.badge) && "bg-mira-bg/40")}
            >
              <td className="py-1.5 px-2 whitespace-nowrap">
                <span className="block font-semibold">{row.pointCode}</span>
                {row.badge && (
                  <Badge tone={QUIET.has(row.badge) ? "neutral" : "primary"} className="px-2 py-0">
                    {row.badge}
                  </Badge>
                )}
              </td>
              <td className={cn(TD, GROUP)}>{reading(row.backsight)}</td>
              <td className={TD}>{meters(row.backDistanceM)}</td>
              <td className={cn(TD, GROUP)}>{elevation(row.instrumentHeight)}</td>
              <td className={cn(TD, GROUP)}>{reading(row.foresight)}</td>
              <td className={TD}>{meters(row.foreDistanceM)}</td>
              <td className={TD}>{reading(row.intermediate)}</td>
              <td className={cn(TD, GROUP, "font-medium")}>{elevation(row.elevation)}</td>
              <td className="py-1 pr-1 text-right">
                {row.armada != null && (
                  <Pencil label={`Editar la armada ${row.armada + 1}`} onClick={() => onEdit(row.armada!)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * La libreta en el teléfono (Fase 36, maqueta «Móvil · Libreta»): una fila por
 * armada, de → a, con sus visuales, las intermedias y la cota adelante. Toda la
 * fila abre la armada.
 */
export function ArmadaList({
  armadas,
  endBadge,
  onEdit,
}: {
  armadas: ArmadaSummary[];
  /** El rótulo de la armada que llega al fin: «fin de la ida», «BM»… */
  endBadge: string;
  onEdit: (armada: number) => void;
}) {
  if (armadas.length === 0) return null;
  const decimals = readingDecimals(
    armadas.flatMap((a) => [a.backsight, a.foresight, ...a.intermediates.map((m) => m.reading)]),
  );
  return (
    <ul className="divide-y divide-rule rounded-lg border border-rule bg-card">
      {armadas.map((a) => (
        <li key={a.k}>
          <button
            type="button"
            onClick={() => onEdit(a.k)}
            aria-label={`Editar la armada ${a.k + 1}`}
            className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-sel"
          >
            <span className="w-5 text-xs text-ink-3">{a.k + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block">
                <span className="font-semibold">{a.from}</span>
                <span className="mx-1.5 text-ink-3">→</span>
                <span className="font-semibold">{a.to ?? "…"}</span>
                {a.ends && (
                  <Badge tone="primary" className="ml-2">
                    {endBadge}
                  </Badge>
                )}
              </span>
              <span className="block text-xs text-ink-2 tabular-nums">
                V+ {formatReading(a.backsight, decimals)} · {a.backDistanceM?.toFixed(1) ?? "—"} m
                {a.to != null && (
                  <>
                    {"  ·  "}V− {formatReading(a.foresight, decimals)} · {a.foreDistanceM?.toFixed(1) ?? "—"} m
                  </>
                )}
              </span>
              {a.intermediates.map((m, i) => (
                <span key={i} className="block text-xs text-ink-2 tabular-nums">
                  VI {m.pointCode} {formatReading(m.reading, decimals)} → {m.elevation?.toFixed(4) ?? "—"}
                </span>
              ))}
            </span>
            <span className="text-right text-sm font-semibold tabular-nums">{a.elevation?.toFixed(4) ?? "—"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
