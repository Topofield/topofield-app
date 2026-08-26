import { describe, expect, it } from "vitest";
import {
  buildSettlementWorkbook,
  type PointRow,
  type SiteRow,
  type VisitRow,
} from "./settlement-workbook";
import { computeHistory } from "@/lib/calculations/settlement";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { PointInput, VisitInput } from "@/types/settlement";

const SITE: SiteRow = {
  name: "Edificio Torre Central",
  description: "Monitoreo de asentamientos",
  structure_type: "edificio",
  status: "active",
  closed_at: null,
  closed_by: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
};

const POINT_ROWS: PointRow[] = [
  {
    id: "p1",
    code: "P-01",
    location_description: "Esquina NW",
    northing: "1000.000",
    easting: "2000.000",
    initial_elevation: "100.0000",
  },
  {
    id: "p2",
    code: "P-02",
    location_description: "Esquina NE",
    northing: "1000.000",
    easting: "2030.000",
    initial_elevation: "100.0000",
  },
];

const POINTS: PointInput[] = POINT_ROWS.map((p) => ({
  id: p.id,
  code: p.code,
  northing: Number(p.northing),
  easting: Number(p.easting),
  initialElevation: Number(p.initial_elevation),
}));

const VISIT_ROWS: VisitRow[] = [
  { id: "v0", visit_number: 0, date: "2026-01-01", status: "closed", operator: null, equipment: null, weather_conditions: null },
  { id: "v1", visit_number: 1, date: "2026-02-01", status: "draft", operator: null, equipment: null, weather_conditions: null },
];

const VISIT_INPUTS: VisitInput[] = [
  {
    id: "v0",
    visitNumber: 0,
    date: "2026-01-01",
    readings: [
      { pointId: "p1", elevation: 100 },
      { pointId: "p2", elevation: 100 },
    ],
  },
  {
    id: "v1",
    visitNumber: 1,
    date: "2026-02-01",
    readings: [
      { pointId: "p1", elevation: 99.98 },
      { pointId: "p2", elevation: 99.995 },
    ],
  },
];

const THRESHOLDS = thresholdsFor("edificio");

function build() {
  const history = computeHistory(POINTS, VISIT_INPUTS, THRESHOLDS);
  return buildSettlementWorkbook(
    SITE,
    POINT_ROWS,
    VISIT_ROWS,
    history,
    THRESHOLDS,
  );
}

describe("buildSettlementWorkbook", () => {
  it("crea las tres hojas del § 4.8", () => {
    expect(build().worksheets.map((w) => w.name)).toEqual([
      "Datos Crudos",
      "Cálculos",
      "Resumen",
    ]);
  });

  it("lista el catálogo con su ubicación y su C0", () => {
    const raw = build().getWorksheet("Datos Crudos")!;
    expect(raw.getCell("A5").value).toBe("P-01");
    expect(raw.getCell("B5").value).toBe("Esquina NW");
    expect(raw.getCell("E5").value).toBe(100);
    expect(raw.getCell("E5").numFmt).toBe("0.0000");
  });

  // El libro debe mostrar el CÓDIGO del punto, no su UUID: un informe con
  // identificadores internos es ilegible para quien lo recibe.
  it("identifica los puntos por código, nunca por id", () => {
    const calc = build().getWorksheet("Cálculos")!;
    const columna = calc
      .getColumn(3)
      .values.filter((v): v is string => typeof v === "string");
    expect(columna).toContain("P-01");
    expect(columna).not.toContain("p1");
  });

  it("escribe el asentamiento en mm y la alerta con su etiqueta", () => {
    const calc = build().getWorksheet("Cálculos")!;
    // La visita 1 de P-01 baja 20 mm respecto a C0.
    const filas: unknown[][] = [];
    for (let r = 4; r <= 8; r++) {
      filas.push([
        calc.getCell(r, 3).value,
        calc.getCell(r, 5).value,
        calc.getCell(r, 7).value,
      ]);
    }
    const p01v1 = filas.find((f) => f[0] === "P-01" && f[1] === -20);
    expect(p01v1).toBeDefined();
    expect(typeof p01v1?.[2]).toBe("string");
  });

  it("marca en el resumen los umbrales vigentes del lugar", () => {
    const res = build().getWorksheet("Resumen")!;
    const etiquetas = res
      .getColumn(1)
      .values.filter((v): v is string => typeof v === "string");
    expect(etiquetas).toContain("Acumulado — precaución (mm)");
    expect(etiquetas).toContain("Límite de distorsión angular");
  });

  it("distingue la visita cerrada de la abierta en los datos crudos", () => {
    const raw = build().getWorksheet("Datos Crudos")!;
    const estados = raw
      .getColumn(3)
      .values.filter((v): v is string => typeof v === "string");
    expect(estados).toContain("Cerrada");
    expect(estados).toContain("Abierta");
  });

  // Dos puntos que se asientan igual no tienen distorsión entre sí: se escribe
  // `1/∞` y no un número enorme ni una celda vacía.
  it("representa la distorsión sin diferencial como 1/∞", () => {
    const iguales: VisitInput[] = [
      VISIT_INPUTS[0]!,
      {
        id: "v1",
        visitNumber: 1,
        date: "2026-02-01",
        readings: [
          { pointId: "p1", elevation: 99.98 },
          { pointId: "p2", elevation: 99.98 },
        ],
      },
    ];
    const history = computeHistory(POINTS, iguales, THRESHOLDS);
    const wb = buildSettlementWorkbook(SITE, POINT_ROWS, VISIT_ROWS, history, THRESHOLDS);
    const calc = wb.getWorksheet("Cálculos")!;
    const textos = calc
      .getColumn(5)
      .values.filter((v): v is string => typeof v === "string");
    expect(textos).toContain("1/∞");
  });

  it("exporta un lugar sin puntos ni visitas sin romperse", () => {
    const history = computeHistory([], [], THRESHOLDS);
    const wb = buildSettlementWorkbook(SITE, [], [], history, THRESHOLDS);
    expect(wb.worksheets).toHaveLength(3);
  });
});
