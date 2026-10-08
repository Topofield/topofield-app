// Fase 35, criterio f: el informe dice en cada método qué ángulos corrigió y
// con qué factor, con las cifras del motor y las fórmulas en MathML.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { azimuthFromCoordinates, decimalToDms, dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { correctionBreakdown } from "@/lib/calculations/correction-breakdown";
import { captureRows } from "@/components/polygonal/capture-rows";
import type { CorrectionMethod, PolygonalInput } from "@/types/polygonal";
import { PolygonalCorrection } from "./polygonal-correction";

const c = CARTERA_TT4;
const az = decimalToDms(azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast));
const base: PolygonalInput = {
  type: "closed",
  order: "tercer_orden",
  angleType: "interior",
  method: "bowditch",
  leastSquares: { sigmaAngleSeconds: 5, sigmaDistanceM: 0.005, distanceMeasurements: 1 },
  startNorth: c.startNorth,
  startEast: c.startEast,
  startAzimuth: dmsToDecimal(az.deg, az.min, az.sec),
  endNorth: null,
  endEast: null,
  endAzimuth: null,
  hasOrientation: true,
  hasClosingRow: true,
  stations: c.stations.map((s) => ({
    pointCode: s.pointCode,
    angle: dmsToDecimal(...s.readings[0]!),
    deflectionDirection: null,
    distance: s.distance,
    readings: [],
  })),
};

function html(method: CorrectionMethod, over: Partial<PolygonalInput> = {}) {
  const input = { ...base, method, ...over };
  const result = computePolygonal(input);
  return renderToStaticMarkup(
    <PolygonalCorrection
      number={3}
      input={input}
      result={result}
      breakdown={correctionBreakdown(input, result)}
      rows={captureRows(input, { start: "V10", reference: "TT4" })}
      angleFormat="dms"
      referenceLabel="TT4"
    />,
  );
}

describe("PolygonalCorrection", () => {
  it("Brújula: los 7 ángulos con la orientación y su corrección en el texto, y el reparto por la longitud de los lados", () => {
    const h = html("bowditch");
    expect(h).toContain("3. Corrección por método Brújula (Bowditch)");
    expect(h).toContain("entre los 7 ángulos de la condición, incluido el de orientación en V10 y el cierre contra TT4");
    // El reparto angular va en el texto, sin fórmula (Fase 40).
    expect(h).toMatch(/: [+−]1\.71″ por ángulo\./);
    expect(h).toContain("<math");
    expect(h).toContain("<mn>115.712</mn>");
    expect(h).toContain("los lados largos absorben más corrección");
    // La leyenda de la fórmula (Fase 41).
    expect(h).toContain('<p class="report-formula-legend">donde: ');
    expect(h).toContain("P — perímetro, la suma de las longitudes");
    expect(h).toMatch(/e<sub>N<\/sub> = \+0\.008\d m/);
  });

  it("Tránsito: la proyección absoluta de cada eje y su corrección unitaria", () => {
    const h = html("transit");
    expect(h).toContain("3. Corrección por método Tránsito");
    expect(h).toContain("Igual que en la Brújula: el error angular");
    expect(h).toContain("<mn>83.850</mn>");
    expect(h).toContain("<mn>52.085</mn>");
    expect(h).toContain("k<sub>N</sub>, k<sub>E</sub> — corrección unitaria de cada eje");
    expect(h).not.toContain("k: corrección unitaria");
  });

  it("Crandall: solo las distancias, con λ₁ y λ₂", () => {
    const h = html("crandall");
    expect(h).toContain("Paso 2 · Distancias");
    expect(h).toContain(">λ</mi>");
    expect(h).toContain("<mo>×</mo>");
    expect(h).toContain("d ajustada (m)");
    expect(h).toContain("Desde aquí, los azimuts ya no cambian.");
    expect(h).toContain("multiplicadores de Lagrange de las dos condiciones");
  });

  it("Mínimos cuadrados: la orientación es el datum, con σ₀ y su lectura", () => {
    const h = html("least_squares");
    expect(h).toContain("3. Corrección por método Mínimos cuadrados");
    expect(h).toContain("V10 (orientación)");
    expect(h).toContain("datum");
    expect(h).toContain("V10 (cierre contra TT4)");
    expect(h).toContain("Los métodos Brújula, Tránsito y Crandall, en cambio, sí lo corrigen");
    expect(h).toContain("σ₀, desviación de la unidad de peso");
    expect(h).toContain("tres condiciones: la suma angular");
    expect(h).toContain("P — matriz de pesos, Q⁻¹");
    expect(h).toContain("cuantil de la distribución F de Fisher");
  });

  it("Mínimos cuadrados sin pesos lo dice como informe (Fase 41)", () => {
    const h = html("least_squares", { leastSquares: undefined });
    expect(h).toContain("no se declararon las precisiones a priori");
    expect(h).not.toContain("faltan los pesos");
  });

  it("la abierta sin control no tiene corrección", () => {
    expect(html("bowditch", { type: "open_uncontrolled", hasClosingRow: false })).toBe("");
  });
});
