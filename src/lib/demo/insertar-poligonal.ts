// Inserta un proceso poligonal del proyecto de ejemplo.
//
// Se ejecuta con el cliente del propio usuario, sujeto a RLS. Los resultados
// que se persisten los calcula el motor real (`computePolygonal`), nunca se
// escriben a mano — misma estrategia que `scripts/seed.mjs`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { decimalToDms, dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import type { Database } from "@/types/database";
import type { ProcesoDemo } from "./fixtures";

type Client = SupabaseClient<Database>;

/**
 * Resultado del motor y los campos de cabecera que se persisten.
 *
 * Devuelve el resultado COMPLETO, no solo los campos de cabecera, porque las
 * estaciones también persisten los suyos (ángulo corregido, azimut,
 * proyecciones y coordenadas). Antes se descartaba, y el proyecto de ejemplo
 * quedaba con las columnas de cálculo vacías: la aplicación se veía bien
 * porque el editor recalcula en vivo, pero el informe y la exportación a
 * Excel —que leen lo persistido— mostraban guiones.
 */
export function resultadosDe(proceso: ProcesoDemo) {
  const r = computePolygonal({
    type: proceso.type,
    startNorth: proceso.startNorth,
    startEast: proceso.startEast,
    startAzimuth: dmsToDecimal(...proceso.startAz),
    endNorth: proceso.endNorth ?? null,
    endEast: proceso.endEast ?? null,
    endAzimuth: null,
    // El orden lo declara el proceso (Fase 8), no ya el proyecto.
    order: proceso.precisionOrder,
    // Las poligonales sin cierre no reparten error, pero el motor exige un
    // método: Bowditch es el que usa la aplicación por defecto.
    method: proceso.correctionMethod ?? "bowditch",
    angleType: proceso.angleType,
    // Como en la aplicación: hay orientación cuando el proceso está amarrado.
    hasOrientation: proceso.referencePointCode != null,
    hasClosingRow: proceso.hasClosingRow ?? false,
    leastSquares: proceso.leastSquares ?? null,
    stations: proceso.stations.map((st) => ({
      pointCode: st.code,
      angle: st.angle ? dmsToDecimal(...st.angle) : Number.NaN,
      deflectionDirection: st.dir ?? null,
      distance: st.distance ?? null,
      readings: st.angle
        ? [{ order: 1, angle: dmsToDecimal(...st.angle) }]
        : [],
    })),
  });

  const rel = r.relativePrecision;
  return {
    resultado: r,
    campos: {
      angular_error_seconds: r.angularError,
      linear_error: r.linearError,
      perimeter: r.perimeter,
      relative_precision:
        rel == null ? null : rel === Infinity ? "1:∞" : `1:${Math.round(rel)}`,
      meets_tolerance: r.meetsTolerance,
    },
  };
}

/**
 * Inserta una poligonal, sus estaciones y sus lecturas, y la cierra si el
 * fixture lo pide. `referencias` da el `id` de cada punto del catálogo por su
 * código, para enlazar el amarre. Devuelve el `id` del proceso creado, que el
 * orquestador usa para armar el informe de poligonal.
 */
export async function insertarPoligonal(
  supabase: Client,
  projectId: string,
  siteId: string,
  userId: string,
  proceso: ProcesoDemo,
  referencias: ReadonlyMap<string, string>,
): Promise<string> {
  const cerrado = proceso.status === "closed";
  const calculo = resultadosDe(proceso);

  const { data: creado, error } = await supabase
    .from("polygonal_processes")
    .insert({
      project_id: projectId,
      site_id: siteId,
      name: proceso.name,
      type: proceso.type,
      angle_type: proceso.angleType,
      // Orden y equipo viven en el proceso desde la Fase 8: una estación total
      // declara su precisión angular y su precisión de distancia en dos
      // términos (ISO 17123-3 y -4), no el proyecto por todos.
      precision_order: proceso.precisionOrder,
      equipment_brand: proceso.equipmentBrand ?? null,
      equipment_model: proceso.equipmentModel ?? null,
      equipment_serial: proceso.equipmentSerial ?? null,
      equipment_calibration_date: proceso.equipmentCalibrationDate ?? null,
      angular_precision_seconds: proceso.angularPrecisionSeconds ?? null,
      distance_precision_mm: proceso.distancePrecisionMm ?? null,
      distance_precision_ppm: proceso.distancePrecisionPpm ?? null,
      start_point_code: proceso.startPointCode,
      start_north: proceso.startNorth,
      start_east: proceso.startEast,
      start_azimuth_deg: proceso.startAz[0],
      start_azimuth_min: proceso.startAz[1],
      start_azimuth_sec: proceso.startAz[2],
      end_point_code: proceso.endPointCode ?? null,
      end_north: proceso.endNorth ?? null,
      end_east: proceso.endEast ?? null,
      correction_method: proceso.correctionMethod ?? null,
      // Fase 14: pesos del ajuste por mínimos cuadrados, solo con ese método.
      ls_sigma_angle_seconds: proceso.leastSquares?.sigmaAngleSeconds ?? null,
      ls_sigma_distance_m: proceso.leastSquares?.sigmaDistanceM ?? null,
      ls_distance_measurements: proceso.leastSquares?.distanceMeasurements ?? null,
      reference_point_id:
        proceso.referencePointCode != null && proceso.referenceFromCatalog
          ? (referencias.get(proceso.referencePointCode) ?? null)
          : null,
      reference_point_code: proceso.referencePointCode ?? null,
      has_closing_row: proceso.hasClosingRow ?? false,
      // Las carteras traen una lectura por ángulo: es lo que hay en el papel.
      // El mínimo de 3 es para captura nueva.
      angle_readings_min: 1,
      // Nace abierto aunque el fixture lo quiera cerrado: los triggers de
      // inmutabilidad rechazan escribir estaciones bajo un proceso ya cerrado.
      // El cierre se aplica al final, igual que hace la aplicación.
      status: cerrado ? "calculated" : proceso.status,
      ...calculo.campos,
      notes: proceso.notes,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Se persisten también los resultados por estación, igual que hace
  // `savePolygonalProcessAction`: sin ellos, el informe y la exportación a
  // Excel del proyecto de ejemplo saldrían con las coordenadas vacías.
  const estaciones = proceso.stations.map((st, i) => {
    const r = calculo.resultado.stations[i];
    const azimut = r?.azimuth != null ? decimalToDms(r.azimuth) : null;
    const corregido =
      r?.correctedAngle != null ? decimalToDms(r.correctedAngle) : null;
    return {
      process_id: creado.id,
      station_order: i + 1,
      point_code: st.code,
      angle_deg: st.angle?.[0] ?? null,
      angle_min: st.angle?.[1] ?? null,
      angle_sec: st.angle?.[2] ?? null,
      deflection_direction: st.dir ?? null,
      horizontal_distance: st.distance ?? null,
      corrected_angle_deg: corregido?.deg ?? null,
      corrected_angle_min: corregido?.min ?? null,
      corrected_angle_sec: corregido?.sec ?? null,
      azimuth_deg: azimut?.deg ?? null,
      azimuth_min: azimut?.min ?? null,
      azimuth_sec: azimut?.sec ?? null,
      delta_north: r?.deltaNorth ?? null,
      delta_east: r?.deltaEast ?? null,
      corrected_delta_north: r?.correctedDeltaNorth ?? null,
      corrected_delta_east: r?.correctedDeltaEast ?? null,
      north: r?.north ?? null,
      east: r?.east ?? null,
    };
  });

  const { data: insertadas, error: errEst } = await supabase
    .from("polygonal_stations")
    .insert(estaciones)
    .select("id, station_order");
  if (errEst) throw errEst;

  // La lectura de cada ángulo (Fase 7): el editor promedia las lecturas, y una
  // estación sin ninguna saldría incompleta.
  const lecturas = proceso.stations.flatMap((st, i) => {
    const stationId = insertadas.find((r) => r.station_order === i + 1)?.id;
    if (!stationId || !st.angle) return [];
    return [
      {
        station_id: stationId,
        reading_order: 1,
        angle_deg: st.angle[0],
        angle_min: st.angle[1],
        angle_sec: st.angle[2],
      },
    ];
  });
  if (lecturas.length > 0) {
    const { error: errLect } = await supabase
      .from("polygonal_angle_readings")
      .insert(lecturas);
    if (errLect) throw errLect;
  }

  if (cerrado) {
    const { error: errCierre } = await supabase
      .from("polygonal_processes")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: userId,
      })
      .eq("id", creado.id);
    if (errCierre) throw errCierre;
  }

  return creado.id;
}
