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
    active_from: null,
    retired_on: null,
    retirement_reason: null,
  },
  {
    id: "p2",
    code: "P-02",
    location_description: "Esquina NE",
    northing: "1000.000",
    easting: "2030.000",
    initial_elevation: "100.0000",
    active_from: null,
    retired_on: null,
    retirement_reason: null,
  },
];

const POINTS: PointInput[] = POINT_ROWS.map((p) => ({
  id: p.id,
  code: p.code,
  northing: Number(p.northing),
  easting: Number(p.easting),
  initialElevation: Number(p.initial_elevation),
  activeFrom: null,
  retiredOn: null,
}));

function visit(over: Partial<VisitRow> = {}): VisitRow {
  return {
    id: "v0",
    visit_number: 0,
    date: "2026-01-01",
    status: "closed",
    operator: null,
    weather_conditions: null,
    precision_order: "tercer_orden",
    equipment_brand: null,
    equipment_model: null,
    equipment_serial: null,
    equipment_calibration_date: null,
    level_type: null,
    km_precision_mm: null,
    ...over,
  };
}

const VISIT_ROWS: VisitRow[] = [
  visit({ id: "v0", visit_number: 0, date: "2026-01-01", status: "closed" }),
  visit({ id: "v1", visit_number: 1, date: "2026-02-01", status: "draft" }),
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

  it("escribe en el catálogo el alta, la baja y el motivo de cada punto (Fase 11)", () => {
    const rows: PointRow[] = [
      POINT_ROWS[0]!,
      {
        ...POINT_ROWS[1]!,
        retired_on: "2026-03-01",
        retirement_reason: "Destruido por obra",
      },
    ];
    const raw = buildSettlementWorkbook(
      SITE,
      rows,
      VISIT_ROWS,
      computeHistory(POINTS, VISIT_INPUTS, THRESHOLDS),
      THRESHOLDS,
    ).getWorksheet("Datos Crudos")!;
    expect(raw.getCell("F4").value).toBe("Alta");
    expect(raw.getCell("G4").value).toBe("Baja");
    expect(raw.getCell("H4").value).toBe("Motivo de baja");
    expect(raw.getCell("G5").value).toBeNull();
    expect(raw.getCell("G6").value).toBe("2026-03-01");
    expect(raw.getCell("H6").value).toBe("Destruido por obra");
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

  // El equipo es de la VISITA, no del lugar (§ Fase 8): el instrumento puede
  // cambiar entre campañas. El resumen muestra el de la más reciente, no el
  // de la primera ni un valor fijo del lugar.
  it("el resumen lleva el equipo de la visita más reciente", () => {
    const visitas = [
      visit({
        id: "v0",
        date: "2026-01-01",
        precision_order: "tercer_orden",
        equipment_brand: "Sokkia",
        equipment_model: "B40",
        level_type: "digital",
        km_precision_mm: "1.5",
      }),
      visit({
        id: "v1",
        date: "2026-02-01",
        precision_order: "primer_orden",
        equipment_brand: "Leica",
        equipment_model: "NA2",
        equipment_serial: "LC-7",
        level_type: "automatico",
        km_precision_mm: "0.7",
      }),
    ];
    const history = computeHistory(POINTS, VISIT_INPUTS, THRESHOLDS);
    const wb = buildSettlementWorkbook(SITE, POINT_ROWS, visitas, history, THRESHOLDS);
    const res = wb.getWorksheet("Resumen")!;
    const etiquetas = res.getColumn(1).values;
    const fila = (label: string) => etiquetas.findIndex((v) => v === label);

    expect(res.getCell(fila("Equipo"), 2).value).toBe("Leica NA2 · s/n LC-7");
    expect(res.getCell(fila("Orden de precisión"), 2).value).toBe(
      "Primer orden",
    );
    expect(res.getCell(fila("Tipo de nivel"), 2).value).toBe("Automático");
  });

  // El Resumen puede colapsar a la última visita (es un resumen); «Datos
  // Crudos» no puede: es el artefacto archivable, y ahí el equipo de una
  // visita cerrada antigua tiene que seguir leyéndose aunque exista una
  // visita más nueva con otro instrumento. Con una sola visita este test
  // pasaría aunque el colapso volviera — por eso son dos, con equipos
  // distintos, y se comprueba que CADA una conserva el suyo.
  it("Datos Crudos conserva el equipo de cada visita, no solo el de la más reciente", () => {
    const visitas = [
      visit({
        id: "v0",
        visit_number: 0,
        date: "2026-01-01",
        status: "closed",
        equipment_brand: "Sokkia",
        equipment_model: "B40",
        level_type: "digital",
        km_precision_mm: "1.50",
      }),
      visit({
        id: "v1",
        visit_number: 1,
        date: "2026-02-01",
        status: "closed",
        equipment_brand: "Leica",
        equipment_model: "NA2",
        equipment_serial: "LC-7",
        level_type: "automatico",
        km_precision_mm: "0.70",
      }),
    ];
    const history = computeHistory(POINTS, VISIT_INPUTS, THRESHOLDS);
    const wb = buildSettlementWorkbook(
      SITE,
      POINT_ROWS,
      visitas,
      history,
      THRESHOLDS,
    );
    const raw = wb.getWorksheet("Datos Crudos")!;

    // Fila → (equipo, tipo de nivel, mm/km), indexadas por el número de
    // visita de esa misma fila (columna 1 de la tabla «Cotas medidas por
    // visita»).
    const porVisita = new Map<
      number,
      { equipo: unknown; tipo: unknown; mmKm: unknown }
    >();
    raw.eachRow((row) => {
      const visitNumber = row.getCell(1).value;
      if (typeof visitNumber !== "number") return;
      porVisita.set(visitNumber, {
        equipo: row.getCell(6).value,
        tipo: row.getCell(7).value,
        mmKm: row.getCell(8).value,
      });
    });

    expect(porVisita.get(0)).toEqual({
      equipo: "Sokkia B40",
      tipo: "Digital / electrónico",
      mmKm: 1.5,
    });
    expect(porVisita.get(1)).toEqual({
      equipo: "Leica NA2 · s/n LC-7",
      tipo: "Automático",
      mmKm: 0.7,
    });
  });
});
