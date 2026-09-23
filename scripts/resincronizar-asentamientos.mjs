// Resincroniza las lecturas persistidas de las visitas ABIERTAS de cada lugar
// de monitoreo con el motor actual.
//
// Por qué existe: la Fase 11 cambió la línea base de los puntos SIN C0. Antes
// su acumulado era null; ahora se mide contra su primera lectura. El panel, el
// informe y el Excel recalculan en vivo y lo ven solos, pero el hub del
// proyecto lee el `alert_status` PERSISTIDO, que solo se reescribe al guardar
// la visita. Sin este script, una visita abierta de un punto sin C0 seguiría
// clasificada con el acumulado viejo hasta que alguien la guarde.
//
// Qué hace: por cada lugar abierto, cuenta sus puntos sin C0 y llama a
// `resyncSiteReadings` —la misma función que usan `saveSiteAction` y
// `savePointAction`, que recalcula con `computeHistory`—. Nunca SQL que imite
// al motor (aprendizaje de la Fase 9).
//
// Qué NO hace: tocar visitas CERRADAS ni lugares cerrados. Son inmutables por
// trigger, y una visita cerrada conserva la clasificación con la que se cerró.
//
// Uso (tsx resuelve los imports de TypeScript y los alias `@/`):
//   npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs            (simula)
//   npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs --aplicar  (escribe)
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/... --aplicar           (otra base)

import { createClient } from "@supabase/supabase-js";
import { resyncSiteReadings } from "../src/lib/supabase/settlement-sync.ts";

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
  .select("id, name, status")
  .order("name");
if (errLugares) throw errLugares;

let lecturasTotales = 0;
let lugaresConCambios = 0;

for (const lugar of lugares ?? []) {
  if (lugar.status === "closed") {
    console.log(`  ⊘ ${lugar.name} — cerrado: inmutable, no se toca.`);
    continue;
  }

  const { count: sinC0 } = await db
    .from("settlement_points")
    .select("id", { count: "exact", head: true })
    .eq("site_id", lugar.id)
    .is("initial_elevation", null);

  const resultado = await resyncSiteReadings(db, lugar.id, { dryRun: !APLICAR });
  if (!resultado.ok) {
    console.error(`  ✗ ${lugar.name} — ${resultado.error}`);
    process.exitCode = 1;
    continue;
  }

  if (resultado.rewritten === 0) {
    console.log(`  ✓ ${lugar.name} — al día (${sinC0 ?? 0} puntos sin C0).`);
    continue;
  }

  lugaresConCambios += 1;
  lecturasTotales += resultado.rewritten;
  console.log(
    `  ${APLICAR ? "↻" : "·"} ${lugar.name} — ${resultado.rewritten} lecturas ${APLICAR ? "reescritas" : "a reescribir"} (${sinC0 ?? 0} puntos sin C0).`,
  );
}

console.log(
  `\n${lugaresConCambios} lugares, ${lecturasTotales} lecturas ${APLICAR ? "reescritas" : "a reescribir"}.` +
    (APLICAR || lecturasTotales === 0 ? "" : " Repite con --aplicar para escribir."),
);
