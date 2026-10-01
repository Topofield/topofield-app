import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PolygonalResult } from "@/types/polygonal";
import { StationsTable, type StationDraftState } from "./stations-table";

// Fase 24: en la tabla de escritorio, cada campo de la fila tiene nombre
// accesible con el número de estación, como la vista de tarjetas, y el código
// no se corta.

const station = (i: number, code: string): StationDraftState => ({
  id: `s${i}`,
  pointCode: code,
  angle: { deg: "90", min: "0", sec: "0" },
  readings: [{ deg: "90", min: "0", sec: "0" }],
  deflectionDirection: null,
  distance: "100",
});

const result = { stations: [] } as unknown as PolygonalResult;

function render(showDeflection: boolean) {
  return renderToStaticMarkup(
    createElement(StationsTable, {
      stations: [station(0, "Famarena_5"), station(1, "D1")],
      onChange: () => {},
      result,
      issues: [],
      showDeflection,
      readingsMin: 1,
      angularPrecisionSeconds: Number.NaN,
      angleFormat: "dms",
    }),
  );
}

describe("StationsTable — nombres accesibles (Fase 24)", () => {
  it("código y distancia llevan el número de estación", () => {
    const html = render(false);
    expect(html).toContain('aria-label="Código de la estación 1"');
    expect(html).toContain('aria-label="Distancia de la estación 2 (m)"');
  });

  it("el sentido de la deflexión también", () => {
    expect(render(true)).toContain('aria-label="Sentido de la estación 1"');
  });

  it("el campo de código de escritorio es más ancho que antes", () => {
    const campo = render(false).match(/<input[^>]*aria-label="Código de la estación 1"[^>]*>/g);
    // El de escritorio, con su clase de ancho (el de tarjetas ocupa la fila).
    expect(campo?.some((tag) => /\bw-32\b/.test(tag))).toBe(true);
    expect(campo?.some((tag) => /\bw-24\b/.test(tag))).toBe(false);
  });
});
