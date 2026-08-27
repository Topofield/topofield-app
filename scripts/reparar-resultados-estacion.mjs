// Repara procesos poligonales cuyas ESTACIONES quedaron sin resultados
// persistidos (ángulo corregido, azimut, proyecciones y coordenadas).
//
// Por qué existe: hasta la Fase 6, `scripts/seed.mjs` y
// `src/lib/demo/crear-proyecto-demo.ts` insertaban los datos de campo pero
// descartaban lo que el motor ya había calculado por estación. La aplicación
// se veía correcta porque el editor recalcula en vivo; solo lo nota quien lee
// lo PERSISTIDO — el informe (§ 4.7) y la exportación a Excel (§ 4.8). Ambos
// generadores están corregidos, pero los datos ya creados no se arreglan
// solos.
//
// Qué hace: por cada proceso con estaciones sin resultado, reconstruye la
// entrada del motor desde la base, corre `computePolygonal` —la misma función
// que usa `savePolygonalProcessAction`, nunca valores a mano— y persiste el
// resultado por estación.
//
// Qué NO hace: tocar procesos CERRADOS o RECHAZADOS. Son inmutables por
// trigger de base y debe seguir siendo así; el script los informa y los salta.
//
// Uso:
//   node scripts/reparar-resultados-estacion.mjs            (local, simula)
//   node scripts/reparar-resultados-estacion.mjs --aplicar  (local, escribe)
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node ... --aplicar   (otra base)

import { createClient } from "@supabase/supabase-js";
import { computePolygonal } from "../src/lib/calculations/polygonal.ts";
import { decimalToDms, dmsToDecimal } from "../src/lib/calculations/angles.ts";

const APLICAR = process.argv.includes("--aplicar");

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error(
    "Faltan SUPABASE_URL y SUPABASE_SECRET_KEY.\n" +
      "En local: node --env-file=.env.local scripts/reparar-resultados-estacion.mjs",
  );
  process.exit(1);
}

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Base: ${URL}`);
console.log(APLICAR ? "Modo: APLICAR (escribe)\n" : "Modo: simulación (no escribe)\n");

const { data: procesos, error: errProc } = await db
  .from("polygonal_processes")
  .select("*, projects(precision_order)")
  .order("name");
if (errProc) throw errProc;

let reparados = 0;
let saltados = 0;
let yaCorrectos = 0;

for (const p of procesos ?? []) {
  const { data: estaciones, error: errEst } = await db
    .from("polygonal_stations")
    .select("*")
    .eq("process_id", p.id)
    .order("station_order", { ascending: true });
  if (errEst) throw errEst;

  if (!estaciones || estaciones.length === 0) continue;

  const faltan = estaciones.filter((s) => s.north === null).length;
  if (faltan === 0) {
    yaCorrectos += 1;
    continue;
  }

  // Un proceso cerrado o rechazado es inmutable por diseño: el trigger de base
  // rechazaría la escritura, y es correcto que lo haga. Se informa y se salta.
  if (p.status === "closed" || p.status === "rejected") {
    console.log(
      `  ⊘ ${p.name} — ${faltan}/${estaciones.length} sin resultado, pero está ${p.status}: inmutable, no se toca.`,
    );
    saltados += 1;
    continue;
  }

  const order = p.projects?.precision_order ?? "tercer_orden";
  const resultado = computePolygonal({
    type: p.type,
    startNorth: Number(p.start_north),
    startEast: Number(p.start_east),
    startAzimuth: dmsToDecimal(
      p.start_azimuth_deg ?? 0,
      p.start_azimuth_min ?? 0,
      p.start_azimuth_sec ?? 0,
    ),
    endNorth: p.end_north === null ? null : Number(p.end_north),
    endEast: p.end_east === null ? null : Number(p.end_east),
    endAzimuth:
      p.end_azimuth_deg === null
        ? null
        : dmsToDecimal(
            p.end_azimuth_deg,
            p.end_azimuth_min ?? 0,
            p.end_azimuth_sec ?? 0,
          ),
    order,
    method: p.correction_method ?? "bowditch",
    stations: estaciones.map((s) => ({
      pointCode: s.point_code,
      angle:
        s.angle_deg === null
          ? Number.NaN
          : dmsToDecimal(s.angle_deg, s.angle_min ?? 0, s.angle_sec ?? 0),
      deflectionDirection: s.deflection_direction,
      distance:
        s.horizontal_distance === null
          ? Number.NaN
          : Number(s.horizontal_distance),
    })),
  });

  const filas = estaciones.map((s, i) => {
    const r = resultado.stations[i];
    const azimut = r?.azimuth != null ? decimalToDms(r.azimuth) : null;
    const corregido =
      r?.correctedAngle != null ? decimalToDms(r.correctedAngle) : null;
    return {
      id: s.id,
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

  const conCoords = filas.filter((f) => f.north !== null).length;
  console.log(
    `  ${APLICAR ? "✓" : "·"} ${p.name} [${p.status}] — ${faltan} sin resultado → ${conCoords}/${filas.length} calculadas`,
  );

  if (APLICAR) {
    for (const fila of filas) {
      const { id, ...campos } = fila;
      const { error } = await db
        .from("polygonal_stations")
        .update(campos)
        .eq("id", id);
      if (error) throw error;
    }
  }
  reparados += 1;
}

console.log(
  `\nProcesos: ${reparados} ${APLICAR ? "reparados" : "por reparar"} · ` +
    `${yaCorrectos} ya correctos · ${saltados} inmutables (cerrados/rechazados)`,
);
if (!APLICAR && reparados > 0) {
  console.log("\nNada se escribió. Repite con --aplicar para persistir.");
}
