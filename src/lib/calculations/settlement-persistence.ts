// Qué hay que reescribir en la base tras recalcular un histórico de
// asentamientos. Funciones puras — sin React, sin Supabase, solo decisiones.
//
// Viven aquí, y no dentro de los Server Actions, porque son la parte que puede
// equivocarse en silencio. El motor de cálculo (`settlement.ts`) está cubierto
// por tests desde la Fase 5; lo que no lo estaba era esta capa, y es justo
// donde vivieron los fallos que llegaron más lejos: lecturas que quedaban
// obsoletas en la base mientras la pantalla mostraba el valor recalculado.
// Separar la DECISIÓN (qué filas cambiaron) de la E/S (escribirlas) permite
// probar la primera sin mockear el cliente de Supabase.

import { samePointCode } from "./leveling";
import type { ComputedReading as BookComputedRow } from "@/types/leveling";
import type {
  BookRowPayload,
  ComputedReading,
  PointInput,
  VisitResult,
} from "@/types/settlement";

/** Forma mínima de una lectura ya persistida, para comparar con la recalculada. */
export interface PersistedReading {
  point_id: string;
  partial_settlement: number | null;
  accumulated_settlement: number | null;
  /** `DECIMAL` en la base: PostgREST lo entrega como cadena. */
  velocity: string | number | null;
  alert_status: string;
}

/**
 * ¿La lectura recalculada difiere de la ya persistida?
 *
 * Compara `velocity` como número porque llega de la base como cadena o como
 * número según el camino de la fila; sin convertir, toda fila parecería
 * cambiada en cada guardado y la propagación reescribiría la base entera.
 *
 * Y la compara a la PRECISIÓN CON QUE SE PERSISTE: el motor no redondea la
 * velocidad (redondear antes de clasificar cambiaría el nivel de alerta), pero
 * la columna es `DECIMAL(8,2)`. Comparar −3.4364… con −3.44 daba siempre
 * «cambiada», y cada guardado reescribía todas las lecturas abiertas del
 * lugar. Se vio en la Fase 11, al simular el script de resincronización sobre
 * un lugar recién sembrado: 31 lecturas «a reescribir» sin nada que cambiar.
 *
 * Incluye `alert_status` en la comparación de forma deliberada: al editar los
 * umbrales de un lugar **ningún valor numérico cambia**, solo la
 * clasificación. Si esto mirara únicamente los números, ese cambio no
 * dispararía la reescritura y el hub seguiría mostrando el nivel viejo.
 */
export function readingChanged(
  computed: Pick<
    ComputedReading,
    "partialSettlement" | "accumulatedSettlement" | "velocity" | "alertStatus"
  >,
  persisted: PersistedReading | undefined,
): boolean {
  if (!persisted) return true;
  const persistedVelocity =
    persisted.velocity === null ? null : Number(persisted.velocity);
  return (
    computed.partialSettlement !== persisted.partial_settlement ||
    computed.accumulatedSettlement !== persisted.accumulated_settlement ||
    velocityChanged(computed.velocity, persistedVelocity) ||
    computed.alertStatus !== persisted.alert_status
  );
}

/**
 * ¿Cambió la velocidad, a la resolución de `DECIMAL(8,2)`? Se compara con una
 * tolerancia de media centésima y no redondeando los dos lados: el redondeo de
 * JS y el de Postgres difieren en los empates negativos (−2.345), y un empate
 * no debe leerse como un cambio.
 */
function velocityChanged(computed: number | null, persisted: number | null): boolean {
  if (computed === null || persisted === null) return computed !== persisted;
  return Math.abs(computed - persisted) > 0.005 + 1e-9;
}

export interface VisitsToRewriteInput {
  /** El histórico ya recalculado, tal como lo devuelve `computeHistory`. */
  recalculated: VisitResult[];
  /** Estado de cada visita por id (`draft` | `calculated` | `closed`). */
  statusByVisit: Map<string, string>;
  /** Lecturas persistidas, indexadas por visita y luego por punto. */
  persistedByVisit: Map<string, Map<string, PersistedReading>>;
  /**
   * Visita que el llamante escribe por su cuenta (la que se está guardando),
   * para no reescribirla dos veces.
   */
  skipVisitId?: string;
}

/** Una visita con solo las lecturas que hay que reescribir. */
export interface VisitRewrite {
  visitId: string;
  readings: ComputedReading[];
}

/**
 * Visitas ABIERTAS cuyas lecturas quedaron obsoletas, con solo las filas que
 * cambiaron.
 *
 * Las visitas CERRADAS nunca se devuelven: conservan la clasificación con la
 * que se cerraron, que es lo correcto para la trazabilidad —una visita cerrada
 * documenta el criterio vigente en su momento— y no un descuido. El trigger de
 * base lo impediría igualmente, pero la regla se decide aquí en vez de
 * delegarla a un error de la base.
 *
 * Devolver solo las lecturas cambiadas, y no la visita entera, evita reescribir
 * filas idénticas en cada guardado.
 */
export function visitsToRewrite({
  recalculated,
  statusByVisit,
  persistedByVisit,
  skipVisitId,
}: VisitsToRewriteInput): VisitRewrite[] {
  const out: VisitRewrite[] = [];

  for (const visit of recalculated) {
    if (visit.visitId === skipVisitId) continue;
    if (statusByVisit.get(visit.visitId) === "closed") continue;
    if (visit.readings.length === 0) continue;

    const persistedByPoint = persistedByVisit.get(visit.visitId);
    const readings = visit.readings.filter((r) =>
      readingChanged(r, persistedByPoint?.get(r.pointId)),
    );
    if (readings.length === 0) continue;

    out.push({ visitId: visit.visitId, readings });
  }

  return out;
}

/**
 * Las filas de la libreta de una visita tal como se escriben en
 * `settlement_book_readings` (Fase 18), con los calculados del motor.
 *
 * - `reading_order` empieza en 1, como en nivelación. El guardado hace upsert
 *   por `(visit_id, reading_order)` y purga las filas con orden mayor que el
 *   último: nunca borra y reinserta.
 * - Las distancias son las RESUELTAS por el motor (de los hilos, si los hay):
 *   la tecleada sola dejaría vacía la celda de una libreta por taquimetría.
 * - `point_id` enlaza la fila con su punto de control por código. Lo usa el
 *   renombrado de puntos (decisión 20); la derivación de cotas no lo necesita.
 */
export function bookRowsToPersist(
  visitId: string,
  rows: BookRowPayload[],
  computed: BookComputedRow[],
  points: Pick<PointInput, "id" | "code">[],
) {
  return rows.map((row, i) => {
    const r = computed[i];
    const point = points.find((p) => samePointCode(p.code, row.pointCode));
    return {
      visit_id: visitId,
      reading_order: i + 1,
      point_code: row.pointCode.trim(),
      point_type: row.pointType,
      point_id: point?.id ?? null,
      backsight: row.backsight,
      foresight: row.foresight,
      back_upper_m: row.backUpperM,
      back_lower_m: row.backLowerM,
      fore_upper_m: row.foreUpperM,
      fore_lower_m: row.foreLowerM,
      back_distance_m: r?.backDistanceResolvedM ?? null,
      fore_distance_m: r?.foreDistanceResolvedM ?? null,
      distance_accumulated_km: r?.distanceAccumulatedKm ?? null,
      instrument_height: r?.instrumentHeight ?? null,
      elevation_calculated: r?.elevationCalculated ?? null,
      elevation_corrected: r?.elevationCorrected ?? null,
      correction_applied: r?.correctionApplied ?? null,
    };
  });
}

