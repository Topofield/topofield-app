import { describe, expect, it } from "vitest";
import {
  MAX_DISTINGUISHABLE_SERIES,
  SERIES_COLORS,
  SERIES_MARKERS,
  seriesStyle,
} from "./series-markers";

describe("SERIES_MARKERS", () => {
  // El número no es arbitrario: el marco teórico usa 9 puntos por sistema en
  // el edificio y 10 en la presa. Con menos formas, seleccionar el catálogo
  // completo repite marcador, y con acromatopsia la forma es el único canal.
  it("cubre el catálogo típico del dominio (10 puntos)", () => {
    expect(SERIES_MARKERS.length).toBeGreaterThanOrEqual(10);
  });

  it("no repite ninguna forma", () => {
    expect(new Set(SERIES_MARKERS).size).toBe(SERIES_MARKERS.length);
  });

  it("no repite ningún color", () => {
    expect(new Set(SERIES_COLORS).size).toBe(SERIES_COLORS.length);
  });
});

describe("seriesStyle", () => {
  // El caso que motiva la tarea: con 5 formas, las series 0 y 5 compartían
  // marcador. Un lugar con 9 o 10 puntos lo provocaba de inmediato.
  it("da forma distinta a las 10 primeras series", () => {
    const formas = Array.from({ length: 10 }, (_, i) => seriesStyle(i).shape);
    expect(new Set(formas).size).toBe(10);
  });

  it("la forma no se repite hasta la serie 11", () => {
    expect(seriesStyle(10).shape).toBe(seriesStyle(0).shape);
    for (let i = 1; i < 10; i++) {
      expect(seriesStyle(i).shape).not.toBe(seriesStyle(0).shape);
    }
  });

  // Forma + color juntos aguantan más que la forma sola, y el aviso de la
  // gráfica se calibra con ese número.
  it("la pareja forma+color no se repite antes del máximo anunciado", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < MAX_DISTINGUISHABLE_SERIES; i++) {
      const { shape, color } = seriesStyle(i);
      vistas.add(`${shape}|${color}`);
    }
    expect(vistas.size).toBe(MAX_DISTINGUISHABLE_SERIES);
  });

  it("la primera repetición de forma+color es exactamente en el máximo", () => {
    const primera = seriesStyle(0);
    const enElMaximo = seriesStyle(MAX_DISTINGUISHABLE_SERIES);
    expect(enElMaximo).toEqual(primera);
  });

  it("cicla sin romperse con índices altos", () => {
    expect(seriesStyle(97).shape).toBeDefined();
    expect(seriesStyle(97).color).toBeDefined();
  });
});
