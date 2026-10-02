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

describe("StationsTable — fila de orientación (Fase 26, C-2)", () => {
  function renderOpen(orientationRow: boolean) {
    return renderToStaticMarkup(
      createElement(StationsTable, {
        stations: [station(0, "A"), station(1, "B")],
        onChange: () => {},
        result,
        issues: [],
        showDeflection: true,
        readingsMin: 1,
        angleFormat: "dms",
        orientationRow,
      }),
    );
  }

  it("una abierta amarrada rotula la primera fila como orientación y le quita el sentido", () => {
    const html = renderOpen(true);
    expect(html).toContain("Orientación: ángulo a la derecha desde el amarre.");
    expect(html).not.toContain('aria-label="Sentido de la estación 1"');
    expect(html).toContain('aria-label="Sentido de la estación 2"');
  });

  it("sin amarre, la primera fila es como las demás", () => {
    const html = renderOpen(false);
    expect(html).not.toContain("Orientación");
    expect(html).toContain('aria-label="Sentido de la estación 1"');
  });
});

describe("readingValues — coma decimal (Fase 26, C-5)", () => {
  it("una lectura con coma cuenta igual que con punto", async () => {
    const { readingValues, averageOf } = await import("./polygonal-draft");
    const lecturas = [
      { deg: "45", min: "0", sec: "12,5" },
      { deg: "45", min: "0", sec: "14" },
      { deg: "45", min: "0", sec: "15" },
    ];
    expect(readingValues(lecturas)).toHaveLength(3);
    // (12.5 + 14 + 15) / 3 = 13.83″ → 13.8″, lo mismo que guarda el servidor.
    expect(averageOf(lecturas)).toEqual({ deg: "45", min: "0", sec: "13.8" });
  });
});
