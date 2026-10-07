// Agrega la cartera real de asentamientos a los «Proyecto de ejemplo» ya
// creados (Fase 37, decisión 23). Los usuarios nuevos la reciben con la demo
// (`crearProyectoDemo`); las demos anteriores a la fase no la tienen.
//
// Qué hace: por cada proyecto llamado «Proyecto de ejemplo» que no tenga el
// lugar «Control de asentamiento estructural», llama a `insertarCartera` —la
// misma función que la demo y el seed—. En simulación solo los cuenta.
//
// Uso (tsx resuelve los imports de TypeScript y los alias `@/`):
//   npx tsx --env-file=.env.local scripts/agregar-cartera-demo.mjs            (simula)
//   npx tsx --env-file=.env.local scripts/agregar-cartera-demo.mjs --aplicar  (escribe)
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/... --aplicar    (otra base)

import { createClient } from "@supabase/supabase-js";
import { CARTERA_ASENTAMIENTOS } from "../src/lib/demo/cartera-asentamientos.ts";
import { PROYECTO_DEMO } from "../src/lib/demo/fixtures.ts";
import { insertarCartera } from "../src/lib/demo/insertar-cartera.ts";

const APLICAR = process.argv.includes("--aplicar");

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error(
    "Faltan SUPABASE_URL y SUPABASE_SECRET_KEY.\n" +
      "En local: npx tsx --env-file=.env.local scripts/agregar-cartera-demo.mjs",
  );
  process.exit(1);
}

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Base: ${URL}`);
console.log(APLICAR ? "Modo: APLICAR (escribe)\n" : "Modo: simulación (no escribe)\n");

const { data: proyectos, error: errProyectos } = await db
  .from("projects")
  .select("id, user_id, sites(name)")
  .eq("name", PROYECTO_DEMO.name)
  .order("created_at");
if (errProyectos) throw errProyectos;

let pendientes = 0;
for (const proyecto of proyectos ?? []) {
  const tiene = (proyecto.sites ?? []).some((s) => s.name === CARTERA_ASENTAMIENTOS.name);
  if (tiene) {
    console.log(`  ✓ ${proyecto.id} — ya tiene la cartera.`);
    continue;
  }
  pendientes += 1;
  if (!APLICAR) {
    console.log(`  · ${proyecto.id} — sin la cartera.`);
    continue;
  }
  const siteId = await insertarCartera(db, proyecto.id);
  console.log(`  ↻ ${proyecto.id} — cartera agregada (${siteId}).`);
}

console.log(
  `\n${proyectos?.length ?? 0} proyectos de ejemplo, ${pendientes} ${APLICAR ? "completados" : "sin la cartera"}.` +
    (APLICAR || pendientes === 0 ? "" : " Repite con --aplicar para escribir."),
);
