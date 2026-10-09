// Las tablas del manual que copian reglas del cálculo (Fase 42): si cambia
// una constante, la prueba falla hasta que cambie también el manual.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANGULAR_TOLERANCE_K,
  LEVELING_TOLERANCE_K,
  MIN_RELATIVE_PRECISION,
} from "@/lib/calculations/tolerances";
import { formatPrecision } from "@/lib/utils/format";
import { PROCESS_STATUS_LABELS } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS, PRECISION_ORDERS } from "@/types/project";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import { lexear, textoPlano, type Tokens } from "./markdown";

/** La tabla del capítulo cuya cabecera empieza por `cabecera`, como texto. */
function tabla(archivo: string, cabecera: string[]): string[][] {
  const tokens = lexear(readFileSync(join(process.cwd(), "docs", "manual", archivo), "utf8"));
  const t = tokens.find(
    (x): x is Tokens.Table =>
      x.type === "table" &&
      cabecera.every((c, i) => textoPlano((x as Tokens.Table).header[i]?.tokens) === c),
  );
  if (!t) throw new Error(`No está la tabla «${cabecera.join(" | ")}» en ${archivo}`);
  return t.rows.map((fila) => fila.map((celda) => textoPlano(celda.tokens)));
}

describe("las tablas del manual siguen al código", () => {
  it("los órdenes de la poligonal: tolerancia angular y precisión mínima", () => {
    const filas = tabla("03-poligonal.md", ["Orden", "Tolerancia angular", "Precisión relativa mínima"]);
    expect(filas.map((f) => f.slice(0, 3))).toEqual(
      PRECISION_ORDERS.map((o) => [
        PRECISION_ORDER_LABELS[o],
        `${ANGULAR_TOLERANCE_K[o]}″·√n`,
        formatPrecision(MIN_RELATIVE_PRECISION[o]),
      ]),
    );
  });

  it("el K de la nivelación", () => {
    const filas = tabla("04-nivelacion.md", ["Orden", "K (mm)"]);
    expect(filas).toEqual(PRECISION_ORDERS.map((o) => [PRECISION_ORDER_LABELS[o], String(LEVELING_TOLERANCE_K[o])]));
  });

  it("los niveles del semáforo", () => {
    const filas = tabla("05-asentamientos.md", ["Nivel", "Qué significa", "Forma"]);
    expect(filas.map((f) => f[0])).toEqual(Object.values(ALERT_LEVEL_LABELS));
  });

  it("los estados de un proceso", () => {
    const filas = tabla("01-primeros-pasos.md", ["Estado", "Qué significa"]);
    expect(filas.map((f) => f[0])).toEqual([
      PROCESS_STATUS_LABELS.draft,
      PROCESS_STATUS_LABELS.in_progress,
      PROCESS_STATUS_LABELS.calculated,
    ]);
  });
});
