// Filas del listado del hub para cada módulo (Fase 22). Cada módulo decide su
// tipo, su resultado, su veredicto y la métrica por la que ordena la columna
// de resultado; la tabla (`process-table.tsx`) es la misma para los tres.

import { StatusIndicator } from "@/components/design-system";
import type { ProcessRow } from "@/components/projects/process-table";
import type { StatusFilter } from "@/lib/process-list";
import { PROCESS_STATUS_TONE, SITE_STATUS_TONE } from "@/lib/process-status";
import { formatPrecision, formatSignedMm } from "@/lib/utils/format";
import { LEVELING_TYPE_LABELS, LEVELING_TYPES, type LevelingProcess } from "@/types/leveling";
import {
  POLYGONAL_TYPE_LABELS,
  POLYGONAL_TYPES,
  PROCESS_STATUS_LABELS,
  type PolygonalProcess,
} from "@/types/polygonal";
import { ALERT_LEVEL_LABELS, type AlertLevel } from "@/types/settlement";
import {
  SITE_STATUS_LABELS,
  STRUCTURE_TYPE_LABELS,
  STRUCTURE_TYPES,
  type Site,
} from "@/types/site";

export const PROCESS_CHIPS: StatusFilter[] = [
  "todos",
  "borradores",
  "calculados",
  "cerrados",
  "rechazados",
];
export const SITE_CHIPS: StatusFilter[] = ["todos", "activos", "cerrados"];

export const POLYGONAL_TYPE_OPTIONS = POLYGONAL_TYPES.map((t) => ({
  value: t,
  label: POLYGONAL_TYPE_LABELS[t],
}));
export const LEVELING_TYPE_OPTIONS = LEVELING_TYPES.map((t) => ({
  value: t,
  label: LEVELING_TYPE_LABELS[t],
}));
export const SITE_TYPE_OPTIONS = STRUCTURE_TYPES.map((t) => ({
  value: t,
  label: STRUCTURE_TYPE_LABELS[t],
}));

function closedOutOfTolerance(p: { status: string; meets_tolerance: boolean | null }): boolean {
  return p.status === "closed" && p.meets_tolerance === false;
}

function processStatus(p: PolygonalProcess | LevelingProcess) {
  return closedOutOfTolerance(p)
    ? { statusLabel: "Cerrado fuera de tolerancia", statusTone: "warning" as const }
    : { statusLabel: PROCESS_STATUS_LABELS[p.status], statusTone: PROCESS_STATUS_TONE[p.status] };
}

export function polygonalRow(projectId: string, p: PolygonalProcess): ProcessRow {
  return {
    id: p.id,
    kind: "polygonal",
    name: p.name,
    href: `/projects/${projectId}/polygonal/${p.id}`,
    kindLabel: `Poligonal · ${POLYGONAL_TYPE_LABELS[p.type]}`,
    ...processStatus(p),
    result: p.relative_precision
      ? formatPrecision(p.relative_precision)
      : p.type === "open_uncontrolled"
        ? "Sin verificación"
        : "—",
    meets: p.meets_tolerance,
    updatedAt: p.updated_at,
    closed: p.status === "closed" || p.status === "rejected",
  };
}

/** Mayor es mejor: el error de cierre (o la discrepancia) más chico. */
export function levelingMetric(p: LevelingProcess): number {
  if (p.closure_error_mm != null) return -Math.abs(Number(p.closure_error_mm));
  if (p.discrepancy_mm != null) return -Math.abs(Number(p.discrepancy_mm));
  return Number.NEGATIVE_INFINITY;
}

export function levelingRow(projectId: string, p: LevelingProcess): ProcessRow {
  const result =
    p.closure_error_mm != null
      ? `${formatSignedMm(Number(p.closure_error_mm))} mm`
      : p.discrepancy_mm != null
        ? `Δ ${Number(p.discrepancy_mm).toFixed(1)} mm`
        : p.type === "open"
          ? "Sin verificación"
          : "—";
  return {
    id: p.id,
    kind: "leveling",
    name: p.name,
    href: `/projects/${projectId}/leveling/${p.id}`,
    kindLabel: `Nivelación · ${LEVELING_TYPE_LABELS[p.type]}${p.has_return_run ? " · ida y vuelta" : ""}`,
    ...processStatus(p),
    result,
    meets: p.meets_tolerance,
    updatedAt: p.updated_at,
    closed: p.status === "closed" || p.status === "rejected",
  };
}

const ALERT_SEVERITY: Record<AlertLevel, number> = { normal: 0, caution: 1, alert: 2, alarm: 3 };

/** Un lugar con lo que el listado necesita, en la forma que filtra `process-list`. */
export interface SiteItem extends Site {
  type: string;
  visitCount: number;
  worstAlert: AlertLevel;
}

export function siteItem(site: Site, visitCount: number, worstAlert: AlertLevel): SiteItem {
  return { ...site, type: site.structure_type, visitCount, worstAlert };
}

/** Mayor es peor: ordenar por alerta de mayor a menor pone arriba lo urgente. */
export function siteMetric(s: SiteItem): number {
  return s.visitCount === 0 ? Number.NEGATIVE_INFINITY : ALERT_SEVERITY[s.worstAlert];
}

export function siteRow(projectId: string, s: SiteItem): ProcessRow {
  return {
    id: s.id,
    kind: "site",
    name: s.name,
    href: `/projects/${projectId}/settlement/${s.id}`,
    kindLabel: `${STRUCTURE_TYPE_LABELS[s.structure_type]} · ${s.visitCount} ${s.visitCount === 1 ? "visita" : "visitas"}`,
    statusLabel: SITE_STATUS_LABELS[s.status],
    statusTone: SITE_STATUS_TONE[s.status],
    result:
      s.visitCount === 0 ? (
        "Sin visitas"
      ) : (
        <span className="font-sans">
          <StatusIndicator level={s.worstAlert} label={ALERT_LEVEL_LABELS[s.worstAlert]} />
        </span>
      ),
    updatedAt: s.updated_at,
    closed: s.status === "closed",
  };
}
