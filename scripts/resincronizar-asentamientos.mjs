// Recalcula las visitas de cada lugar de monitoreo con el motor de la Fase 37:
// por tramos, desde los BM del lugar y SIN compensar.
//
// Para qué sirve ahora: es el paso 2 del despliegue de la Fase 37 (PRD,
// Despliegue). Hasta la Fase 36 las visitas con libreta guardaban la cota
// compensada en `settlement_readings`, y de esas cotas guardadas parten el
// panel, el informe, el Excel y el hub; la cabecera de la visita guarda
// además su cierre y su orden. Todo eso solo se reescribe al volver a guardar
// la visita. Este script las pasa todas a la regla nueva de una vez. Va
// después del paso 1: sin `site_benchmarks` no hay BM contra qué recalcular.
//
// Qué hace: por cada lugar de control de asentamientos llama a
// `recomputeSite` —la misma función que usa el cambio de la cota de un BM—,
// que recalcula con `recalculateSite` y guarda cada visita con `save_visit`.
// Nunca SQL que imite al motor (aprendizaje de la Fase 9). Desde la Fase 37
// nada está cerrado: todas las visitas se recalculan.
//
// Uso (tsx resuelve los imports de TypeScript y los alias `@/`):
//   npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs            (simula)
//   npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs --aplicar  (escribe)
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/... --aplicar           (otra base)

import { createClient } from "@supabase/supabase-js";
import { recomputeSite } from "../src/lib/supabase/settlement-sync.ts";

const APLICAR = process.argv.includes("--aplicar");

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error(
    "Faltan SUPABASE_URL y SUPABASE_SECRET_KEY.\n" +
      "En local: npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs",
  );
  process.exit(1);
}

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Base: ${URL}`);
console.log(APLICAR ? "Modo: APLICAR (escribe)\n" : "Modo: simulación (no escribe)\n");

const { data: lugares, error: errLugares } = await db
  .from("sites")
  .select("id, name")
  .eq("kind", "settlement")
  .order("name");
if (errLugares) throw errLugares;

let visitasTotales = 0;
let lecturasTotales = 0;
let lugaresConCambios = 0;

for (const lugar of lugares ?? []) {
  const resultado = await recomputeSite(db, lugar.id, { dryRun: !APLICAR });
  if (!resultado.ok) {
    console.error(`  ✗ ${lugar.name} — ${resultado.error}`);
    process.exitCode = 1;
    continue;
  }
  if (resultado.changedReadings === 0) {
    console.log(`  ✓ ${lugar.name} — al día (${resultado.visits} visitas).`);
    continue;
  }
  lugaresConCambios += 1;
  visitasTotales += resultado.changedVisits;
  lecturasTotales += resultado.changedReadings;
  console.log(
    `  ${APLICAR ? "↻" : "·"} ${lugar.name} — ${resultado.changedVisits} de ${resultado.visits} visitas y ` +
      `${resultado.changedReadings} lecturas ${APLICAR ? "recalculadas" : "cambian"}.`,
  );
}

console.log(
  `\n${lugaresConCambios} lugares, ${visitasTotales} visitas y ${lecturasTotales} lecturas ${APLICAR ? "recalculadas" : "cambian"}.` +
    (APLICAR || lecturasTotales === 0 ? "" : " Repite con --aplicar para escribir."),
);
