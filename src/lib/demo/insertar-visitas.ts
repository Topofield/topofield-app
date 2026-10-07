// Las visitas de un lugar de la demo y del seed (Fase 37): cabecera, libreta
// y lecturas salen de `recalculateSite`, la misma regla que el guardado de la
// app (`visitRecordOf`), sin compensar y sin cerrar nada. Las escrituras van
// agrupadas —una por tabla— porque esto corre en el primer acceso del
// usuario, con su cliente y bajo RLS.

import type { SupabaseClient } from "@supabase/supabase-js";
import { recalculateSite } from "@/lib/calculations/visit-record";
import type { Database } from "@/types/database";
import type { BenchmarkInput, BookRowPayload, PointInput, Thresholds } from "@/types/settlement";

type Client = SupabaseClient<Database>;

export interface VisitaDemo {
  visitNumber: number;
  date: string;
  operator: string | null;
  notes?: string | null;
  /** El nivel de la visita (§ Fase 8); null si no se registró. */
  equipment?: {
    brand: string;
    model: string;
    serial: string;
    calibrationDate: string;
    levelType: "automatico" | "digital";
    kmPrecisionMm: number;
  } | null;
  rows: BookRowPayload[];
}

/** Inserta las visitas con su libreta y sus lecturas. Devuelve su id por número. */
export async function insertarVisitas(
  supabase: Client,
  siteId: string,
  points: PointInput[],
  benchmarks: BenchmarkInput[],
  thresholds: Thresholds,
  visitas: VisitaDemo[],
): Promise<Map<number, string>> {
  const computed = recalculateSite({
    points,
    benchmarks,
    thresholds,
    visits: visitas.map((v) => ({ id: `demo-${v.visitNumber}`, visitNumber: v.visitNumber, date: v.date, rows: v.rows })),
  });

  const { data: visitRows, error: errVisitas } = await supabase
    .from("settlement_visits")
    .insert(
      visitas.map((v, i) => ({
        site_id: siteId,
        visit_number: v.visitNumber,
        date: v.date,
        operator: v.operator,
        notes: v.notes ?? null,
        equipment_brand: v.equipment?.brand ?? null,
        equipment_model: v.equipment?.model ?? null,
        equipment_serial: v.equipment?.serial ?? null,
        equipment_calibration_date: v.equipment?.calibrationDate ?? null,
        level_type: v.equipment?.levelType ?? null,
        km_precision_mm: v.equipment?.kmPrecisionMm ?? null,
        ...computed[i]!.record.header,
      })),
    )
    .select("id, visit_number");
  if (errVisitas) throw errVisitas;
  const idPorNumero = new Map(visitRows.map((v) => [v.visit_number, v.id]));
  const idReal = (provisional: string) => idPorNumero.get(Number(provisional.slice("demo-".length)))!;

  const libretas = computed.flatMap(({ record }) => record.rows.map((r) => ({ ...r, visit_id: idReal(r.visit_id) })));
  if (libretas.length > 0) {
    const { error } = await supabase.from("settlement_book_readings").insert(libretas);
    if (error) throw error;
  }

  const lecturas = computed.flatMap(({ visitId, readings }) =>
    readings.map((r) => ({
      visit_id: idReal(visitId),
      point_id: r.pointId,
      elevation: r.elevation,
      partial_settlement: r.partialSettlement,
      accumulated_settlement: r.accumulatedSettlement,
      velocity: r.velocity,
      alert_status: r.alertStatus,
    })),
  );
  if (lecturas.length > 0) {
    const { error } = await supabase.from("settlement_readings").insert(lecturas);
    if (error) throw error;
  }
  return idPorNumero;
}
