import { levelingDraftOf, levelingRecordOf } from "@/components/leveling/leveling-save";
import { BenchmarksPanel, type LevelingOption } from "@/components/settlement/benchmarks-panel";
import { adoptedElevationsOf, samePointCode } from "@/lib/calculations/leveling";
import type { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcesses,
  getLevelingReadings,
  type getSiteBenchmarks,
  type getSiteBooks,
} from "@/lib/supabase/queries";
import { formatDateOnly } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS } from "@/types/project";

/**
 * Pestaña BMs del lugar (Fase 37, decisiones 12 y 13). Prepara en el servidor
 * lo que la tabla necesita: en cuántas visitas arranca un tramo en cada BM, y
 * las nivelaciones calculadas del proyecto con sus cotas ajustadas, para
 * importarlas.
 */
export async function BenchmarksTab({
  supabase,
  projectId,
  siteId,
  benchmarks,
  booksByVisit,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  projectId: string;
  siteId: string;
  benchmarks: Awaited<ReturnType<typeof getSiteBenchmarks>>;
  booksByVisit: Awaited<ReturnType<typeof getSiteBooks>>;
}) {
  const starts = Object.values(booksByVisit).map((rows) =>
    rows.filter((r) => r.reading_order === 1 || r.starts_section).map((r) => r.point_code),
  );
  const rows = benchmarks.map((b) => ({
    id: b.id,
    code: b.code,
    elevation: b.elevation,
    description: b.description,
    source: b.source,
    amarres: starts.filter((codes) => codes.some((c) => samePointCode(c, b.code))).length,
  }));

  const processes = (await getLevelingProcesses(supabase, projectId)).filter((p) => p.status === "calculated");
  const levelings: LevelingOption[] = [];
  for (const process of processes) {
    const record = levelingRecordOf(levelingDraftOf(process, await getLevelingReadings(supabase, process.id)));
    const adjusted = adoptedElevationsOf(record.result, record.input);
    if (!adjusted || adjusted.length === 0) continue;
    const order = record.order ? PRECISION_ORDER_LABELS[record.order].toLowerCase() : "sin orden";
    levelings.push({
      id: process.id,
      label: `${process.name} · ${order}`,
      source: `Nivelación «${process.name}», ${formatDateOnly(process.updated_at.slice(0, 10))}`,
      points: adjusted.map((a) => ({ pointCode: a.pointCode, elevation: a.elevation })),
    });
  }

  return <BenchmarksPanel siteId={siteId} benchmarks={rows} levelings={levelings} />;
}
