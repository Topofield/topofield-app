import { describe, expect, it } from "vitest";
import { levelingKindLabel, levelingTypeLabel, type LevelingProcess } from "@/types/leveling";
import type { PolygonalProcess } from "@/types/polygonal";
import { LEVELING_CHIPS, levelingRow, POLYGONAL_CHIPS, polygonalRow } from "./hub-rows";

// Fase 27 (PU12 y PU13): el tipo de un proceso, como frase y sin «sin control»
// en una abierta con vuelta.

describe("levelingTypeLabel", () => {
  it("una abierta con vuelta no es «sin control»", () => {
    expect(levelingTypeLabel("open", true)).toBe("Abierta con ida y vuelta");
    expect(levelingTypeLabel("open", false)).toBe("Abierta sin control");
  });

  it("cerrada y de enlace no cambian con la vuelta", () => {
    expect(levelingTypeLabel("closed", true)).toBe("Cerrada");
    expect(levelingTypeLabel("link", false)).toBe("De enlace");
  });
});

describe("las filas del hub", () => {
  it("la nivelación, como frase", () => {
    expect(levelingKindLabel("open", true)).toBe("Nivelación abierta con ida y vuelta");
    expect(levelingKindLabel("open", false)).toBe("Nivelación abierta sin control");
    expect(levelingKindLabel("closed", true)).toBe("Nivelación cerrada · ida y vuelta");
    expect(levelingKindLabel("link", false)).toBe("Nivelación de enlace");
  });

  it("una poligonal cerrada no se confunde con el estado «Cerrado»", () => {
    const row = polygonalRow("p", {
      id: "x",
      name: "TT4",
      type: "closed",
      status: "calculated",
      relative_precision: "1:7045",
      meets_tolerance: true,
      updated_at: "2026-10-01T00:00:00Z",
    } as unknown as PolygonalProcess);
    expect(row.kindLabel).toBe("Poligonal cerrada");
  });

  // Fase 35: la poligonal no se cierra. Siempre admite renombrar y eliminar,
  // y su estado nunca es «Cerrado fuera de tolerancia».
  it("una poligonal que no cumple sigue siendo «Calculado», con todas sus acciones", () => {
    const row = polygonalRow("p", {
      id: "x",
      name: "Marginal",
      type: "closed",
      status: "calculated",
      relative_precision: "1:1001",
      meets_tolerance: false,
      updated_at: "2026-10-01T00:00:00Z",
    } as unknown as PolygonalProcess);
    expect(row.statusLabel).toBe("Calculado");
    expect(row.closed).toBe(false);
  });

  it("los chips de las poligonales y las nivelaciones no tienen cerrados ni rechazados", () => {
    expect(POLYGONAL_CHIPS).toEqual(["todos", "borradores", "calculados"]);
    expect(LEVELING_CHIPS).toEqual(["todos", "borradores", "calculados"]);
  });

  // Fase 36: la nivelación tampoco se cierra.
  it("una nivelación que no alcanza ningún orden sigue siendo «Calculado», con todas sus acciones", () => {
    const row = levelingRow("p", {
      id: "z",
      name: "Fuera",
      type: "closed",
      status: "calculated",
      has_return_run: false,
      closure_error_mm: 30,
      meets_tolerance: false,
      updated_at: "2026-10-01T00:00:00Z",
    } as unknown as LevelingProcess);
    expect(row.statusLabel).toBe("Calculado");
    expect(row.closed).toBe(false);
    expect(row.result).toBe("+30.0 mm");
  });

  it("una abierta con la vuelta a medias no dice «Sin verificación»", () => {
    const row = levelingRow("p", {
      id: "w",
      name: "A medias",
      type: "open",
      status: "in_progress",
      has_return_run: true,
      closure_error_mm: null,
      discrepancy_mm: null,
      meets_tolerance: null,
      updated_at: "2026-10-01T00:00:00Z",
    } as unknown as LevelingProcess);
    expect(row.result).toBe("—");
  });

  it("y la fila de nivelación usa la misma etiqueta", () => {
    const row = levelingRow("p", {
      id: "y",
      name: "El Verjón",
      type: "open",
      status: "calculated",
      has_return_run: true,
      meets_tolerance: true,
      updated_at: "2026-10-01T00:00:00Z",
    } as unknown as LevelingProcess);
    expect(row.kindLabel).toBe("Nivelación abierta con ida y vuelta");
  });
});
